import {Chunk, Effect, Option, pipe} from 'effect';
import {constFalse} from 'effect/Function';
import {GitClient} from '../services/git-client.js';
import {AssociatedBranch, type GitExecError} from '../types.js';
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
          AssociatedBranch({...branch, jiraKey}),
        ),
      ),
    ),
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
