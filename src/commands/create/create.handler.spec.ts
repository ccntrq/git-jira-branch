import {live} from '@effect/vitest';
import {Chunk, Effect, Either, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {dummyJiraIssue} from '../../test/dummies/dummyJiraIssue';
import {
  mockAppConfigService,
  mockGitClient,
  mockJiraClient,
  testLayer,
} from '../../test/mock-implementations';
import {GitBranch} from '../../types';
import {gitCreateJiraBranch} from './create.handler';

describe('gitCreateJiraBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  live('should create feature branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch(
            'DUMMYAPP-123',
            Option.none(),
            Option.none(),
            false,
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(`
            {
              "_tag": "CreatedBranch",
              "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
            }
          `),
      });

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
    }),
  );

  live('should create bugfix branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed({
          ...dummyJiraIssue,
          fields: {
            ...dummyJiraIssue.fields,
            issuetype: {
              name: 'Bug',
            },
          },
        }),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch(
            'DUMMYAPP-123',
            Option.none(),
            Option.none(),
            false,
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(`
            {
              "_tag": "CreatedBranch",
              "branch": "fix/DUMMYAPP-123-dummy-isssue-summary",
            }
          `),
      });

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'fix/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
      expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
    }),
  );

  live('should use custom type', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );

      yield* Effect.provide(
        gitCreateJiraBranch(
          'DUMMYAPP-123',
          Option.some('custom'),
          Option.none(),
          false,
        ),
        testLayer,
      ).pipe(
        Effect.match({
          onFailure: (e) =>
            expect.unreachable(
              `Should have created branch. Got error instead: ${e}`,
            ),
          onSuccess: (result) =>
            expect(result).toMatchInlineSnapshot(`
              {
                "_tag": "CreatedBranch",
                "branch": "custom/DUMMYAPP-123-dummy-isssue-summary",
              }
            `),
        }),
      );
    }),
  );

  live('should create feature branch from base branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch(
            'DUMMYAPP-123',
            Option.none(),
            Option.some('master'),
            false,
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(
            `
              {
                "_tag": "CreatedBranch",
                "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
              }
            `,
          ),
      });
      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranchFrom).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranchFrom).toHaveBeenCalledWith('master');
      expect(mockGitClient.createGitBranchFrom()).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranchFrom()).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
      expect(mockGitClient.createGitBranch).not.toHaveBeenCalled();
    }),
  );

  live('should reset existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );

      const result = yield* Effect.provide(
        gitCreateJiraBranch('DUMMYAPP-123', Option.none(), Option.none(), true),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(
        `
              {
                "_tag": "ResetBranch",
                "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
              }
            `,
      );

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        true,
      );
    }),
  );

  live('should create branch with reset for non existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
      );
      mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['master'].map((name) => GitBranch({name, isCurrent: false})),
        ),
      );

      const result = yield* Effect.provide(
        gitCreateJiraBranch('DUMMYAPP-123', Option.none(), Option.none(), true),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(
        `
              {
                "_tag": "CreatedBranch",
                "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
              }
            `,
      );

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
    }),
  );

  live('should fail on existing branch', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
      });
      mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-dummy-isssue-summary', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );

      yield* Effect.provide(
        gitCreateJiraBranch(
          'DUMMYAPP-123',
          Option.none(),
          Option.none(),
          false,
        ).pipe(
          Effect.match({
            onSuccess: () => expect.unreachable('Should have failed'),
            onFailure: (e) =>
              expect(e).toMatchInlineSnapshot(`
                {
                  "_tag": "UsageError",
                  "message": "A branch for ticket 'DUMMYAPP-123' already exists: feat/DUMMYAPP-123-dummy-isssue-summary",
                }
              `),
          }),
        ),
        testLayer,
      );
    }),
  );

  live('should consider defaultJiraKeyPrefix', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.some('DUMMYAPP')}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch('123', Option.none(), Option.none(), false),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(
            `
              {
                "_tag": "CreatedBranch",
                "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
              }
            `,
          ),
      });

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
      expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
    }),
  );

  live('should allow overriding defaultJiraKeyPrefix', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed(dummyJiraIssue),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch(
            'DUMMYAPP-123',
            Option.none(),
            Option.none(),
            false,
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(`
              {
                "_tag": "CreatedBranch",
                "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
              }
            `),
      });

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
        false,
      );
      expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
    }),
  );

  live('should handle umlauts and other chars in summary', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
      );
      mockGitClient.createGitBranch.mockReturnValue(Effect.succeed(undefined));
      mockJiraClient.getJiraIssue.mockReturnValue(
        Effect.succeed({
          ...dummyJiraIssue,
          fields: {
            ...dummyJiraIssue.fields,
            summary: '  -Öther-Dümmÿ_ißue summäry!',
          },
        }),
      );

      const result = yield* Effect.either(
        Effect.provide(
          gitCreateJiraBranch(
            'DUMMYAPP-123',
            Option.none(),
            Option.none(),
            false,
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (e) =>
          expect.unreachable(
            `Should have created branch. Got error instead: ${e}`,
          ),
        onRight: (result) =>
          expect(result).toMatchInlineSnapshot(`
            {
              "_tag": "CreatedBranch",
              "branch": "feat/DUMMYAPP-123-oether-duemm-issue-summaery",
            }
          `),
      });

      expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith('DUMMYAPP-123');
      expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
      expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
        'feat/DUMMYAPP-123-oether-duemm-issue-summaery',
        false,
      );
      expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
    }),
  );
});
