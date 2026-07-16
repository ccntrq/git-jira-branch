import {live} from '@effect/vitest';
import {Chunk, Effect, Option, pipe} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {
  mockAppConfigService,
  mockGitClient,
  resetTestMocks,
  testLayer,
} from '../../test/mock-implementations.js';
import {GitBranch, GitRemoteBranch} from '../../types.js';
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

  live('should switch to remote-only branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.of(GitBranch({name: 'master', isCurrent: false})),
      );
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.of(
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
          }),
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

      // the short name is checked out and git's checkout guessing creates
      // the local tracking branch
      expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
      );
    }),
  );

  live('should prefer local branch over remote-only branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
      });
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.of(
          GitBranch({name: 'feat/DUMMYAPP-123-local', isCurrent: false}),
        ),
      );
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.of(
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-remote',
          }),
        ),
      );

      const result = yield* Effect.provide(
        switchBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(`
          {
            "_tag": "SwitchedBranch",
            "branch": "feat/DUMMYAPP-123-local",
          }
        `);

      expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-local',
      );
      expect(mockGitClient.listRemoteBranches).not.toHaveBeenCalled();
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
