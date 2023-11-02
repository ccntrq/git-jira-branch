import {Chunk, Effect, Option} from 'effect';
import {isNone} from 'effect/Option';

import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {Environment} from './environment';
import {
  CreatedBranch,
  GitCreateJiraBranchError,
  GitCreateJiraBranchResult,
  JiraIssue,
  JiraIssuetype,
  JiraKeyPrefix,
  SwitchedBranch,
} from './types';

export const gitCreateJiraBranch = (
  jiraKey: string,
  baseBranch: Option.Option<string>,
): Effect.Effect<
  Environment | GitClient | JiraClient,
  GitCreateJiraBranchError,
  GitCreateJiraBranchResult
> =>
  Effect.gen(function* ($) {
    const [envProvider, gitClient, jiraClient] = yield* $(
      Effect.all([Environment, GitClient, JiraClient]),
    );

    const {defaultJiraKeyPrefix} = yield* $(envProvider.getEnv());
    const fullKey = buildJiraKey(defaultJiraKeyPrefix, jiraKey);

    const issue = yield* $(jiraClient.getJiraIssue(fullKey));
    const branchName = jiraIssueToBranchName(issue);

    const branchExists = yield* $(
      Effect.map(gitClient.listBranches(), Chunk.contains(branchName)),
    );

    if (branchExists) {
      yield* $(gitClient.switchBranch(branchName));
      return SwitchedBranch(branchName);
    }

    yield* $(
      Option.match(baseBranch, {
        onNone: () => gitClient.createGitBranch,
        onSome: gitClient.createGitBranchFrom,
      })(branchName),
    );

    return CreatedBranch(branchName);
  });

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

const buildJiraKey = (
  defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>,
  jiraKey: string,
): string =>
  jiraKey.match(/^([a-z]+)-(\d+)$/i) || isNone(defaultJiraKeyPrefix)
    ? jiraKey
    : `${defaultJiraKeyPrefix.value}-${jiraKey}`;
