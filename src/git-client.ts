import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Chunk, Context, Effect, Layer, Sink, Stream, pipe} from 'effect';

import {GitExecError} from './types';

type GitClientEffect<A> = Effect.Effect<A, GitExecError, never>;

export class GitClient extends Context.Tag('GitClient')<
  GitClient,
  {
    readonly listBranches: () => GitClientEffect<Chunk.Chunk<string>>;
    readonly getCurrentBranch: () => GitClientEffect<string>;
    readonly createGitBranch: (
      branchName: string,
      reset: boolean,
    ) => GitClientEffect<void>;
    readonly createGitBranchFrom: (
      baseBranch: string,
    ) => (branchName: string, reset: boolean) => GitClientEffect<void>;
    readonly switchBranch: (branchName: string) => GitClientEffect<void>;
  }
>() {}

const runGitCommand =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (cmd: Command.Command) =>
    pipe(
      cmd,
      commandExecutor.start,
      Effect.flatMap((process) =>
        Effect.all({
          stdout: streamToString(process.stdout),
          stderr: streamToString(process.stderr),
          exitCode: process.exitCode,
        }),
      ),
      Effect.flatMap(({stderr, exitCode, stdout}) =>
        exitCode === 0
          ? Effect.succeed(stdout)
          : Effect.fail(
              GitExecError({
                message: `Git command failed with: [${stderr.trimEnd()}]`,
              }),
            ),
      ),
      Effect.catchTag('SystemError', (e) =>
        Effect.fail(
          GitExecError({
            message:
              e.reason === 'NotFound'
                ? "Failed executing `git` command because `git` was not found. Please install `git` and make sure it's on your `$PATH`."
                : `Unexpected error during git execution: [${e.reason} ${e.message}]`,
          }),
        ),
      ),
      Effect.catchTag('BadArgument', (e) =>
        Effect.fail(
          GitExecError({
            message: `Unexpected error during git execution: [${e.message}]`,
          }),
        ),
      ),
      Effect.scoped,
    );

const listBranches =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (): GitClientEffect<Chunk.Chunk<string>> =>
    pipe(
      Command.make('git', 'branch'),
      runGitCommand(commandExecutor),
      Effect.map((stdout) =>
        Chunk.fromIterable(
          stdout
            .trim()
            .split('\n')
            .map((x) => x.trim())
            .map((x) => x.replace(/^\*\s+/, '')),
        ),
      ),
      Effect.scoped,
    );

const getCurrentBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (): GitClientEffect<string> =>
    pipe(
      Command.make('git', 'branch', '--show-current'),
      runGitCommand(commandExecutor),
      Effect.map((stdout) => stdout.trim()),
      Effect.scoped,
    );

const createGitBranchFrom =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (baseBranch: string) =>
  (branchName: string, reset: boolean): GitClientEffect<void> =>
    pipe(
      Command.make(
        'git',
        'checkout',
        reset ? '-B' : '-b',
        branchName,
        '--no-track',
        baseBranch,
      ),
      runGitCommand(commandExecutor),
      Effect.flatMap(() => Effect.unit),
      Effect.scoped,
    );

const createGitBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (branchName: string, reset: boolean): GitClientEffect<void> =>
    pipe(
      Command.make('git', 'checkout', reset ? '-B' : '-b', branchName),
      runGitCommand(commandExecutor),
      Effect.flatMap(() => Effect.unit),
      Effect.scoped,
    );

const switchBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (branchName: string): GitClientEffect<void> =>
    pipe(
      Command.make('git', 'checkout', branchName),
      runGitCommand(commandExecutor),
      Effect.flatMap(() => Effect.unit),
      Effect.scoped,
    );

export const GitClientLive = Layer.effect(
  GitClient,
  Effect.map(CommandExecutor.CommandExecutor, (commandExecutor) =>
    GitClient.of({
      listBranches: listBranches(commandExecutor),
      getCurrentBranch: getCurrentBranch(commandExecutor),
      createGitBranchFrom: createGitBranchFrom(commandExecutor),
      createGitBranch: createGitBranch(commandExecutor),
      switchBranch: switchBranch(commandExecutor),
    }),
  ),
);

const streamToString = <E>(
  stream: Stream.Stream<Uint8Array, E>,
): Effect.Effect<string, E> => {
  const decoder = new TextDecoder('utf-8');
  return Effect.map(Stream.run(stream, collectUint8Array), (bytes) =>
    decoder.decode(bytes),
  );
};

const collectUint8Array: Sink.Sink<Uint8Array, Uint8Array> =
  Sink.foldLeftChunks(
    new Uint8Array(),
    (bytes, chunk: Chunk.Chunk<Uint8Array>) =>
      Chunk.reduce(chunk, bytes, (acc, curr) => {
        const newArray = new Uint8Array(acc.length + curr.length);
        newArray.set(acc);
        newArray.set(curr, acc.length);
        return newArray;
      }),
  );
