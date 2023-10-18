import { describe, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { Effect, Layer, Stream, Sink, Either } from "effect";

import * as Error from "@effect/platform/Error";
import * as CommandExecutor from "@effect/platform/CommandExecutor";

import { GitClient, GitClientLive } from "../src/git-client";
import { itEffect } from "./util";
import { GitExecError } from "../src/types";
import { TextEncoder } from "util";

const testProg = Effect.gen(function* ($) {
  const gitClient = yield* $(GitClient);
  yield* $(gitClient.createGitBranch("feat/dummy-branch"));
});

const mkTestProcess = (
  exitCode: number,
  stderr?: Uint8Array
): CommandExecutor.Process => ({
  [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  pid: CommandExecutor.ProcessId(1),
  exitCode: Effect.succeed(CommandExecutor.ExitCode(exitCode)),
  isRunning: Effect.succeed(false),
  stderr: stderr ? Stream.make(stderr) : Stream.empty,
  stdout: Stream.empty,
  stdin: Sink.drain,
  kill: () => Effect.unit,
});

describe("GitClient", () => {
  let executorMock: Mock<any, any>;
  let testExecutor: Layer.Layer<never, never, CommandExecutor.CommandExecutor>;
  let testLayer: Layer.Layer<never, never, GitClient>;
  beforeEach(() => {
    executorMock = vi.fn();
    testExecutor = Layer.succeed(
      CommandExecutor.CommandExecutor,
      CommandExecutor.makeExecutor(executorMock)
    );

    testLayer = testExecutor.pipe(Layer.provide(GitClientLive));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  itEffect("should run git command", () =>
    Effect.gen(function* ($) {
      executorMock.mockImplementation((cmd) =>
        Effect.succeed(mkTestProcess(0))
      );

      yield* $(Effect.provide(testProg, testLayer));

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0][0]).toMatchObject({
        _tag: "StandardCommand",
        args: ["checkout", "-b", "feat/dummy-branch"],
        command: "git",
      });
    })
  );

  itEffect("should run git command with given basebranch", () =>
    Effect.gen(function* ($) {
      executorMock.mockImplementation((cmd) =>
        Effect.succeed(mkTestProcess(0))
      );

      yield* $(
        Effect.provide(
          Effect.gen(function* ($) {
            const gitClient = yield* $(GitClient);
            yield* $(
              gitClient.createGitBranchFrom("master")("feat/dummy-branch")
            );
          }),
          testLayer
        )
      );

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0][0]).toMatchObject({
        _tag: "StandardCommand",
        args: ["checkout", "-b", "feat/dummy-branch", "master"],
        command: "git",
      });
    })
  );

  itEffect("should handle git command not found errors", () =>
    Effect.gen(function* ($) {
      const errorMessage = "fatal: Dummy git error";
      const encoder = new TextEncoder();
      executorMock.mockImplementation((cmd) =>
        Effect.succeed(
          mkTestProcess(128, encoder.encode("fatal: Dummy git error"))
        )
      );

      const res = yield* $(Effect.either(Effect.provide(testProg, testLayer)));

      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: `Git command failed with: [${errorMessage}]`,
            })
          ),
        onRight: () =>
          expect.unreachable("Should have returned a GitExecError"),
      });
    })
  );

  itEffect("should handle git errors", () =>
    Effect.gen(function* ($) {
      executorMock.mockImplementation((cmd) => {
        return Effect.fail(
          Error.SystemError({
            message: "git command not found",
            reason: "NotFound",
          } as Error.SystemError)
        );
      });

      const res = yield* $(Effect.either(Effect.provide(testProg, testLayer)));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message:
                "Failed executing `git` command because `git` was not found. Please install `git` and make sure it's on your `$PATH`.",
            })
          ),
        onRight: () =>
          expect.unreachable("Should have returned a GitExecError"),
      });
    })
  );

  itEffect("should handle BadArgument errors", () =>
    Effect.gen(function* ($) {
      executorMock.mockImplementation((cmd) => {
        return Effect.fail(
          Error.BadArgument({
            message: "Dummy Message",
          } as Error.SystemError)
        );
      });

      const res = yield* $(Effect.either(Effect.provide(testProg, testLayer)));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: "Unexpected error during git execution: [Dummy Message]",
            })
          ),
        onRight: () =>
          expect.unreachable("Should have returned a GitExecError"),
      });
    })
  );

  itEffect("should handle command execution platform errors", () =>
    Effect.gen(function* ($) {
      executorMock.mockImplementation((cmd) => {
        return Effect.fail(
          Error.SystemError({
            message: "Fail",
            reason: "Unknown",
          } as Error.SystemError)
        );
      });

      const res = yield* $(Effect.either(Effect.provide(testProg, testLayer)));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: "Unexpected error during git execution: [Unknown Fail]",
            })
          ),
        onRight: () =>
          expect.unreachable("Should have returned a GitExecError"),
      });
    })
  );
});
