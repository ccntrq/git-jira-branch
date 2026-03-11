import {live} from '@effect/vitest';
import {Effect, Either, Option, pipe} from 'effect';
import {afterEach, describe, expect, vi} from 'vitest';

import {cliEffect} from '../../cli.js';
import {
  cliTestLayer,
  mockAppConfigService,
  mockGitClient,
  mockGitHubClient,
  resetTestMocks,
} from '../../test/mock-implementations.js';
import {GitRemote} from '../../types.js';

const withBaseArgs = (args: Array<string>): Effect.Effect<Array<string>> =>
  Effect.sync(() => ['node', 'git-jira-branch', ...args]);

describe('link-pr command', () => {
  afterEach(() => {
    resetTestMocks();
    vi.clearAllMocks();
  });

  live('passes `all` scan limit overrides through the CLI', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([]);

      yield* Effect.provide(
        pipe(
          withBaseArgs(['link-pr', 'DUMMYAPP-123', '--scan-limit', 'all']),
          Effect.flatMap(cliEffect),
        ),
        cliTestLayer,
      );

      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-123',
        displayRepoName: 'repo',
        scanLimit: 'all',
      });
    }),
  );

  live('passes the remote override through the CLI', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:fork/repo.git',
        }),
        GitRemote({
          name: 'upstream',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([]);

      yield* Effect.provide(
        pipe(
          withBaseArgs(['link-pr', 'DUMMYAPP-123', '--remote', 'origin']),
          Effect.flatMap(cliEffect),
        ),
        cliTestLayer,
      );

      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'fork',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-123',
        displayRepoName: 'repo',
        scanLimit: 500,
      });
    }),
  );

  live('passes the repo override through the CLI', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.listRemotes.mockSuccessValue([]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([]);

      yield* Effect.provide(
        pipe(
          withBaseArgs(['link-pr', 'DUMMYAPP-123', '--repo', 'owner/repo']),
          Effect.flatMap(cliEffect),
        ),
        cliTestLayer,
      );

      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-123',
        displayRepoName: 'repo',
        scanLimit: 500,
      });
    }),
  );

  live('fails when both repository overrides are passed through the CLI', () =>
    Effect.gen(function* () {
      const result = yield* Effect.provide(
        pipe(
          withBaseArgs([
            'link-pr',
            'DUMMYAPP-123',
            '--remote',
            'origin',
            '--repo',
            'owner/repo',
          ]),
          Effect.flatMap(cliEffect),
          Effect.either,
        ),
        cliTestLayer,
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual({
            _tag: 'UsageError',
            message: 'Pass either `--remote` or `--repo`, not both.',
          }),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('passes the provider override through the CLI', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);

      yield* Effect.provide(
        pipe(
          withBaseArgs(['link-pr', 'DUMMYAPP-123', '--provider', 'gitlab']),
          Effect.flatMap(cliEffect),
          Effect.either,
        ),
        cliTestLayer,
      ).pipe(
        Effect.map((result) =>
          Either.match(result, {
            onLeft: (error) =>
              expect(error).toEqual({
                _tag: 'UsageError',
                message: 'Unsupported provider: gitlab',
              }),
            onRight: () => expect.unreachable('Should have failed'),
          }),
        ),
      );
    }),
  );
});
