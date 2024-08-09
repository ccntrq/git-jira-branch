import {live} from '@effect/vitest';
import {Effect, pipe} from 'effect';

import {cliEffect} from './cli';

import {afterEach, describe, expect, vi} from 'vitest';
import {cliTestLayer} from './test/mock-implementations';

const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

const withBaseArgs = (args: Array<string>): Effect.Effect<Array<string>> =>
  Effect.sync(() => ['node', 'git-jira-branch', ...args]);

describe('cli', () => {
  describe('main command', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    live('should print version (--version)', () =>
      Effect.gen(function* () {
        yield* Effect.provide(
          pipe(withBaseArgs(['--version']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockLog.mock.calls[0]?.[0]).toMatch(/\d+\.\d+\.\d+/);
      }),
    );

    live('should print help (--help)', () =>
      Effect.gen(function* () {
        yield* Effect.provide(
          pipe(withBaseArgs(['--help']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

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
