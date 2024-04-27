import {live} from '@effect/vitest';
import {Effect, Either, Layer, Sink, Stream} from 'effect';
import {afterEach, beforeEach, describe, expect, vi} from 'vitest';

import * as CommandExecutor from '@effect/platform/CommandExecutor';
import * as PlatformError from '@effect/platform/Error';

import {TextEncoder} from 'node:util';
import type {Command} from '@effect/platform';
import {NodeInspectSymbol} from 'effect/Inspectable';
import {GitClient, GitClientLive} from '../src/git-client';
import {GitExecError} from '../src/types';
import {type EffectMock, effectMock} from './util';

const testProg = Effect.gen(function* () {
  const gitClient = yield* GitClient;
  yield* gitClient.createGitBranch('feat/dummy-branch', false);
});

const mkTestProcess = (
  exitCode: number,
  stdout?: string,
  stderr?: string,
): CommandExecutor.Process => {
  const encoder = new TextEncoder();
  return {
    [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
    [NodeInspectSymbol]: () => 'not implemented',
    pid: CommandExecutor.ProcessId(1),
    exitCode: Effect.succeed(CommandExecutor.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    stderr: stderr ? Stream.make(encoder.encode(stderr)) : Stream.empty,
    stdout: stdout ? Stream.make(encoder.encode(stdout)) : Stream.empty,
    stdin: Sink.drain,
    kill: () => Effect.void,
    toJSON: () => 'not implemented',
    toString: () => 'not implemented',
  };
};

describe('GitClient', () => {
  let executorMock: EffectMock<
    [Command.Command],
    CommandExecutor.Process,
    PlatformError.SystemError | PlatformError.BadArgument
  >;
  let testExecutor: Layer.Layer<CommandExecutor.CommandExecutor>;
  let testLayer: Layer.Layer<GitClient>;
  beforeEach(() => {
    executorMock = effectMock();
    testExecutor = Layer.succeed(
      CommandExecutor.CommandExecutor,
      CommandExecutor.makeExecutor(executorMock),
    );

    testLayer = GitClientLive.pipe(Layer.provide(testExecutor));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  live('createGitBranch should run appropriate git command', () =>
    Effect.gen(function* () {
      executorMock.mockSuccessValueOnce(mkTestProcess(0));

      yield* Effect.provide(testProg, testLayer);

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['checkout', '-b', 'feat/dummy-branch'],
        command: 'git',
      });
    }),
  );

  live('createGitBranch should run appropriate git command (with reset)', () =>
    Effect.gen(function* () {
      executorMock.mockSuccessValueOnce(mkTestProcess(0));

      yield* Effect.provide(
        Effect.gen(function* () {
          const gitClient = yield* GitClient;
          yield* gitClient.createGitBranch('feat/dummy-branch', true);
        }),
        testLayer,
      );

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['checkout', '-B', 'feat/dummy-branch'],
        command: 'git',
      });
    }),
  );

  live('createGitBranchFrom should run git command with given basebranch', () =>
    Effect.gen(function* () {
      executorMock.mockSuccessValueOnce(mkTestProcess(0));

      yield* Effect.provide(
        Effect.gen(function* () {
          const gitClient = yield* GitClient;
          yield* gitClient.createGitBranchFrom('master')(
            'feat/dummy-branch',
            false,
          );
        }),
        testLayer,
      );

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['checkout', '-b', 'feat/dummy-branch', '--no-track', 'master'],
        command: 'git',
      });
    }),
  );

  live(
    'createGitBranchFrom should run appropriate git command (with reset)',
    () =>
      Effect.gen(function* () {
        executorMock.mockSuccessValueOnce(mkTestProcess(0));

        yield* Effect.provide(
          Effect.gen(function* () {
            const gitClient = yield* GitClient;
            yield* gitClient.createGitBranchFrom('master')(
              'feat/dummy-branch',
              true,
            );
          }),
          testLayer,
        );

        expect(executorMock).toHaveBeenCalledTimes(1);
        expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
          _tag: 'StandardCommand',
          args: ['checkout', '-B', 'feat/dummy-branch', '--no-track', 'master'],
          command: 'git',
        });
      }),
  );

  live('listBranch should run appropriate git command and parse output', () =>
    Effect.gen(function* () {
      const commandOutput = `  * 7-switch-to-existing-branches
  chore/enforce-conventional-commits
  develop
  feat/MYAPP-1235-add-some-feature
  fix/MYAPP-1234-errorhandling
  master
    `;
      executorMock.mockSuccessValueOnce(mkTestProcess(0, commandOutput));

      const result = yield* Effect.provide(
        Effect.flatMap(GitClient, (gc) => gc.listBranches()),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "_id": "Chunk",
          "values": [
            {
              "isCurrent": true,
              "name": "7-switch-to-existing-branches",
            },
            {
              "isCurrent": false,
              "name": "chore/enforce-conventional-commits",
            },
            {
              "isCurrent": false,
              "name": "develop",
            },
            {
              "isCurrent": false,
              "name": "feat/MYAPP-1235-add-some-feature",
            },
            {
              "isCurrent": false,
              "name": "fix/MYAPP-1234-errorhandling",
            },
            {
              "isCurrent": false,
              "name": "master",
            },
          ],
        }
      `);

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['branch'],
        command: 'git',
      });
    }),
  );

  live('switchBranch should run appropriate git command', () =>
    Effect.gen(function* () {
      executorMock.mockSuccessValueOnce(mkTestProcess(0));

      yield* Effect.provide(
        Effect.flatMap(GitClient, (gc) => gc.switchBranch('feat/dummy-branch')),
        testLayer,
      );

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['checkout', 'feat/dummy-branch'],
        command: 'git',
      });
    }),
  );

  live('getCurrentBranch should run appropriate git command', () =>
    Effect.gen(function* () {
      executorMock.mockSuccessValueOnce(mkTestProcess(0));

      yield* Effect.provide(
        Effect.flatMap(GitClient, (gc) => gc.getCurrentBranch()),
        testLayer,
      );

      expect(executorMock).toHaveBeenCalledTimes(1);
      expect(executorMock.mock.calls[0]?.[0]).toMatchObject({
        _tag: 'StandardCommand',
        args: ['branch', '--show-current'],
        command: 'git',
      });
    }),
  );

  live('should handle git command not found errors', () =>
    Effect.gen(function* () {
      const errorMessage = 'fatal: Dummy git error';
      executorMock.mockSuccessValueOnce(
        mkTestProcess(128, undefined, errorMessage),
      );

      const res = yield* Effect.either(Effect.provide(testProg, testLayer));

      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: `Git command failed with: [${errorMessage}]`,
            }),
          ),
        onRight: () =>
          expect.unreachable('Should have returned a GitExecError'),
      });
    }),
  );

  live('should handle git errors', () =>
    Effect.gen(function* () {
      executorMock.mockFailValue(
        PlatformError.SystemError({
          message: 'git command not found',
          reason: 'NotFound',
        } as PlatformError.SystemError),
      );

      const res = yield* Effect.either(Effect.provide(testProg, testLayer));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message:
                "Failed executing `git` command because `git` was not found. Please install `git` and make sure it's on your `$PATH`.",
            }),
          ),
        onRight: () =>
          expect.unreachable('Should have returned a GitExecError'),
      });
    }),
  );

  live('should handle BadArgument errors', () =>
    Effect.gen(function* () {
      executorMock.mockFailValue(
        PlatformError.BadArgument({
          message: 'Dummy Message',
        } as PlatformError.BadArgument),
      );

      const res = yield* Effect.either(Effect.provide(testProg, testLayer));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: 'Unexpected error during git execution: [Dummy Message]',
            }),
          ),
        onRight: () =>
          expect.unreachable('Should have returned a GitExecError'),
      });
    }),
  );

  live('should handle command execution platform errors', () =>
    Effect.gen(function* () {
      executorMock.mockFailValue(
        PlatformError.SystemError({
          message: 'Fail',
          reason: 'Unknown',
        } as PlatformError.SystemError),
      );

      const res = yield* Effect.either(Effect.provide(testProg, testLayer));
      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchObject(
            GitExecError({
              message: 'Unexpected error during git execution: [Unknown Fail]',
            }),
          ),
        onRight: () =>
          expect.unreachable('Should have returned a GitExecError'),
      });
    }),
  );
});
