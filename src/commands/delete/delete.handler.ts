import {Effect, pipe} from 'effect';
import {isNoSuchElementException} from 'effect/Cause';
import type {BranchNotMerged} from '../../schema/branch-not-merged.js';
import {NoAssociatedBranch} from '../../schema/no-associated-branch.js';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {
  type AppConfigError,
  DeletedBranch,
  type GitExecError,
} from '../../types.js';
import {getAssociatedBranch} from '../../utils/associated-branch.js';
import {fullJiraKey} from '../../utils/jira-key.js';

export const deleteBranch = (
  jiraKey: string,
  force: boolean,
): Effect.Effect<
  DeletedBranch,
  AppConfigError | GitExecError | NoAssociatedBranch | BranchNotMerged,
  AppConfigService | GitClient
> =>
  pipe(
    jiraKey,
    fullJiraKey,
    Effect.flatMap((jiraKey) =>
      pipe(
        jiraKey,
        getAssociatedBranch,
        Effect.flatten,
        Effect.flatMap((branch) =>
          Effect.flatMap(GitClient, (_) =>
            _.deleteBranch(branch.name, force),
          ).pipe(Effect.map((_) => DeletedBranch({branch: branch.name}))),
        ),
        Effect.catchIf(isNoSuchElementException, () =>
          Effect.fail(
            new NoAssociatedBranch({
              jiraKey,
            }),
          ),
        ),
      ),
    ),
  );
