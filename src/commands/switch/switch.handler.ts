import {Effect, pipe} from 'effect';
import {isNoSuchElementException} from 'effect/Cause';
import {NoAssociatedBranch} from '../../schema/no-associated-branch.js';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {type GitJiraBranchError, SwitchedBranch} from '../../types.js';
import {getAssociatedBranch} from '../../utils/associated-branch.js';
import {fullJiraKey} from '../../utils/jira-key.js';

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
