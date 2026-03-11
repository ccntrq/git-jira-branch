import {live} from '@effect/vitest';
import {Effect, Either, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';

import {
  mockAppConfigService,
  mockGitClient,
  mockGitHubClient,
  mockJiraClient,
  resetTestMocks,
  testLayer,
} from '../../test/mock-implementations.js';
import {
  AppConfigError,
  GitRemote,
  JiraRemoteLink,
  UsageError,
} from '../../types.js';
import {linkPullRequestsForCurrentBranch} from './link-pr.handler.js';

describe('linkPullRequestsForCurrentBranch', () => {
  beforeEach(() => {
    resetTestMocks();
    vi.clearAllMocks();
  });

  live('links all matching pull requests for the current branch ticket', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-something',
      );
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([
        {
          number: 1,
          htmlUrl: 'https://github.com/owner/repo/pull/1',
          displayRepoName: 'repo',
        },
        {
          number: 2,
          htmlUrl: 'https://github.com/owner/repo/pull/2',
          displayRepoName: 'repo',
        },
      ]);
      mockJiraClient.listRemoteLinks.mockSuccessValue([]);

      const result = yield* Effect.provide(
        linkPullRequestsForCurrentBranch(undefined, undefined),
        testLayer,
      );

      expect(result).toEqual({
        _tag: 'LinkedPullRequests',
        jiraKey: 'DUMMYAPP-123',
        repository: 'owner/repo',
        linked: 2,
        skipped: 0,
        results: [
          {
            number: 1,
            url: 'https://github.com/owner/repo/pull/1',
            action: 'linked',
          },
          {
            number: 2,
            url: 'https://github.com/owner/repo/pull/2',
            action: 'linked',
          },
        ],
      });
      expect(mockJiraClient.createRemoteLink).toHaveBeenCalledTimes(2);
      expect(mockJiraClient.createRemoteLink).toHaveBeenCalledWith(
        'DUMMYAPP-123',
        JiraRemoteLink({
          url: 'https://github.com/owner/repo/pull/1',
          title: 'repo PR',
        }),
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

  live('skips pull requests that are already linked by URL', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-something',
      );
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([
        {
          number: 1,
          htmlUrl: 'https://github.com/owner/repo/pull/1',
          displayRepoName: 'repo',
        },
      ]);
      mockJiraClient.listRemoteLinks.mockSuccessValue([
        {
          url: 'https://github.com/owner/repo/pull/1',
          title: 'repo PR',
        },
      ]);

      const result = yield* Effect.provide(
        linkPullRequestsForCurrentBranch(undefined, 'github'),
        testLayer,
      );

      expect(result).toEqual({
        _tag: 'LinkedPullRequests',
        jiraKey: 'DUMMYAPP-123',
        repository: 'owner/repo',
        linked: 0,
        skipped: 1,
        results: [
          {
            number: 1,
            url: 'https://github.com/owner/repo/pull/1',
            action: 'skipped',
          },
        ],
      });
      expect(mockJiraClient.createRemoteLink).not.toHaveBeenCalled();
    }),
  );

  live('returns a no-op result when no pull requests match', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-something',
      );
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([]);

      const result = yield* Effect.provide(
        linkPullRequestsForCurrentBranch(undefined, undefined),
        testLayer,
      );

      expect(result).toEqual({
        _tag: 'NoPullRequestsFound',
        jiraKey: 'DUMMYAPP-123',
        repository: 'owner/repo',
      });
      expect(mockJiraClient.listRemoteLinks).not.toHaveBeenCalled();
      expect(mockJiraClient.createRemoteLink).not.toHaveBeenCalled();
    }),
  );

  live('fails for unsupported providers', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(undefined, 'gitlab'),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            UsageError({message: 'Unsupported provider: gitlab'}),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('fails when the current branch does not contain a jira key', () =>
    Effect.gen(function* () {
      mockGitClient.getCurrentBranch.mockSuccessValue('main');

      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(undefined, undefined),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            UsageError({message: 'No Jira Key found in current branch'}),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('fails when no GitHub remote can be found', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-something',
      );
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@gitlab.com:owner/repo.git',
        }),
      ]);

      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(undefined, undefined),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            UsageError({
              message:
                'Could not detect a GitHub repository from git remotes. Add at least one GitHub remote or pass `--remote` / `--repo` to link-pr.',
            }),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('uses the explicit remote override instead of automatic selection', () =>
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
        linkPullRequestsForCurrentBranch(
          'DUMMYAPP-999',
          undefined,
          Option.none(),
          {remote: 'origin'},
        ),
        testLayer,
      );

      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'fork',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-999',
        displayRepoName: 'repo',
        scanLimit: 500,
      });
    }),
  );

  live('uses the explicit repo override instead of git remotes', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.listRemotes.mockSuccessValue([]);
      mockGitHubClient.findPullRequestsForJiraKey.mockSuccessValue([]);

      const result = yield* Effect.provide(
        linkPullRequestsForCurrentBranch(
          'DUMMYAPP-999',
          undefined,
          Option.none(),
          {repo: 'owner/repo'},
        ),
        testLayer,
      );

      expect(result).toEqual({
        _tag: 'NoPullRequestsFound',
        jiraKey: 'DUMMYAPP-999',
        repository: 'owner/repo',
      });
      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-999',
        displayRepoName: 'repo',
        scanLimit: 500,
      });
    }),
  );

  live('fails when both explicit repository overrides are passed', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(
            'DUMMYAPP-999',
            undefined,
            Option.none(),
            {remote: 'origin', repo: 'owner/repo'},
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            UsageError({
              message: 'Pass either `--remote` or `--repo`, not both.',
            }),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('fails when the explicit repo override is invalid', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(
            'DUMMYAPP-999',
            undefined,
            Option.none(),
            {repo: 'owner/repo/extra'},
          ),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            UsageError({
              message:
                'Invalid GitHub repository. Use the format `owner/repo`.',
            }),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('surfaces missing GitHub token errors from the service', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.none(),
        githubToken: Option.none(),
        linkPrScanLimit: 500,
      });
      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-something',
      );
      mockGitClient.listRemotes.mockSuccessValue([
        GitRemote({
          name: 'origin',
          url: 'git@github.com:owner/repo.git',
        }),
      ]);
      mockGitHubClient.findPullRequestsForJiraKey.mockFailValue(
        AppConfigError({
          message: 'Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.',
        }),
      );

      const result = yield* Effect.either(
        Effect.provide(
          linkPullRequestsForCurrentBranch(undefined, undefined),
          testLayer,
        ),
      );

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            AppConfigError({
              message: 'Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.',
            }),
          ),
        onRight: () => expect.unreachable('Should have failed'),
      });
    }),
  );

  live('uses an explicit jira key instead of the current branch ticket', () =>
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

      const result = yield* Effect.provide(
        linkPullRequestsForCurrentBranch('DUMMYAPP-999', undefined),
        testLayer,
      );

      expect(result).toEqual({
        _tag: 'NoPullRequestsFound',
        jiraKey: 'DUMMYAPP-999',
        repository: 'owner/repo',
      });
      expect(mockGitClient.getCurrentBranch).not.toHaveBeenCalled();
      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-999',
        displayRepoName: 'repo',
        scanLimit: 500,
      });
    }),
  );

  live('uses the scan limit override instead of app config', () =>
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
        linkPullRequestsForCurrentBranch(
          'DUMMYAPP-999',
          undefined,
          Option.some(1000),
        ),
        testLayer,
      );

      expect(mockGitHubClient.findPullRequestsForJiraKey).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        jiraKey: 'DUMMYAPP-999',
        displayRepoName: 'repo',
        scanLimit: 1000,
      });
    }),
  );
});
