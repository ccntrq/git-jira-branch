import {Effect, pipe} from 'effect';
import {isNoSuchElementException} from 'effect/Cause';
import {NoAssociatedBranch} from '../../schema/no-associated-branch';
import type {AppConfigService} from '../../services/app-config';
import {GitClient} from '../../services/git-client';
import {type GitJiraBranchError, SwitchedBranch} from '../../types';
import {getAssociatedBranch} from '../../utils/associated-branch';
import {fullJiraKey} from '../../utils/jira-key';

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
        Effect.flatMap((branch) =>
          Effect.flatMap(GitClient, (_) => _.switchBranch(branch.name)).pipe(
            Effect.map((_) => SwitchedBranch({branch: branch.name})),
          ),
        ),
        Effect.catchIf(isNoSuchElementException, () =>
          Effect.fail(
            new NoAssociatedBranch({
              jiraKey: fullJiraKey,
            }),
          ),
        ),
      ),
    ),
  );
