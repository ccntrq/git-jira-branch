import {Chunk, Effect, Option} from 'effect';
import {constant, pipe} from 'effect/Function';
import {isNone} from 'effect/Option';

import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {AppConfigService} from './app-config';
import {
  AppConfigError,
  CreatedBranch,
  GitJiraBranchError,
  GitCreateJiraBranchResult,
  JiraIssue,
  JiraIssuetype,
  JiraKeyPrefix,
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
  Effect.gen(function* ($) {
    const [envProvider, gitClient, jiraClient] = yield* $(
      Effect.all([AppConfigService, GitClient, JiraClient]),
    );

    const {defaultJiraKeyPrefix} = yield* $(envProvider.getAppConfig);
    const fullKey = buildJiraKey(defaultJiraKeyPrefix, jiraKey);

    const issue = yield* $(jiraClient.getJiraIssue(fullKey));
    const branchName = jiraIssueToBranchName(issue);

    const branchExists = yield* $(
      Effect.map(gitClient.listBranches(), Chunk.contains(branchName)),
    );

    if (!reset && branchExists) {
      yield* $(gitClient.switchBranch(branchName));
      return SwitchedBranch({branch: branchName});
    }

    const resetBranch = branchExists && reset;

    yield* $(
      Option.match(baseBranch, {
        onNone: constant(gitClient.createGitBranch),
        onSome: gitClient.createGitBranchFrom,
      })(branchName, resetBranch),
    );

    return (resetBranch ? ResetBranch : CreatedBranch)({branch: branchName});
  });

export const ticketUrlForCurrentBranch = (): Effect.Effect<
  string,
  GitJiraBranchError,
  AppConfigService | GitClient
> =>
  Effect.gen(function* ($) {
    const currentBranch = yield* $(
      GitClient,
      Effect.flatMap(({getCurrentBranch}) => getCurrentBranch()),
    );

    const jiraKey = extractJiraKey(currentBranch);

    if (isNone(jiraKey)) {
      return yield* $(
        Effect.fail(
          UsageError({message: 'No Jira Key found in current branch'}),
        ),
      );
    }

    return yield* $(ticketUrl(jiraKey.value));
  });

export const ticketUrl = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  pipe(
    AppConfigService,
    Effect.flatMap(({getAppConfig}) => getAppConfig),
    Effect.map(({defaultJiraKeyPrefix, jiraApiUrl}) =>
      pipe(
        buildJiraKey(defaultJiraKeyPrefix, jiraKey),
        buildTicketUrl(jiraApiUrl),
      ),
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

const buildTicketUrl =
  (jiraApiUrl: string) =>
  (jiraKey: string): string =>
    `${jiraApiUrl}/browse/${jiraKey}`;

const buildJiraKey = (
  defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>,
  jiraKey: string,
): string =>
  jiraKey.match(/^([a-z]+)-(\d+)$/i) || isNone(defaultJiraKeyPrefix)
    ? jiraKey
    : `${defaultJiraKeyPrefix.value}-${jiraKey}`;

const extractJiraKey = (branchName: string): Option.Option<string> => {
  const res = branchName.match(/^(?:\w+\/)?((?:[a-z]+-)?\d+)/i);
  return Option.fromNullable(res?.[1]);
};
