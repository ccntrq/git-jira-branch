import {live} from '@effect/vitest';
import {Chunk, Effect, Option, pipe} from 'effect';
import {afterEach, beforeEach, describe, expect, vi} from 'vitest';
import {cliEffect} from './cli.js';
import {dummyJiraIssue} from './test/dummies/dummyJiraIssue.js';
import {
  cliTestLayer,
  mockGitClient,
  mockJiraClient,
  mockTicketSelector,
  resetTestMocks,
} from './test/mock-implementations.js';
import {AssociatedBranch, GitBranch} from './types.js';

const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

const withBaseArgs = (args: Array<string>): Effect.Effect<Array<string>> =>
  Effect.sync(() => ['node', 'git-jira-branch', ...args]);

describe('cli', () => {
  beforeEach(() => {
    resetTestMocks();
  });

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

  describe('optional jira key commands', () => {
    live('create uses ticket selector when jira key is omitted', () =>
      Effect.gen(function* () {
        mockTicketSelector.selectTicket.mockSuccessValue({
          key: 'DUMMYAPP-123',
          associatedBranch: Option.none(),
        });
        mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);

        yield* Effect.provide(
          pipe(withBaseArgs(['create']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockTicketSelector.selectTicket).toHaveBeenCalledWith({
          command: 'create',
          type: Option.none(),
          reset: false,
        });
        expect(mockJiraClient.getJiraIssue).toHaveBeenCalledWith(
          'DUMMYAPP-123',
        );
        expect(mockGitClient.createGitBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
      }),
    );

    live('switch uses ticket selector when jira key is omitted', () =>
      Effect.gen(function* () {
        mockTicketSelector.selectTicket.mockSuccessValue({
          key: 'DUMMYAPP-123',
          associatedBranch: Option.none(),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.of(
            GitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              isCurrent: false,
            }),
          ),
        );

        yield* Effect.provide(
          pipe(withBaseArgs(['switch']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockTicketSelector.selectTicket).toHaveBeenCalledWith({
          command: 'switch',
          type: Option.none(),
          reset: false,
        });
        expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
        );
      }),
    );

    live('switch uses the branch selected by the picker when available', () =>
      Effect.gen(function* () {
        mockTicketSelector.selectTicket.mockSuccessValue({
          key: 'DUMMYAPP-123',
          associatedBranch: Option.some(
            AssociatedBranch({
              jiraKey: 'DUMMYAPP-123',
              name: 'fix/DUMMYAPP-123-selected-duplicate',
              isCurrent: false,
              remote: Option.none(),
            }),
          ),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.of(
            GitBranch({
              name: 'feat/DUMMYAPP-123-first-duplicate',
              isCurrent: false,
            }),
          ),
        );

        yield* Effect.provide(
          pipe(withBaseArgs(['switch']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockGitClient.switchBranch).toHaveBeenCalledWith(
          'fix/DUMMYAPP-123-selected-duplicate',
        );
        expect(mockGitClient.listBranches).not.toHaveBeenCalled();
      }),
    );

    live('delete uses ticket selector when jira key is omitted', () =>
      Effect.gen(function* () {
        mockTicketSelector.selectTicket.mockSuccessValue({
          key: 'DUMMYAPP-123',
          associatedBranch: Option.none(),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.of(
            GitBranch({
              name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
              isCurrent: false,
            }),
          ),
        );

        yield* Effect.provide(
          pipe(withBaseArgs(['delete']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockTicketSelector.selectTicket).toHaveBeenCalledWith({
          command: 'delete',
          type: Option.none(),
          reset: false,
        });
        expect(mockGitClient.deleteBranch).toHaveBeenCalledWith(
          'feat/DUMMYAPP-123-dummy-isssue-summary',
          false,
        );
      }),
    );

    live('delete uses the branch selected by the picker when available', () =>
      Effect.gen(function* () {
        mockTicketSelector.selectTicket.mockSuccessValue({
          key: 'DUMMYAPP-123',
          associatedBranch: Option.some(
            AssociatedBranch({
              jiraKey: 'DUMMYAPP-123',
              name: 'fix/DUMMYAPP-123-selected-duplicate',
              isCurrent: false,
              remote: Option.none(),
            }),
          ),
        });
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.of(
            GitBranch({
              name: 'feat/DUMMYAPP-123-first-duplicate',
              isCurrent: false,
            }),
          ),
        );

        yield* Effect.provide(
          pipe(withBaseArgs(['delete']), Effect.flatMap(cliEffect)),
          cliTestLayer,
        );

        expect(mockGitClient.deleteBranch).toHaveBeenCalledWith(
          'fix/DUMMYAPP-123-selected-duplicate',
          false,
        );
        expect(mockGitClient.listBranches).not.toHaveBeenCalled();
      }),
    );
  });
});
