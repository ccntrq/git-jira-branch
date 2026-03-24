import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import {
  Chunk,
  Context,
  Effect,
  Layer,
  Option,
  pipe,
  Sink,
  Stream,
} from 'effect';

import {catchIf} from 'effect/Effect';
import {BranchNotMerged} from '../schema/branch-not-merged.js';
import {
  GitExecError,
  GitRemote,
  LocalGitBranch,
  RemoteGitBranch,
} from '../types.js';

type GitClientEffect<A, B = never> = Effect.Effect<A, B | GitExecError, never>;

export class GitClient extends Context.Tag('GitClient')<
  GitClient,
  {
    readonly listBranches: () => GitClientEffect<Chunk.Chunk<LocalGitBranch>>;
    readonly listRemoteBranches: () => GitClientEffect<
      Chunk.Chunk<RemoteGitBranch>
    >;
    readonly getCurrentBranch: () => GitClientEffect<string>;
    readonly listRemotes: () => GitClientEffect<ReadonlyArray<GitRemote>>;
    readonly createGitBranch: (
      branchName: string,
      reset: boolean,
    ) => GitClientEffect<void>;
    readonly createGitBranchFrom: (
      baseBranch: string,
    ) => (branchName: string, reset: boolean) => GitClientEffect<void>;
    readonly switchBranch: (branchName: string) => GitClientEffect<void>;
    readonly checkoutRemoteTrackingBranch: (
      branchName: string,
      remoteBranchName: string,
    ) => GitClientEffect<void>;
    readonly deleteBranch: (
      branchName: string,
      force: boolean,
    ) => GitClientEffect<void, BranchNotMerged>;
  }
>() {}

const runGitCommand =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (
    cmd: Command.Command,
    options?: {readonly allowedExitCodes?: ReadonlyArray<number>},
  ) =>
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
        (options?.allowedExitCodes ?? [0]).includes(exitCode)
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
  (): GitClientEffect<Chunk.Chunk<LocalGitBranch>> =>
    pipe(
      Command.make('git', 'branch'),
      (command) => runGitCommand(commandExecutor)(command),
      Effect.map((stdout) =>
        Chunk.fromIterable(
          stdout
            .trim()
            .split('\n')
            .map((x) => x.trim())
            .map((x) =>
              x.startsWith('*')
                ? LocalGitBranch({
                    name: x.replace(/^\*\s+/, ''),
                    isCurrent: true,
                  })
                : LocalGitBranch({
                    name: x,
                    isCurrent: false,
                  }),
            ),
        ),
      ),
      Effect.scoped,
    );

const trimLines = (stdout: string): Array<string> =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const takeRemote = (line: string): string | undefined => {
  const [remote] = line.split('/');
  return remote?.length ? remote : undefined;
};

const findDefaultRemote = (lines: Array<string>): string => {
  const headLine = lines.find((line) => line.includes('HEAD ->'));
  const headRemote = headLine ? takeRemote(headLine) : undefined;
  if (headRemote) {
    return headRemote;
  }
  const fallbackLine = lines.find((line) => !line.includes('->'));
  const fallbackRemote = fallbackLine ? takeRemote(fallbackLine) : undefined;
  return fallbackRemote ?? 'origin';
};

const parseRemoteBranch = (line: string): Option.Option<RemoteGitBranch> => {
  if (line.includes('->')) {
    return Option.none();
  }
  const [remote, ...rest] = line.split('/');
  if (!remote || rest.length === 0) {
    return Option.none();
  }
  return Option.some(
    RemoteGitBranch({
      remote,
      name: rest.join('/'),
    }),
  );
};

const reorderByDefaultRemote = (
  branches: Chunk.Chunk<RemoteGitBranch>,
  defaultRemote: string,
): Chunk.Chunk<RemoteGitBranch> => {
  const prioritized = pipe(
    branches,
    Chunk.filter((branch) => branch.remote === defaultRemote),
    Chunk.toReadonlyArray,
  );
  const others = pipe(
    branches,
    Chunk.filter((branch) => branch.remote !== defaultRemote),
    Chunk.toReadonlyArray,
  );
  return Chunk.fromIterable([...prioritized, ...others]);
};

const listRemoteBranches =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (): GitClientEffect<Chunk.Chunk<RemoteGitBranch>> =>
    Effect.gen(function* () {
      const stdout = yield* runGitCommand(commandExecutor)(
        Command.make('git', 'branch', '-r'),
      );
      const lines = trimLines(stdout);
      const defaultRemote = findDefaultRemote(lines);
      const branches = pipe(
        lines,
        Chunk.fromIterable,
        Chunk.filterMap(parseRemoteBranch),
      );
      return reorderByDefaultRemote(branches, defaultRemote);
    });

const getCurrentBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (): GitClientEffect<string> =>
    pipe(
      Command.make('git', 'branch', '--show-current'),
      (command) => runGitCommand(commandExecutor)(command),
      Effect.map((stdout) => stdout.trim()),
      Effect.scoped,
    );

const listRemotes =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (): GitClientEffect<ReadonlyArray<GitRemote>> =>
    pipe(
      Command.make('git', 'config', '--get-regexp', '^remote\\..*\\.url$'),
      (command) =>
        runGitCommand(commandExecutor)(command, {allowedExitCodes: [0, 1]}),
      Effect.map((stdout) =>
        stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => line.trim().split(/\s+/, 2))
          .map(([key, url]) => {
            const match = key?.match(/^remote\.(.+)\.url$/);
            const name = match?.[1];
            return name && url ? GitRemote({name, url}) : null;
          })
          .filter((remote): remote is GitRemote => remote !== null),
      ),
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
      (command) => runGitCommand(commandExecutor)(command),
      Effect.flatMap(() => Effect.void),
      Effect.scoped,
    );

const createGitBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (branchName: string, reset: boolean): GitClientEffect<void> =>
    pipe(
      Command.make('git', 'checkout', reset ? '-B' : '-b', branchName),
      (command) => runGitCommand(commandExecutor)(command),
      Effect.flatMap(() => Effect.void),
      Effect.scoped,
    );

const switchBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (branchName: string): GitClientEffect<void> =>
    pipe(
      Command.make('git', 'checkout', branchName),
      (command) => runGitCommand(commandExecutor)(command),
      Effect.flatMap(() => Effect.void),
      Effect.scoped,
    );

const checkoutRemoteTrackingBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (branchName: string, remoteBranchName: string): GitClientEffect<void> =>
    pipe(
      Command.make(
        'git',
        'checkout',
        '-b',
        branchName,
        '--track',
        remoteBranchName,
      ),
      runGitCommand(commandExecutor),
      Effect.flatMap(() => Effect.void),
      Effect.scoped,
    );

const deleteBranch =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (
    branchName: string,
    force: boolean,
  ): GitClientEffect<void, BranchNotMerged> =>
    pipe(
      Command.make('git', 'branch', force ? '-D' : '-d', branchName),
      (command) => runGitCommand(commandExecutor)(command),
      catchIf(
        (e) => !!e.message.match(/is not fully merged/),
        (e) =>
          Effect.fail(
            new BranchNotMerged({
              originalMessage: e.message,
              branch: branchName,
            }),
          ),
      ),
      Effect.flatMap(() => Effect.void),
      Effect.scoped,
    );

export const GitClientLive = Layer.effect(
  GitClient,
  Effect.map(CommandExecutor.CommandExecutor, (commandExecutor) =>
    GitClient.of({
      listBranches: listBranches(commandExecutor),
      listRemoteBranches: listRemoteBranches(commandExecutor),
      getCurrentBranch: getCurrentBranch(commandExecutor),
      listRemotes: listRemotes(commandExecutor),
      createGitBranchFrom: createGitBranchFrom(commandExecutor),
      createGitBranch: createGitBranch(commandExecutor),
      switchBranch: switchBranch(commandExecutor),
      checkoutRemoteTrackingBranch:
        checkoutRemoteTrackingBranch(commandExecutor),
      deleteBranch: deleteBranch(commandExecutor),
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
