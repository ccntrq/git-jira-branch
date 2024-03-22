import {live} from '@effect/vitest';
import {Chunk, Effect, Either, Option} from 'effect';

import {afterEach, describe, expect, vi} from 'vitest';
import {
  gitCreateJiraBranch,
  ticketInfo,
  ticketInfoForCurrentBranch,
  ticketUrl,
  ticketUrlForCurrentBranch,
} from '../src/core';
import {dummyJiraIssue} from './dummies/dummyJiraIssue';
import {
  mockAppConfigService,
  mockGitClient,
  mockJiraClient,
  testLayer,
} from './mock-implementations';

describe('core', () => {
  describe('gitCreateJiraBranch', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    live('should create feature branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none(), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
      }),
    );

    live('should create bugfix branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
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

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none(), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'fix/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    live('should create feature branch from base branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.some('master'), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranchFrom).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranchFrom).toHaveBeenCalledWith(
          'master',
        );
        expect(mockGitClient.createGitBranchFrom()).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranchFrom()).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
        expect(mockGitClient.createGitBranch).not.toHaveBeenCalled();
      }),
    );

    live('should reset existing branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable([
            'feat/DUMMYAPP-123-dummy-isssue-summary',
            'master',
          ]),
        );

        const result = yield* $(
          Effect.provide(
            gitCreateJiraBranch('DUMMYAPP-123', Option.none(), true),
            testLayer,
          ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          true,
        );
      }),
    );

    live('should create branch with reset for non existing branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable(['master']),
        );

        const result = yield* $(
          Effect.provide(
            gitCreateJiraBranch('DUMMYAPP-123', Option.none(), true),
            testLayer,
          ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
      }),
    );

    live('should switch to existing branch', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.none(),
        });
        mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable([
            'feat/DUMMYAPP-123-dummy-isssue-summary',
            'master',
          ]),
        );

        const result = yield* $(
          Effect.provide(
            gitCreateJiraBranch('DUMMYAPP-123', Option.none(), false),
            testLayer,
          ),
        );

        expect(result).toMatchInlineSnapshot(`
          {
            "_tag": "SwitchedBranch",
            "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          }
        `);

        expect(mockAppConfigService.getAppConfig).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.listBranches).toHaveBeenCalledTimes(1);
        expect(mockGitClient.switchBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );
      }),
    );

    live('should consider defaultJiraKeyPrefix', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('DUMMYAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('123', Option.none(), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    live('should allow overriding defaultJiraKeyPrefix', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed(dummyJiraIssue),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none(), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    live('should handle umlauts and other chars in summary', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed({
            ...dummyJiraIssue,
            fields: {
              ...dummyJiraIssue.fields,
              summary: '  -Öther-Dümmÿ_ißue summäry!',
            },
          }),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none(), false),
              testLayer,
            ),
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
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-oether-duemm-issue-summaery',
          false,
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );
  });

  describe('ticketUrl', () => {
    live('should return appropriate url for given ticket key', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.some('MYAPP'),
          jiraApiUrl: 'https://gcjb.atlassian.com',
        });

        const result = yield* $(Effect.provide(ticketUrl('123'), testLayer));

        expect(result).toMatchInlineSnapshot(
          '"https://gcjb.atlassian.com/browse/MYAPP-123"',
        );
      }),
    );
  });

  describe('ticketUrlForCurrentBranch', () => {
    live('should extract ticket from branch an return appropriate url', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.some('MYAPP'),
          jiraApiUrl: 'https://gcjb.atlassian.com',
        });

        mockGitClient.getCurrentBranch.mockSuccessValue(
          'feat/MYAPP-123-dummy-isssue-summary',
        );

        const result = yield* $(
          Effect.provide(ticketUrlForCurrentBranch(), testLayer),
        );

        expect(result).toMatchInlineSnapshot(
          '"https://gcjb.atlassian.com/browse/MYAPP-123"',
        );
      }),
    );
  });

  describe('ticketInfo', () => {
    live('should return info for a given ticket', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
        });

        mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);

        const result = yield* $(Effect.provide(ticketInfo('123'), testLayer));

        expect(mockJiraClient.getJiraIssue).toHaveBeenLastCalledWith(
          'DUMMYAPP-123',
        );
        expect(result).toBe(dummyJiraIssue);
      }),
    );
  });

  describe('ticketInfoForCurrentBranch', () => {
    live('should extract ticket from branch and return issue info', () =>
      Effect.gen(function* ($) {
        mockAppConfigService.getAppConfig.mockSuccessValue({
          defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
        });

        mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);

        mockGitClient.getCurrentBranch.mockSuccessValue(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );

        const result = yield* $(
          Effect.provide(ticketInfoForCurrentBranch(), testLayer),
        );

        expect(mockJiraClient.getJiraIssue).toHaveBeenLastCalledWith(
          'DUMMYAPP-123',
        );
        expect(result).toBe(dummyJiraIssue);
      }),
    );
  });
});
