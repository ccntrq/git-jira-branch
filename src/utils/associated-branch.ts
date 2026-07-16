import {Chunk, Effect, Option, pipe} from 'effect';
import {constFalse} from 'effect/Function';
import {GitClient} from '../services/git-client.js';
import {
  AssociatedBranch,
  type GitExecError,
  type GitRemoteBranch,
} from '../types.js';
import {jiraKeyFromBranch} from './jira-key-from-branch.js';

export const getAssociatedBranches = (): Effect.Effect<
  Chunk.Chunk<AssociatedBranch>,
  GitExecError,
  GitClient
> =>
  GitClient.pipe(
    Effect.flatMap((_) => _.listBranches()),
    Effect.map((branches) =>
      Chunk.filterMap(branches, (branch) =>
        Option.map(jiraKeyFromBranch(branch.name), (jiraKey) =>
          AssociatedBranch({...branch, jiraKey, remote: Option.none()}),
        ),
      ),
    ),
  );

/**
 * Local associated branches plus branches that only exist on a remote. Remote
 * branches whose Jira key already has a local branch are dropped (local wins);
 * when the same key exists on multiple remotes, 'origin' is preferred.
 */
export const getAssociatedBranchesIncludingRemote = (): Effect.Effect<
  Chunk.Chunk<AssociatedBranch>,
  GitExecError,
  GitClient
> =>
  Effect.all([getAssociatedBranches(), listAssociatedRemoteBranches()]).pipe(
    Effect.map(([localBranches, remoteBranches]) => {
      const localKeys = new Set(
        Chunk.toReadonlyArray(localBranches).map((branch) => branch.jiraKey),
      );
      const remoteOnlyByKey = new Map<string, [GitRemoteBranch, string]>();
      for (const [branch, jiraKey] of remoteBranches) {
        if (localKeys.has(jiraKey)) {
          continue;
        }
        const existing = remoteOnlyByKey.get(jiraKey);
        if (!existing || preferredRemote(branch, existing[0])) {
          remoteOnlyByKey.set(jiraKey, [branch, jiraKey]);
        }
      }
      const remoteOnly = Chunk.map(
        Chunk.fromIterable(remoteOnlyByKey.values()),
        ([branch, jiraKey]) =>
          AssociatedBranch({
            name: branch.name,
            isCurrent: false,
            jiraKey,
            remote: Option.some(branch.remoteName),
          }),
      );
      // Local branches first: consumers that dedupe by key with first-wins
      // semantics keep the local branch.
      return Chunk.appendAll(localBranches, remoteOnly);
    }),
  );

export const getAssociatedBranch = (fullJiraKey: string) =>
  pipe(
    GitClient,
    Effect.flatMap((_) => _.listBranches()),
    Effect.map(
      Chunk.findFirst((b) =>
        pipe(
          jiraKeyFromBranch(b.name),
          Option.map((key) => key === fullJiraKey),
          Option.getOrElse(constFalse),
        ),
      ),
    ),
  );

export const getAssociatedRemoteBranch = (
  fullJiraKey: string,
): Effect.Effect<Option.Option<GitRemoteBranch>, GitExecError, GitClient> =>
  listAssociatedRemoteBranches().pipe(
    Effect.map((branches) =>
      pipe(
        Chunk.filterMap(branches, ([branch, jiraKey]) =>
          jiraKey === fullJiraKey ? Option.some(branch) : Option.none(),
        ),
        (matches) =>
          Option.orElse(
            Chunk.findFirst(matches, (b) => b.remoteName === 'origin'),
            () => Chunk.head(matches),
          ),
      ),
    ),
  );

const listAssociatedRemoteBranches = (): Effect.Effect<
  Chunk.Chunk<[GitRemoteBranch, string]>,
  GitExecError,
  GitClient
> =>
  GitClient.pipe(
    Effect.flatMap((_) => _.listRemoteBranches()),
    Effect.map(
      Chunk.filterMap((branch) =>
        Option.map(
          jiraKeyFromBranch(branch.name),
          (jiraKey) => [branch, jiraKey] as [GitRemoteBranch, string],
        ),
      ),
    ),
  );

const preferredRemote = (
  candidate: GitRemoteBranch,
  current: GitRemoteBranch,
): boolean =>
  candidate.remoteName === 'origin' && current.remoteName !== 'origin';
