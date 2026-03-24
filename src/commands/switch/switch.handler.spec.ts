import {live} from '@effect/vitest';
import {Chunk, Effect, Option, pipe} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {
  mockAppConfigService,
  mockGitClient,
  resetTestMocks,
  testLayer,
} from '../../test/mock-implementations.js';
import {LocalGitBranch, RemoteGitBranch} from '../../types.js';
import {switchBranch} from './switch.handler.js';

describe('switchBranch', () => {
  beforeEach(() => {
    resetTestMocks();
    vi.clearAllMocks();
  });
  live('should switch to existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            LocalGitBranch({name, isCurrent: false}),
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
            "trackingSetup": false,
          }
        `);

      expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
      );
    }),
  );

  live('should switch to remote branch when not present locally', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['master'].map((name) => LocalGitBranch({name, isCurrent: false})),
        ),
      );
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['origin/feat/DUMMYAPP-123-dummy-isssue-summary'].map(() =>
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'origin',
            }),
          ),
        ),
      );
      mockGitClient.checkoutRemoteTrackingBranch.mockSuccessValue(undefined);

      const result = yield* Effect.provide(
        switchBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "_tag": "SwitchedBranch",
          "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          "trackingSetup": true,
        }
      `);

      expect(mockGitClient.checkoutRemoteTrackingBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        'origin/feat/DUMMYAPP-123-dummy-isssue-summary',
      );
      expect(mockGitClient.switchBranch).not.toHaveBeenCalled();
    }),
  );

  live(
    'should fail when multiple remote branches match and no default remote is configured',
    () =>
      Effect.gen(function* () {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.none(),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable(
            ['master'].map((name) => LocalGitBranch({name, isCurrent: false})),
          ),
        );
        mockGitClient.listRemoteBranches.mockSuccessValue(
          Chunk.fromIterable([
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'origin',
            }),
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'upstream',
            }),
          ]),
        );
        mockGitClient.getCheckoutDefaultRemote.mockSuccessValue(Option.none());

        yield* pipe(
          Effect.provide(switchBranch('DUMMYAPP-123'), testLayer),
          Effect.match({
            onSuccess: () => expect.unreachable('Should have failed'),
            onFailure: (e) => {
              expect(e).toMatchInlineSnapshot(`
              {
                "_tag": "UsageError",
                "message": "Jira ticket 'DUMMYAPP-123' matched multiple remote tracking branches: origin/feat/DUMMYAPP-123-dummy-isssue-summary, upstream/feat/DUMMYAPP-123-dummy-isssue-summary Set \`checkout.defaultRemote\` or remove the ambiguity.",
              }
            `);
            },
          }),
        );

        expect(
          mockGitClient.checkoutRemoteTrackingBranch,
        ).not.toHaveBeenCalled();
        expect(mockGitClient.switchBranch).not.toHaveBeenCalled();
      }),
  );

  live(
    'should prefer the configured default remote when multiple remote branches match',
    () =>
      Effect.gen(function* () {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.none(),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable(
            ['master'].map((name) => LocalGitBranch({name, isCurrent: false})),
          ),
        );
        mockGitClient.listRemoteBranches.mockSuccessValue(
          Chunk.fromIterable([
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'origin',
            }),
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'upstream',
            }),
          ]),
        );
        mockGitClient.getCheckoutDefaultRemote.mockSuccessValue(
          Option.some('origin'),
        );
        mockGitClient.checkoutRemoteTrackingBranch.mockSuccessValue(undefined);

        const result = yield* Effect.provide(
          switchBranch('DUMMYAPP-123'),
          testLayer,
        );

        expect(result).toMatchInlineSnapshot(`
        {
          "_tag": "SwitchedBranch",
          "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          "trackingSetup": true,
        }
      `);

        expect(mockGitClient.checkoutRemoteTrackingBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          'origin/feat/DUMMYAPP-123-dummy-isssue-summary',
        );
        expect(mockGitClient.switchBranch).not.toHaveBeenCalled();
      }),
  );

  live(
    'should fail when configured default remote does not resolve the ambiguity',
    () =>
      Effect.gen(function* () {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.none(),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable(
            ['master'].map((name) => LocalGitBranch({name, isCurrent: false})),
          ),
        );
        mockGitClient.listRemoteBranches.mockSuccessValue(
          Chunk.fromIterable([
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'origin',
            }),
            RemoteGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              remote: 'upstream',
            }),
          ]),
        );
        mockGitClient.getCheckoutDefaultRemote.mockSuccessValue(
          Option.some('fork'),
        );

        yield* pipe(
          Effect.provide(switchBranch('DUMMYAPP-123'), testLayer),
          Effect.match({
            onSuccess: () => expect.unreachable('Should have failed'),
            onFailure: (e) => {
              expect(e).toMatchObject({
                _tag: 'UsageError',
                message: expect.stringContaining(
                  'matched multiple remote tracking branches',
                ),
              });
            },
          }),
        );

        expect(
          mockGitClient.checkoutRemoteTrackingBranch,
        ).not.toHaveBeenCalled();
        expect(mockGitClient.switchBranch).not.toHaveBeenCalled();
      }),
  );

  live('should error on non existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['master'].map((name) => LocalGitBranch({name, isCurrent: false})),
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
