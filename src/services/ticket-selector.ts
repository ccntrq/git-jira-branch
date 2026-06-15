import * as Terminal from '@effect/platform/Terminal';
import {Context, Effect, Layer, Option, pipe} from 'effect';
import type {Chunk} from 'effect/Chunk';
import {
  type AppConfigError,
  type AssociatedBranch,
  type GitExecError,
  type JiraApiError,
  type JiraIssue,
  type JiraKeyPrefix,
  UsageError,
} from '../types.js';
import {getAssociatedBranches} from '../utils/associated-branch.js';
import {
  type AsyncSelectResult,
  type AsyncSelectView,
  asyncSelect,
} from '../utils/async-select.js';
import {jiraDescriptionToText} from '../utils/jira-description.js';
import {jiraIssueToBranchName} from '../utils/jira-issue-branch-name.js';
import {AppConfigService} from './app-config.js';
import type {GitClient} from './git-client.js';
import {JiraClient} from './jira-client.js';

export type TicketSelectorCommand = 'create' | 'switch' | 'delete';

export interface TicketSelectorParams {
  readonly command: TicketSelectorCommand;
  readonly type: Option.Option<string>;
  readonly reset: boolean;
}

export interface TicketSearchQuery {
  readonly project: string;
  readonly issueNumberPrefix: string;
}

export interface TicketPickerCandidate {
  readonly key: string;
  readonly issue: Option.Option<JiraIssue>;
  readonly associatedBranch: Option.Option<AssociatedBranch>;
  readonly branchPreview: string;
  readonly disabled: boolean;
  readonly disabledReason: Option.Option<string>;
}

export interface TicketSelection {
  readonly key: string;
  readonly associatedBranch: Option.Option<AssociatedBranch>;
}

export const ticketSelectionFromKey = (key: string): TicketSelection => ({
  key,
  associatedBranch: Option.none<AssociatedBranch>(),
});

type TicketSelectorError =
  | AppConfigError
  | GitExecError
  | JiraApiError
  | UsageError;

export class TicketSelector extends Context.Tag('TicketSelector')<
  TicketSelector,
  {
    readonly selectTicket: (
      params: TicketSelectorParams,
    ) => Effect.Effect<
      TicketSelection,
      TicketSelectorError,
      AppConfigService | GitClient | JiraClient | Terminal.Terminal
    >;
  }
>() {}

/**
 * Resolves the Jira key for a command: uses the one passed on the command line
 * if present, otherwise opens the interactive ticket picker.
 */
export const resolveJiraKey = (
  jiraKey: Option.Option<string>,
  params: TicketSelectorParams,
) =>
  resolveTicketSelection(jiraKey, params).pipe(
    Effect.map((selection) => selection.key),
  );

export const resolveTicketSelection = (
  jiraKey: Option.Option<string>,
  params: TicketSelectorParams,
) =>
  Option.match(jiraKey, {
    onSome: (key) => Effect.succeed(ticketSelectionFromKey(key)),
    onNone: () =>
      TicketSelector.pipe(Effect.flatMap((_) => _.selectTicket(params))),
  });

export const TicketSelectorLive = Layer.effect(
  TicketSelector,
  Effect.map(Terminal.Terminal, (terminal) =>
    TicketSelector.of({
      selectTicket: (params) =>
        terminal.isTTY.pipe(
          Effect.flatMap((isTty) =>
            isTty
              ? ticketPicker(params)
              : Effect.fail(
                  UsageError({
                    message:
                      'Missing Jira key and no interactive terminal is available.',
                  }),
                ),
          ),
        ),
    }),
  ),
);

const isNumericInput = (trimmedText: string): boolean =>
  /^\d+$/.test(trimmedText);

export const parseTicketSearchQuery = (
  raw: string,
  defaultProject: Option.Option<JiraKeyPrefix>,
): Option.Option<TicketSearchQuery> => {
  const normalized = raw.trim().toUpperCase();
  if (normalized.length === 0) {
    return pipe(
      defaultProject,
      Option.map((project) => ({
        project,
        issueNumberPrefix: '',
      })),
    );
  }

  if (isNumericInput(normalized)) {
    return pipe(
      defaultProject,
      Option.map((project) => ({
        project,
        issueNumberPrefix: normalized,
      })),
    );
  }

  const fullKey = normalized.match(/^([A-Z][A-Z0-9]*)-(\d*)$/);
  return Option.fromNullable(
    fullKey?.[1] !== undefined && fullKey[2] !== undefined
      ? {
          project: fullKey[1],
          issueNumberPrefix: fullKey[2],
        }
      : null,
  );
};

export const ticketSearchJql = (query: TicketSearchQuery): string => {
  const clauses = [`project = ${escapeJqlValue(query.project)}`];
  if (query.issueNumberPrefix.length > 0) {
    clauses.push(
      `key ~ "${escapeJqlString(`${query.project}-${query.issueNumberPrefix}*`)}"`,
    );
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
};

export const buildTicketPickerCandidates = (
  params: TicketSelectorParams,
  issues: ReadonlyArray<JiraIssue>,
  branches: Chunk<AssociatedBranch>,
  query: Option.Option<TicketSearchQuery>,
  queryText: string,
): ReadonlyArray<TicketPickerCandidate> => {
  const branchArray = Array.from(branches);
  const branchByKey = new Map(
    branchArray.map((branch) => [branch.jiraKey, branch]),
  );
  const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));
  const candidates = issues.map((issue) =>
    candidateForIssue(
      params,
      issue,
      Option.fromNullable(branchByKey.get(issue.key)),
    ),
  );

  const localOnlyBranches = branchArray
    .filter((branch) => !issueByKey.has(branch.jiraKey))
    .filter((branch) => branchMatchesQuery(branch.jiraKey, query, queryText))
    .map((branch) => candidateForBranch(params, branch));

  // Lead with the candidates the user can actually act on (for switch/delete
  // that's the branch-backed ones, for create the ones without a branch yet)
  // and sink the disabled rows to the bottom, preserving order within each
  // group. Without this, switch/delete bury the few actionable branches under
  // a wall of greyed-out remote tickets.
  return [...candidates, ...localOnlyBranches].sort(
    (a, b) => Number(a.disabled) - Number(b.disabled),
  );
};

// Fetch a generous page of matches and let the picker scroll through them,
// rather than rendering only the first handful.
const SEARCH_MAX_RESULTS = 50;

const ticketPicker = (
  params: TicketSelectorParams,
): Effect.Effect<
  TicketSelection,
  TicketSelectorError,
  AppConfigService | GitClient | JiraClient | Terminal.Terminal
> =>
  Effect.gen(function* () {
    const [defaultProject, jiraClient, branches] = yield* Effect.all(
      [
        AppConfigService.pipe(Effect.flatMap((_) => _.defaultJiraKeyPrefix)),
        JiraClient,
        getAssociatedBranches(),
      ],
      {concurrency: 'unbounded'},
    );

    const selected = yield* asyncSelect<
      TicketPickerCandidate,
      TicketSelectorError,
      never
    >({
      search: (queryText) =>
        searchTickets(params, defaultProject, jiraClient, branches, queryText),
      render: (view) => renderPicker(view, params),
      isDisabled: (candidate) => candidate.disabled,
      formatError: (error) => error.message,
      cancelMessage: 'Ticket selection cancelled.',
    });

    return {
      key: selected.key,
      associatedBranch: selected.associatedBranch,
    };
  });

const searchTickets = (
  params: TicketSelectorParams,
  defaultProject: Option.Option<JiraKeyPrefix>,
  jiraClient: Context.Tag.Service<JiraClient>,
  branches: Chunk<AssociatedBranch>,
  queryText: string,
): Effect.Effect<
  AsyncSelectResult<TicketPickerCandidate>,
  TicketSelectorError
> =>
  Effect.gen(function* () {
    const query = parseTicketSearchQuery(queryText, defaultProject);
    if (Option.isNone(query)) {
      // The text isn't a parseable Jira query, so we can't hit the API — but
      // matching local branches are still actionable, so surface them instead
      // of an empty list. Only fall back to a hint when there's nothing to show.
      const candidates = buildTicketPickerCandidates(
        params,
        [],
        branches,
        Option.none(),
        queryText,
      );
      return {
        items: candidates,
        message:
          candidates.length > 0
            ? Option.none()
            : Option.some(
                isNumericInput(queryText.trim())
                  ? 'Set JIRA_KEY_PREFIX or type a full key like APP-81.'
                  : 'Type a key prefix like 81 or APP-81.',
              ),
      };
    }

    return yield* jiraClient
      .searchJiraIssues({
        jql: ticketSearchJql(query.value),
        maxResults: SEARCH_MAX_RESULTS,
      })
      .pipe(
        Effect.map((issues) => ({
          items: buildTicketPickerCandidates(
            params,
            issues,
            branches,
            query,
            queryText,
          ),
          message: Option.none(),
        })),
        Effect.catchAll((error) =>
          Effect.succeed({
            items: buildTicketPickerCandidates(
              params,
              [],
              branches,
              query,
              queryText,
            ),
            message: Option.some(
              `Jira search failed; showing local branches only. ${error.message}`,
            ),
          }),
        ),
      );
  });

const renderPicker = (
  view: AsyncSelectView<TicketPickerCandidate>,
  params: TicketSelectorParams,
): string => {
  const count = view.items.length;
  const context = [
    params.command,
    ...(params.reset ? ['reset'] : []),
    ...(count > 0 ? [`${count} match${count === 1 ? '' : 'es'}`] : []),
  ].join('  ·  ');
  const spinner = view.loading
    ? `  ${accent(view.spinnerFrame)} ${dim('searching…')}`
    : '';

  const lines = [
    '',
    `  ${accentBold('Jira ticket picker')}    ${dim(context)}${spinner}`,
    '',
    renderSearchLine(view),
    '',
    ...Option.match(view.message, {
      onNone: () => [],
      onSome: (message) => [`  ${warn('!')} ${warn(message)}`, ''],
    }),
    ...renderCandidates(view),
    '',
    renderFooter(),
  ];
  return lines.join('\n');
};

const renderSearchLine = (
  view: AsyncSelectView<TicketPickerCandidate>,
): string =>
  view.query.length === 0
    ? `  ${accent('▌')} ${CURSOR}${dim('  type a key like APP-81 or 81')}`
    : `  ${accent('▌')} ${view.query}${CURSOR}`;

const renderFooter = (): string =>
  `  ${[
    keyHint('↑↓', 'move'),
    keyHint('⏎', 'select'),
    keyHint('type', 'search'),
    keyHint('^c', 'cancel'),
  ].join(dim('  ·  '))}`;

const renderCandidates = (
  view: AsyncSelectView<TicketPickerCandidate>,
): ReadonlyArray<string> => {
  const total = view.items.length;
  if (total === 0) {
    return Option.isSome(view.message) || view.loading
      ? []
      : [`  ${dim('no matching tickets')}`];
  }

  const start = Math.max(
    0,
    Math.min(view.scroll, Math.max(0, total - view.viewportSize)),
  );
  const end = Math.min(total, start + view.viewportSize);
  const rows = view.items
    .slice(start, end)
    .flatMap((candidate, offset) =>
      renderCandidate(
        candidate,
        start + offset === view.selected,
        view.columns,
      ),
    );

  return [
    ...(start > 0 ? [`  ${dim(`↑ ${start} more`)}`] : []),
    ...rows,
    ...(end < total ? [`  ${dim(`↓ ${total - end} more`)}`] : []),
  ];
};

const renderCandidate = (
  candidate: TicketPickerCandidate,
  isSelected: boolean,
  columns: number,
): ReadonlyArray<string> => {
  const issue = Option.getOrUndefined(candidate.issue);
  const branch = Option.getOrUndefined(candidate.associatedBranch);
  const summary = (issue?.fields.summary ?? 'local branch only').replace(
    /\s+/g,
    ' ',
  );
  const statusName = issue?.fields.status.name;

  if (candidate.disabled) {
    const reason = Option.getOrElse(
      candidate.disabledReason,
      () => 'unavailable',
    );
    const head = `${candidate.key}${statusName ? `  ${statusName}` : ''}  ${summary}`;
    return [`    ${dim(`${shorten(head, columns - 8)}  · ${reason}`)}`];
  }

  const statusLen = statusName ? statusName.length + 4 : 0;
  const budget = Math.max(12, columns - candidate.key.length - statusLen - 8);
  const summaryText = shorten(summary, budget);

  if (!isSelected) {
    const status = statusName ? `  ${dim(statusName)}` : '';
    return [`    ${candidate.key}${status}  ${dim(summaryText)}`];
  }

  const status = statusName ? `  ${statusPill(statusName)}` : '';
  const head = `  ${accent('❯')} ${accentBold(candidate.key)}${status}  ${summaryText}`;

  const branchLine = branch
    ? `      ${dim('↳')} ${accent(branch.name)}`
    : `      ${dim('↳ new')} ${accent(candidate.branchPreview)}`;
  const lines = [head, branchLine];

  const descriptionText = jiraDescriptionToText(issue?.fields.description);
  if (descriptionText) {
    lines.push(
      `      ${dim(shorten(descriptionText.replace(/\s+/g, ' '), Math.max(20, columns - 8)))}`,
    );
  }
  return lines;
};

const candidateForIssue = (
  params: TicketSelectorParams,
  issue: JiraIssue,
  branch: Option.Option<AssociatedBranch>,
): TicketPickerCandidate => {
  const hasBranch = Option.isSome(branch);
  const disabled =
    params.command === 'create' ? hasBranch && !params.reset : !hasBranch;
  return {
    key: issue.key,
    issue: Option.some(issue),
    associatedBranch: branch,
    branchPreview: hasBranch
      ? branch.value.name
      : jiraIssueToBranchName(issue, params.type),
    disabled,
    disabledReason: disabled
      ? Option.some(
          params.command === 'create'
            ? 'branch exists'
            : 'no associated local branch',
        )
      : Option.none(),
  };
};

const candidateForBranch = (
  params: TicketSelectorParams,
  branch: AssociatedBranch,
): TicketPickerCandidate => ({
  key: branch.jiraKey,
  issue: Option.none(),
  associatedBranch: Option.some(branch),
  branchPreview: branch.name,
  disabled: params.command === 'create' && !params.reset,
  disabledReason:
    params.command === 'create' && !params.reset
      ? Option.some('branch exists')
      : Option.none(),
});

// Decides whether a local branch should appear for the current query.
//
//  - On startup (empty query) every local branch is a candidate — for
//    switch/delete the local branches are the actionable set.
//  - A number-only search matches local branches with that issue number in any
//    project, even when it differs from the default prefix (the number is what
//    the user is keying on, not the project).
//  - Otherwise we only match branches in the project the user is explicitly
//    searching; an explicit search for another project must not surface this
//    project's local branches.
const branchMatchesQuery = (
  key: string,
  query: Option.Option<TicketSearchQuery>,
  queryText: string,
): boolean => {
  const trimmed = queryText.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (isNumericInput(trimmed)) {
    const issueNumber = key.match(/-(\d+)$/)?.[1];
    return issueNumber?.startsWith(trimmed) ?? false;
  }
  return Option.match(query, {
    onNone: () => false,
    onSome: ({project, issueNumberPrefix}) =>
      key.startsWith(`${project}-${issueNumberPrefix}`),
  });
};

// --- terminal styling ----------------------------------------------------
// The picker fully repaints each frame, so we style with raw SGR sequences
// for precise control over highlighting, dimming and inline status pills.

const RESET = '\x1B[0m';
const CURSOR = '\x1B[7m \x1B[0m';

const paint = (text: string, ...codes: ReadonlyArray<number>): string =>
  `\x1B[${codes.join(';')}m${text}${RESET}`;

const dim = (text: string): string => paint(text, 2);
const accent = (text: string): string => paint(text, 36);
const accentBold = (text: string): string => paint(text, 36, 1);
const warn = (text: string): string => paint(text, 33, 1);

const keyHint = (key: string, label: string): string =>
  `${accent(key)} ${dim(label)}`;

// Distinct, readable foreground colors for status pills. We avoid mapping
// specific statuses to "meaningful" colors (green = done, etc.) because that
// only works for a hardcoded set of English/German status names; instead we
// hash the status name so the same status always gets the same color while
// different statuses stay visually distinguishable.
const STATUS_COLORS = [36, 32, 33, 35, 34, 91, 92, 93, 95, 96] as const;

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const statusPill = (name: string): string => {
  const fg = STATUS_COLORS[hashString(name) % STATUS_COLORS.length] ?? 36;
  // Bright-black background + bold makes the pill stand out from the row
  // regardless of which foreground color it hashes to.
  return paint(` ${name} `, 100, fg, 1);
};

const escapeJqlValue = (value: string): string =>
  /^[A-Z0-9_]+$/.test(value) ? value : `"${escapeJqlString(value)}"`;

const escapeJqlString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const shorten = (value: string, maxLength: number): string => {
  // Guard against narrow terminals where callers can pass a tiny or negative
  // budget: never slice with a negative length or emit more than the budget.
  const limit = Math.max(0, maxLength);
  if (value.length <= limit) {
    return value;
  }
  return limit <= 3 ? '.'.repeat(limit) : `${value.slice(0, limit - 3)}...`;
};
