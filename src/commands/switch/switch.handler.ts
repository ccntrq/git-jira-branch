import {Chunk, Effect, Option, pipe} from 'effect';
import {NoAssociatedBranch} from '../../schema/no-associated-branch.js';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {type GitJiraBranchError, SwitchedBranch} from '../../types.js';
import {fullJiraKey} from '../../utils/jira-key.js';
import {jiraKeyFromBranch} from '../../utils/jira-key-from-branch.js';

const matchesJiraKey =
  (fullJiraKey: string) =>
  (branchName: string): boolean =>
    pipe(
      jiraKeyFromBranch(branchName),
      Option.map((key) => key === fullJiraKey),
      Option.getOrElse<boolean>(() => false),
    );

export const switchBranch = (
  jiraKey: string,
): Effect.Effect<
  SwitchedBranch,
  GitJiraBranchError | NoAssociatedBranch,
  AppConfigService | GitClient
> =>
  Effect.gen(function* () {
    const resolvedJiraKey = yield* fullJiraKey(jiraKey);
    const gitClient = yield* GitClient;

    const localBranches = yield* gitClient.listBranches();
    const associatedLocalBranch = pipe(
      localBranches,
      Chunk.findFirst((branch) => matchesJiraKey(resolvedJiraKey)(branch.name)),
    );
    if (Option.isSome(associatedLocalBranch)) {
      yield* gitClient.switchBranch(associatedLocalBranch.value.name);
      return SwitchedBranch({
        branch: associatedLocalBranch.value.name,
        trackingSetup: false,
      });
    }

    const remoteBranches = yield* gitClient.listRemoteBranches();
    const associatedRemoteBranch = pipe(
      remoteBranches,
      Chunk.findFirst((branch) => matchesJiraKey(resolvedJiraKey)(branch.name)),
    );
    if (Option.isSome(associatedRemoteBranch)) {
      const localName = associatedRemoteBranch.value.name;
      yield* gitClient.checkoutRemoteTrackingBranch(
        localName,
        `${associatedRemoteBranch.value.remote}/${associatedRemoteBranch.value.name}`,
      );
      return SwitchedBranch({branch: localName, trackingSetup: true});
    }

    return yield* Effect.fail(
      new NoAssociatedBranch({
        jiraKey: resolvedJiraKey,
      }),
    );
  });
