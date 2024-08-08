import {Effect, pipe} from 'effect';
import {isNoSuchElementException} from 'effect/Cause';
import type {BranchNotMerged} from '../../schema/branch-not-merged';
import {NoAssociatedBranch} from '../../schema/no-associated-branch';
import type {AppConfigService} from '../../services/app-config';
import {GitClient} from '../../services/git-client';
import {
  type AppConfigError,
  DeletedBranch,
  type GitExecError,
} from '../../types';
import {getAssociatedBranch} from '../../utils/associated-branch';
import {fullJiraKey} from '../../utils/jira-key';

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
