import {Chunk, Effect, Either, Option} from 'effect';
import {itEffect} from './util';

import {gitCreateJiraBranch} from '../src/core';
import {vi, describe, expect, afterEach} from 'vitest';
import {JiraIssue} from '../src/types';
import {
  mockEnvironment,
  mockGitClient,
  mockJiraClient,
  testLayer,
} from './mock-implementations';

const testIssue: JiraIssue = {
  key: 'DUMMYAPP-123',
  fields: {
    summary: 'Dummy isssue summary',
    issuetype: {
      name: 'Feature',
    },
  },
};

describe('core', () => {
  describe('gitCreateJiraBranch', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    itEffect('should create feature branch', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(Effect.succeed(testIssue));

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none()),
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

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );
      }),
    );

    itEffect('should create bugfix branch', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed({
            ...testIssue,
            fields: {
              ...testIssue.fields,
              issuetype: {
                name: 'Bug',
              },
            },
          }),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none()),
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

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'fix/DUMMYAPP-123-dummy-isssue-summary',
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    itEffect('should create feature branch from base branch', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.none()}),
        );
        mockGitClient.createGitBranchFrom.innerMock.mockSuccessValue(undefined);
        mockJiraClient.getJiraIssue.mockReturnValue(Effect.succeed(testIssue));

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.some('master')),
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
        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
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
        );
        expect(mockGitClient.createGitBranch).not.toHaveBeenCalled();
      }),
    );

    itEffect('should switch to existing branch', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockSuccessValue({
          defaultJiraKeyPrefix: Option.none(),
        });
        mockJiraClient.getJiraIssue.mockSuccessValue(testIssue);
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.fromIterable([
            'feat/DUMMYAPP-123-dummy-isssue-summary',
            'master',
          ]),
        );

        const result = yield* $(
          Effect.provide(
            gitCreateJiraBranch('DUMMYAPP-123', Option.none()),
            testLayer,
          ),
        );

        expect(result).toMatchInlineSnapshot(`
          {
            "_tag": "SwitchedBranch",
            "branch": "feat/DUMMYAPP-123-dummy-isssue-summary",
          }
        `);

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
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

    itEffect('should consider defaultJiraKeyPrefix', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('DUMMYAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(Effect.succeed(testIssue));

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('123', Option.none()),
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

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    itEffect('should allow overriding defaultJiraKeyPrefix', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(Effect.succeed(testIssue));

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none()),
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

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );

    itEffect('should handle umlauts and other chars in summary', () =>
      Effect.gen(function* ($) {
        mockEnvironment.getEnv.mockReturnValue(
          Effect.succeed({defaultJiraKeyPrefix: Option.some('OTHERAPP')}),
        );
        mockGitClient.createGitBranch.mockReturnValue(
          Effect.succeed(undefined),
        );
        mockJiraClient.getJiraIssue.mockReturnValue(
          Effect.succeed({
            ...testIssue,
            fields: {
              ...testIssue.fields,
              summary: '  -Öther-Dümmÿ_ißue summäry!',
            },
          }),
        );

        const result = yield* $(
          Effect.either(
            Effect.provide(
              gitCreateJiraBranch('DUMMYAPP-123', Option.none()),
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

        expect(mockEnvironment.getEnv).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledTimes(1);
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledTimes(1);
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-oether-duemm-issue-summaery',
        );
        expect(mockGitClient.createGitBranchFrom).not.toHaveBeenCalled();
      }),
    );
  });
});
