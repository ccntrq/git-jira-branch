import {Chunk, Effect, Option, pipe} from 'effect';
import {constFalse} from 'effect/Function';
import {GitClient} from '../services/git-client';
import type {GitBranch, GitExecError} from '../types';
import {jiraKeyFromBranch} from './jira-key-from-branch';

export const getAssociatedBranches = (): Effect.Effect<
  Chunk.Chunk<GitBranch>,
  GitExecError,
  GitClient
> =>
  GitClient.pipe(
    Effect.flatMap((_) => _.listBranches()),
    Effect.map((branches) =>
      Chunk.filter(branches, (branch) =>
        Option.isSome(jiraKeyFromBranch(branch.name)),
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
