import {Effect, pipe, Option} from 'effect';
import {Effect as EffectNs} from 'effect/Effect';
import {log} from 'effect/Console';

import {cliEffect} from '../src/cli';
import {gitCreateJiraBranch} from '../src/core';

import {vi, describe, afterEach, expect, Mock} from 'vitest';
import {itEffect, toEffectMock} from './util';
import {CreatedBranch, ResetBranch, SwitchedBranch} from '../src/types';
import {testLayer} from './mock-implementations';

vi.mock('../src/core');

vi.mock('effect/Console');

const mockGitCreateJiraBranch = toEffectMock(
  gitCreateJiraBranch as unknown as Mock<
    Parameters<typeof gitCreateJiraBranch>,
    Effect.Effect<
      never,
      EffectNs.Error<ReturnType<typeof gitCreateJiraBranch>>,
      EffectNs.Success<ReturnType<typeof gitCreateJiraBranch>>
    >
  >,
);
const mockLog = toEffectMock(
  log as Mock<Parameters<typeof log>, ReturnType<typeof log>>,
);

describe('cli', () => {
  describe('cliEffect', () => {
    afterEach(() => {
      vi.clearAllMocks();
      mockLog.mockSuccessValue(undefined);
    });

    itEffect('should create branch with single argument', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          CreatedBranch('feat/FOOX-1234-description'),
        );
        mockLog.mockSuccessValue(undefined);
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    itEffect('should inform about branch switch', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          SwitchedBranch('feat/FOOX-1234-description'),
        );
        mockLog.mockSuccessValue(undefined);
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    itEffect('should handle basebranch argument (-b)', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          CreatedBranch('feat/FOOX-1234-description'),
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['FOOX-1234', '-b', 'master']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.some('master'),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    itEffect('should handle reset option (-r)', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          ResetBranch('feat/FOOX-1234-description'),
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['FOOX-1234', '-r']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          true,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    itEffect('should report missing jirakey', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => []),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    itEffect('should print version (--version)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['--version']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls[0]?.[0]).toMatch(
          /git-create-jira-branch v\d+\.\d+\.\d+/,
        );
      }),
    );

    itEffect('should print help (--help)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ['--help']),
              Effect.flatMap(cliEffect),
            ),
            testLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(
          (mockLog.mock.calls[0]?.[0] as string)
            .split(/\n/)
            .slice(3)
            .join('\n'),
        ).toMatchSnapshot();
      }),
    );
  });
});
