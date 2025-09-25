import {live} from '@effect/vitest';
import {Chunk, Effect, Either, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {BranchNotMerged} from '../../schema/branch-not-merged.js';
import {
  mockAppConfigService,
  mockGitClient,
  testLayer,
} from '../../test/mock-implementations.js';
import {GitBranch} from '../../types.js';
import {deleteBranch} from './delete.handler.js';

describe('deleteBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  live('should delete branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.deleteBranch.mockReturnValue(Effect.succeed(undefined));
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );

      const result = yield* Effect.either(
        Effect.provide(deleteBranch('DUMMYAPP-123', false), testLayer),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have deleted branch. Got error instead: ${JSON.stringify(e)}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(`
          {
            "_tag": "DeletedBranch",
            "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          }
        `),
      });
    }),
  );

  live('should error on non merged branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.deleteBranch.mockFailValue(
        new BranchNotMerged({
          branch: 'feat/DUMMYAPP-123-dummy-isssue-summary',
          originalMessage: '',
        }),
      );
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );

      const result = yield* Effect.either(
        Effect.provide(deleteBranch('DUMMYAPP-123', false), testLayer),
      );

      Either.match(result, {
        onLeft: (e) => expect(e).toMatchInlineSnapshot,
        onRight: () => expect.unreachable('Branch deletion should have failed'),
      });
    }),
  );
});
