import {Effect, Option, pipe} from 'effect';
import {constant} from 'effect/Function';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {JiraClient} from '../../services/jira-client.js';
import {
  type AssociatedBranch,
  CreatedBranch,
  type GitCreateJiraBranchResult,
  type GitJiraBranchError,
  ResetBranch,
  UsageError,
} from '../../types.js';
import {getAssociatedBranch} from '../../utils/associated-branch.js';
import {jiraIssueToBranchName} from '../../utils/jira-issue-branch-name.js';
import {fullJiraKey} from '../../utils/jira-key.js';

export const gitCreateJiraBranch = (
  jiraKey: string,
  type: Option.Option<string>,
  baseBranch: Option.Option<string>,
  reset: boolean,
  preResolvedBranch: Option.Option<AssociatedBranch> = Option.none(),
): Effect.Effect<
  GitCreateJiraBranchResult,
  GitJiraBranchError,
  AppConfigService | GitClient | JiraClient
> =>
  Effect.gen(function* () {
    const [gitClient, jiraClient] = yield* Effect.all([GitClient, JiraClient]);

    const fullKey = yield* fullJiraKey(jiraKey);
    const associatedBranch = Option.isSome(preResolvedBranch)
      ? preResolvedBranch
      : yield* getAssociatedBranch(fullKey);

    if (!reset && Option.isSome(associatedBranch)) {
      yield* Effect.fail(
        UsageError({
          message: `A branch for ticket '${fullKey}' already exists: ${associatedBranch.value.name}`,
        }),
      );
    }

    const branchName = yield* pipe(
      associatedBranch,
      Option.match({
        onNone: () =>
          pipe(
            jiraClient.getJiraIssue(fullKey),
            Effect.map((issue) => jiraIssueToBranchName(issue, type)),
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
