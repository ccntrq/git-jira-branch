import {Chunk, Effect, Option} from 'effect';
import {constFalse, constant, pipe} from 'effect/Function';
import {isNone} from 'effect/Option';

import {isNoSuchElementException} from 'effect/Cause';
import {AppConfigService} from './app-config';
import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {
  type AppConfigError,
  CreatedBranch,
  type GitBranch,
  type GitCreateJiraBranchResult,
  type GitExecError,
  type GitJiraBranchError,
  type JiraIssue,
  type JiraIssuetype,
  ResetBranch,
  SwitchedBranch,
  UsageError,
} from './types';

export const gitCreateJiraBranch = (
  jiraKey: string,
  baseBranch: Option.Option<string>,
  reset: boolean,
): Effect.Effect<
  GitCreateJiraBranchResult,
  GitJiraBranchError,
  AppConfigService | GitClient | JiraClient
> =>
  Effect.gen(function* () {
    const [gitClient, jiraClient] = yield* Effect.all([GitClient, JiraClient]);

    const fullJiraKey = yield* fullKey(jiraKey);
    const associatedBranch = yield* getAssociatedBranch(fullJiraKey);

    if (!reset && Option.isSome(associatedBranch)) {
      yield* Effect.fail(
        UsageError({
          message: `A branch for ticket '${fullJiraKey}' already exists: ${associatedBranch.value.name}`,
        }),
      );
    }

    const branchName = yield* pipe(
      associatedBranch,
      Option.match({
        onNone: () =>
          pipe(
            jiraClient.getJiraIssue(fullJiraKey),
            Effect.map((issue) => jiraIssueToBranchName(issue)),
          ),
        onSome: (branch) => Effect.succeed(branch.name),
      }),
    );
    const resetBranch = reset && Option.isSome(associatedBranch);
    yield* Option.match(baseBranch, {
      onNone: constant(gitClient.createGitBranch),
      onSome: gitClient.createGitBranchFrom,
    })(branchName, resetBranch);

    return (resetBranch ? ResetBranch : CreatedBranch)({branch: branchName});
  });

export const switchBranch = (
  jiraKey: string,
): Effect.Effect<
  SwitchedBranch,
  GitJiraBranchError,
  AppConfigService | GitClient
> =>
  pipe(
    jiraKey,
    fullKey,
    Effect.flatMap((fullJiraKey) =>
      pipe(
        fullJiraKey,
        getAssociatedBranch,
        Effect.flatten,
        Effect.flatMap((branch) =>
          Effect.flatMap(GitClient, (_) => _.switchBranch(branch.name)).pipe(
            Effect.map((_) => SwitchedBranch({branch: branch.name})),
          ),
        ),
        Effect.catchIf(isNoSuchElementException, () =>
          Effect.fail(
            UsageError({
              message: `No branch associated with Jira ticket '${fullJiraKey}'`,
            }),
          ),
        ),
      ),
    ),
  );

const getJiraKeyFromCurrentBranch = (): Effect.Effect<
  string,
  UsageError | GitExecError,
  GitClient
> =>
  pipe(
    GitClient,
    Effect.flatMap((_) => _.getCurrentBranch()),
    Effect.map(extractJiraKey),
    Effect.flatMap((key) =>
      Option.match({
        onNone: () =>
          Effect.fail(
            UsageError({message: 'No Jira Key found in current branch'}),
          ),
        onSome: (key: string) => Effect.succeed(key),
      })(key),
    ),
  );

export const ticketUrlForCurrentBranch = (): Effect.Effect<
  string,
  GitJiraBranchError,
  AppConfigService | GitClient
> => getJiraKeyFromCurrentBranch().pipe(Effect.flatMap(ticketUrl));

export const ticketUrl = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  pipe(jiraKey, fullKey, Effect.flatMap(buildTicketUrl));

export const ticketInfoForCurrentBranch = () =>
  getJiraKeyFromCurrentBranch().pipe(Effect.flatMap(ticketInfo));

export const ticketInfo = (jiraKey: string) =>
  Effect.gen(function* () {
    const jiraClient = yield* JiraClient;

    const issue = yield* fullKey(jiraKey).pipe(
      Effect.flatMap(jiraClient.getJiraIssue),
    );

    return issue;
  });

export const getAssociatedBranches = (): Effect.Effect<
  Chunk.Chunk<GitBranch>,
  GitExecError,
  GitClient
> =>
  GitClient.pipe(
    Effect.flatMap((_) => _.listBranches()),
    Effect.map((branches) =>
      Chunk.filter(branches, (branch) =>
        Option.isSome(extractJiraKey(branch.name)),
      ),
    ),
  );

const getAssociatedBranch = (fullJiraKey: string) =>
  pipe(
    GitClient,
    Effect.flatMap((_) => _.listBranches()),
    Effect.map(
      Chunk.findFirst((b) =>
        pipe(
          extractJiraKey(b.name),
          Option.map((key) => key === fullJiraKey),
          Option.getOrElse(constFalse),
        ),
      ),
    ),
  );

const fullKey = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  AppConfigService.pipe(
    Effect.flatMap((_) => _.getAppConfig),
    Effect.map(({defaultJiraKeyPrefix}) =>
      jiraKey.match(/^([a-z]+)-(\d+)$/i) || isNone(defaultJiraKeyPrefix)
        ? jiraKey
        : `${defaultJiraKeyPrefix.value}-${jiraKey}`,
    ),
  );

const slugify = (str: string): string =>
  str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const jiraIssueToBranchName = (issue: JiraIssue): string => {
  const branchtype = jiraIssuetypeBranchtype(issue.fields.issuetype);
  return `${branchtype}/${issue.key}-${slugify(issue.fields.summary)}`;
};

const jiraIssuetypeBranchtype = (issuetype: JiraIssuetype): string => {
  if (issuetype.name.match(/bug/i)) {
    return 'fix';
  }

  return 'feat';
};

const buildTicketUrl = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  AppConfigService.pipe(
    Effect.flatMap((_) => _.getAppConfig),
    Effect.map(({jiraApiUrl}) => `${jiraApiUrl}/browse/${jiraKey}`),
  );

function extractJiraKey(branchName: string): Option.Option<string> {
  const res = branchName.match(/^(?:\w+\/)?([A-Z]+-\d+)/);
  return Option.fromNullable(res?.[1]);
}
