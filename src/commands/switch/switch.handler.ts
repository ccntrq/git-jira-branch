import {Chunk, Effect, Option, pipe} from 'effect';
import {NoAssociatedBranch} from '../../schema/no-associated-branch.js';
import type {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {
  type GitJiraBranchError,
  type RemoteGitBranch,
  SwitchedBranch,
  UsageError,
} from '../../types.js';
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

const formatRemoteBranchRef = (branch: RemoteGitBranch): string =>
  `${branch.remote}/${branch.name}`;

const ambiguousRemoteBranchesError = (
  jiraKey: string,
  branches: Chunk.Chunk<RemoteGitBranch>,
): UsageError =>
  UsageError({
    message: [
      `Jira ticket '${jiraKey}' matched multiple remote tracking branches:`,
      pipe(
        branches,
        Chunk.map(formatRemoteBranchRef),
        Chunk.toReadonlyArray,
        (refs) => refs.join(', '),
      ),
      'Set `checkout.defaultRemote` or remove the ambiguity.',
    ].join(' '),
  });

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
    const associatedRemoteBranches = pipe(
      remoteBranches,
      Chunk.filter((branch) => matchesJiraKey(resolvedJiraKey)(branch.name)),
    );

    if (Chunk.isEmpty(associatedRemoteBranches)) {
      return yield* Effect.fail(
        new NoAssociatedBranch({
          jiraKey: resolvedJiraKey,
        }),
      );
    }

    let associatedRemoteBranch: RemoteGitBranch;
    if (Chunk.size(associatedRemoteBranches) === 1) {
      associatedRemoteBranch = Chunk.unsafeGet(associatedRemoteBranches, 0);
    } else {
      const defaultRemote = yield* gitClient.getCheckoutDefaultRemote();
      if (Option.isNone(defaultRemote)) {
        return yield* Effect.fail(
          ambiguousRemoteBranchesError(
            resolvedJiraKey,
            associatedRemoteBranches,
          ),
        );
      }

      const defaultRemoteMatches = pipe(
        associatedRemoteBranches,
        Chunk.filter((branch) => branch.remote === defaultRemote.value),
      );
      if (Chunk.size(defaultRemoteMatches) !== 1) {
        return yield* Effect.fail(
          ambiguousRemoteBranchesError(
            resolvedJiraKey,
            associatedRemoteBranches,
          ),
        );
      }

      associatedRemoteBranch = Chunk.unsafeGet(defaultRemoteMatches, 0);
    }
    const localName = associatedRemoteBranch.name;
    yield* gitClient.checkoutRemoteTrackingBranch(
      localName,
      `${associatedRemoteBranch.remote}/${associatedRemoteBranch.name}`,
    );
    return SwitchedBranch({branch: localName, trackingSetup: true});
  });
