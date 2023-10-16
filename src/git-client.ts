import { Chunk, Context, Effect, Layer, Sink, Stream } from "effect";
import * as Command from "@effect/platform/Command";
import * as CommandExecutor from "@effect/platform/CommandExecutor";

import { GitExecError } from "./types";

type GitClientEffect<A> = Effect.Effect<never, GitExecError, A>;

export interface GitClient {
  readonly createGitBranch: (branchName: string) => GitClientEffect<void>;
  readonly createGitBranchFrom: (
    baseBranch: string
  ) => (branchName: string) => GitClientEffect<void>;
}

export const GitClient = Context.Tag<GitClient>();

const createGitBranchFrom =
  (commandExecutor: CommandExecutor.CommandExecutor) =>
  (baseBranch: string) =>
  (branchName: string): GitClientEffect<void> => {
    const cmd = baseBranch
      ? Command.make("git", "checkout", "-b", branchName, baseBranch)
      : Command.make("git", "checkout", "-b", branchName);
    return commandExecutor.start(cmd).pipe(
      Effect.flatMap((process) =>
        Effect.all({
          stderr: toString(process.stderr),
          exitCode: process.exitCode,
        })
      ),
      Effect.flatMap(({ stderr, exitCode }) =>
        exitCode === 0
          ? Effect.succeed(void 0)
          : Effect.fail(
              GitExecError({
                message: `Git command failed with: [${stderr.trimEnd()}]`,
              })
            )
      ),
      Effect.catchTag("SystemError", (e) =>
        Effect.fail(
          GitExecError({
            message:
              e.reason === "NotFound"
                ? "Failed executing `git` command because `git` was not found. Please install `git` and make sure it's on your `$PATH`."
                : `Unexpected error during git execution: [${e.reason} ${e.message}]`,
          })
        )
      ),
      Effect.catchTag("BadArgument", (e) =>
        Effect.fail(
          GitExecError({
            message: `Unexpected error during git execution: [${e.message}]`,
          })
        )
      )
    );
  };

export const GitClientLive = Layer.effect(
  GitClient,
  CommandExecutor.CommandExecutor.pipe(
    Effect.map((commandExecutor) =>
      GitClient.of({
        createGitBranchFrom: createGitBranchFrom(commandExecutor),
        createGitBranch: createGitBranchFrom(commandExecutor)(""),
      })
    )
  )
);

const toString = <E>(stream: Stream.Stream<never, E, Uint8Array>) => {
  const decoder = new TextDecoder("utf-8");
  return Effect.map(Stream.run(stream, collectUint8Array), (bytes) =>
    decoder.decode(bytes)
  );
};

const collectUint8Array: Sink.Sink<
  never,
  never,
  Uint8Array,
  never,
  Uint8Array
> = Sink.foldLeftChunks(
  new Uint8Array(),
  (bytes, chunk: Chunk.Chunk<Uint8Array>) =>
    Chunk.reduce(chunk, bytes, (acc, curr) => {
      const newArray = new Uint8Array(acc.length + curr.length);
      newArray.set(acc);
      newArray.set(curr, acc.length);
      return newArray;
    })
);
