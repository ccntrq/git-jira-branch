import {live} from '@effect/vitest';
import {Chunk, Effect, Option, pipe} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {
  mockAppConfigService,
  mockGitClient,
  testLayer,
} from '../../test/mock-implementations';
import {GitBranch} from '../../types';
import {switchBranch} from './switch.handler';

describe('switchBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  live('should switch to existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );

      const result = yield* Effect.provide(
        switchBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(`
          {
            "_tag": "SwitchedBranch",
            "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          }
        `);

      expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
      );
    }),
  );

  live('should error on non existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['master'].map((name) => GitBranch({name, isCurrent: false})),
        ),
      );

      yield* pipe(
        Effect.provide(switchBranch('DUMMYAPP-123'), testLayer),
        Effect.match({
          onSuccess: () => expect.unreachable('Should have failed'),
          onFailure: (e) => {
            expect(e).toMatchInlineSnapshot(
              `[NoAssociatedBranch: No branch associated with Jira ticket 'DUMMYAPP-123']`,
            );
          },
        }),
      );
    }),
  );
});
