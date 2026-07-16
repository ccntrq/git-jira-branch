import {Effect, pipe} from 'effect';
import {isNoSuchElementException} from 'effect/Cause';
import {NoAssociatedBranch} from '../../schema/no-associated-branch.js';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {type GitJiraBranchError, SwitchedBranch} from '../../types.js';
import {
  getAssociatedBranch,
  getAssociatedRemoteBranch,
} from '../../utils/associated-branch.js';
import {fullJiraKey} from '../../utils/jira-key.js';

export const switchBranchByName = (
  branchName: string,
): Effect.Effect<SwitchedBranch, GitJiraBranchError, GitClient> =>
  Effect.flatMap(GitClient, (_) => _.switchBranch(branchName)).pipe(
    Effect.map(() => SwitchedBranch({branch: branchName})),
  );

export const switchBranch = (
  jiraKey: string,
): Effect.Effect<
  SwitchedBranch,
  GitJiraBranchError | NoAssociatedBranch,
  AppConfigService | GitClient
> =>
  pipe(
    jiraKey,
    fullJiraKey,
    Effect.flatMap((fullJiraKey) =>
      pipe(
        fullJiraKey,
        getAssociatedBranch,
        Effect.flatten,
        Effect.flatMap((branch) => switchBranchByName(branch.name)),
        Effect.catchIf(isNoSuchElementException, () =>
          switchToRemoteAssociatedBranch(fullJiraKey),
        ),
      ),
    ),
  );

// Switching to a branch that only exists on a remote uses the branch's short
// name and relies on git's own checkout guessing (`checkout.guess`, on by
// default) to create the local tracking branch — the same behavior as
// `git switch <name>`.
const switchToRemoteAssociatedBranch = (
  fullJiraKey: string,
): Effect.Effect<
  SwitchedBranch,
  GitJiraBranchError | NoAssociatedBranch,
  GitClient
> =>
  pipe(
    fullJiraKey,
    getAssociatedRemoteBranch,
    Effect.flatten,
    Effect.flatMap((remoteBranch) => switchBranchByName(remoteBranch.name)),
    Effect.catchIf(isNoSuchElementException, () =>
      Effect.fail(
        new NoAssociatedBranch({
          jiraKey: fullJiraKey,
        }),
      ),
    ),
  );
