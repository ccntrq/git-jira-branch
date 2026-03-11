import {HttpClient, HttpClientResponse} from '@effect/platform';
import type * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import {live} from '@effect/vitest';
import {ConfigProvider, Effect, Either, Layer, Option} from 'effect';
import {describe, expect} from 'vitest';

import {type GitHubRepository, GitRemote} from '../types.js';
import {AppConfigService} from './app-config.js';
import {
  filterGitHubPullRequests,
  GitHubClient,
  GitHubClientLive,
  parseGitHubRemoteUrl,
  selectGitHubRepository,
} from './github-client.js';

const appConfigTest = AppConfigService.Live.pipe(
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
          ['GITHUB_TOKEN', 'dummy-github-token'],
        ]),
      ),
    ),
  ),
);

const mkGitHubHttpMock = (
  onRequest?: (request: HttpClientRequest.HttpClientRequest) => void,
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request: HttpClientRequest.HttpClientRequest) => {
      onRequest?.(request);
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page'));

      if (page === 1) {
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Response.json([
              {
                number: 10,
                html_url: 'https://github.com/owner/repo/pull/10',
                head: {ref: 'feat/dummyapp-123-something'},
              },
            ]),
          ),
        );
      }

      if (page === 2) {
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Response.json([
              {
                number: 11,
                html_url: 'https://github.com/owner/repo/pull/11',
                head: {ref: 'main'},
              },
            ]),
          ),
        );
      }

      return Effect.succeed(
        HttpClientResponse.fromWeb(request, Response.json([])),
      );
    }),
  );

const mkGitHubClientLayer = (
  onRequest?: (request: HttpClientRequest.HttpClientRequest) => void,
): Layer.Layer<AppConfigService | HttpClient.HttpClient | GitHubClient> => {
  const baseLayer = Layer.merge(appConfigTest, mkGitHubHttpMock(onRequest));
  return Layer.merge(
    baseLayer,
    GitHubClientLive.pipe(Layer.provide(baseLayer)),
  );
};

describe('parseGitHubRemoteUrl', () => {
  live('parses SSH GitHub remotes', () =>
    Effect.sync(() => {
      expect(
        parseGitHubRemoteUrl(
          GitRemote({
            name: 'origin',
            url: 'git@github.com:owner/repo.git',
          }),
        ),
      ).toEqual(
        Option.some<GitHubRepository>({
          owner: 'owner',
          repo: 'repo',
          displayName: 'repo',
          remoteName: 'origin',
        }),
      );
    }),
  );

  live('parses ssh URL GitHub remotes', () =>
    Effect.sync(() => {
      expect(
        parseGitHubRemoteUrl(
          GitRemote({
            name: 'origin',
            url: 'ssh://git@github.com/owner/repo.git',
          }),
        ),
      ).toEqual(
        Option.some<GitHubRepository>({
          owner: 'owner',
          repo: 'repo',
          displayName: 'repo',
          remoteName: 'origin',
        }),
      );
    }),
  );

  live('parses HTTPS GitHub remotes', () =>
    Effect.sync(() => {
      expect(
        parseGitHubRemoteUrl(
          GitRemote({
            name: 'origin',
            url: 'https://github.com/owner/repo.git',
          }),
        ),
      ).toEqual(
        Option.some<GitHubRepository>({
          owner: 'owner',
          repo: 'repo',
          displayName: 'repo',
          remoteName: 'origin',
        }),
      );
    }),
  );

  live('parses authenticated HTTPS GitHub remotes', () =>
    Effect.sync(() => {
      expect(
        parseGitHubRemoteUrl(
          GitRemote({
            name: 'origin',
            url: 'https://x-access-token:secret@github.com/owner/repo.git',
          }),
        ),
      ).toEqual(
        Option.some<GitHubRepository>({
          owner: 'owner',
          repo: 'repo',
          displayName: 'repo',
          remoteName: 'origin',
        }),
      );
    }),
  );

  live('returns none for non GitHub remotes', () =>
    Effect.sync(() => {
      expect(
        parseGitHubRemoteUrl(
          GitRemote({
            name: 'origin',
            url: 'git@gitlab.com:owner/repo.git',
          }),
        ),
      ).toEqual(Option.none());
    }),
  );
});

describe('selectGitHubRepository', () => {
  live('prefers upstream when it is a GitHub remote', () =>
    Effect.gen(function* () {
      const repository = yield* selectGitHubRepository([
        GitRemote({name: 'upstream', url: 'https://github.com/other/repo.git'}),
        GitRemote({name: 'origin', url: 'git@github.com:owner/repo.git'}),
      ]);

      expect(repository).toEqual({
        owner: 'other',
        repo: 'repo',
        displayName: 'repo',
        remoteName: 'upstream',
      });
    }),
  );

  live('falls back to origin when upstream is absent', () =>
    Effect.gen(function* () {
      const repository = yield* selectGitHubRepository([
        GitRemote({name: 'origin', url: 'git@github.com:owner/repo.git'}),
      ]);

      expect(repository).toEqual({
        owner: 'owner',
        repo: 'repo',
        displayName: 'repo',
        remoteName: 'origin',
      });
    }),
  );

  live('falls back to the first GitHub remote when origin is not GitHub', () =>
    Effect.gen(function* () {
      const repository = yield* selectGitHubRepository([
        GitRemote({name: 'origin', url: 'git@gitlab.com:owner/repo.git'}),
        GitRemote({name: 'upstream', url: 'https://github.com/owner/repo.git'}),
      ]);

      expect(repository).toEqual({
        owner: 'owner',
        repo: 'repo',
        displayName: 'repo',
        remoteName: 'upstream',
      });
    }),
  );

  live('uses an explicit remote override when requested', () =>
    Effect.gen(function* () {
      const repository = yield* selectGitHubRepository(
        [
          GitRemote({name: 'origin', url: 'git@github.com:owner/repo.git'}),
          GitRemote({
            name: 'upstream',
            url: 'https://github.com/other/repo.git',
          }),
        ],
        'origin',
      );

      expect(repository).toEqual({
        owner: 'owner',
        repo: 'repo',
        displayName: 'repo',
        remoteName: 'origin',
      });
    }),
  );

  live('fails when an explicit remote override is missing', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        selectGitHubRepository(
          [GitRemote({name: 'origin', url: 'git@github.com:owner/repo.git'})],
          'upstream',
        ),
      );

      expect(result).toEqual(
        Either.left({
          _tag: 'UsageError',
          message: 'Git remote `upstream` does not exist.',
        }),
      );
    }),
  );

  live('fails when an explicit remote override is not GitHub', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(
        selectGitHubRepository(
          [GitRemote({name: 'origin', url: 'git@gitlab.com:owner/repo.git'})],
          'origin',
        ),
      );

      expect(result).toEqual(
        Either.left({
          _tag: 'UsageError',
          message: 'Git remote `origin` is not a GitHub remote.',
        }),
      );
    }),
  );
});

describe('filterGitHubPullRequests', () => {
  live('filters pull requests by jira key case-insensitively', () =>
    Effect.sync(() => {
      const result = filterGitHubPullRequests(
        [
          {
            number: 10,
            html_url: 'https://github.com/owner/repo/pull/10',
            head: {ref: 'feat/dummyapp-123-something'},
          },
          {
            number: 11,
            html_url: 'https://github.com/owner/repo/pull/11',
            head: {ref: 'main'},
          },
          {
            number: 12,
            html_url: 'https://github.com/owner/repo/pull/12',
            head: {ref: 'fix/DUMMYAPP-123-another'},
          },
        ],
        'DUMMYAPP-123',
        'repo',
      );

      expect(result).toEqual([
        {
          number: 10,
          htmlUrl: 'https://github.com/owner/repo/pull/10',
          displayRepoName: 'repo',
        },
        {
          number: 12,
          htmlUrl: 'https://github.com/owner/repo/pull/12',
          displayRepoName: 'repo',
        },
      ]);
    }),
  );

  live('matches jira keys on branch boundaries only', () =>
    Effect.sync(() => {
      const result = filterGitHubPullRequests(
        [
          {
            number: 10,
            html_url: 'https://github.com/owner/repo/pull/10',
            head: {ref: 'feat/dummyapp-123-something'},
          },
          {
            number: 11,
            html_url: 'https://github.com/owner/repo/pull/11',
            head: {ref: 'feat/dummyapp-1234-fix'},
          },
          {
            number: 12,
            html_url: 'https://github.com/owner/repo/pull/12',
            head: {ref: 'hotfix/otherdummyapp-123'},
          },
        ],
        'DUMMYAPP-123',
        'repo',
      );

      expect(result).toEqual([
        {
          number: 10,
          htmlUrl: 'https://github.com/owner/repo/pull/10',
          displayRepoName: 'repo',
        },
      ]);
    }),
  );
});

describe('GitHubClient', () => {
  live('fetches repo pull requests across the requested pages', () =>
    Effect.gen(function* () {
      const pullRequests = yield* Effect.provide(
        Effect.flatMap(GitHubClient, (client) =>
          client.getRepoPulls({
            owner: 'owner',
            repo: 'repo',
            perPage: 100,
            scanLimit: 200,
          }),
        ),
        mkGitHubClientLayer(),
      );

      expect(pullRequests).toEqual([
        {
          number: 10,
          html_url: 'https://github.com/owner/repo/pull/10',
          head: {ref: 'feat/dummyapp-123-something'},
        },
        {
          number: 11,
          html_url: 'https://github.com/owner/repo/pull/11',
          head: {ref: 'main'},
        },
      ]);
    }),
  );

  live(
    'uses explicit sort and direction parameters for pull request listing',
    () =>
      Effect.gen(function* () {
        const urls: Array<URL> = [];

        yield* Effect.provide(
          Effect.flatMap(GitHubClient, (client) =>
            client.getRepoPulls({
              owner: 'owner',
              repo: 'repo',
              perPage: 100,
              scanLimit: 100,
            }),
          ),
          mkGitHubClientLayer((request) => {
            urls.push(new URL(request.url));
          }),
        );

        expect(urls).toHaveLength(1);
        expect(urls[0]?.searchParams.get('state')).toBe('all');
        expect(urls[0]?.searchParams.get('sort')).toBe('created');
        expect(urls[0]?.searchParams.get('direction')).toBe('desc');
        expect(urls[0]?.searchParams.get('per_page')).toBe('100');
        expect(urls[0]?.searchParams.get('page')).toBe('1');
      }),
  );

  live('limits pull request retrieval to the configured scan limit', () =>
    Effect.gen(function* () {
      const pullRequests = yield* Effect.provide(
        Effect.flatMap(GitHubClient, (client) =>
          client.getRepoPulls({
            owner: 'owner',
            repo: 'repo',
            perPage: 1,
            scanLimit: 1,
          }),
        ),
        mkGitHubClientLayer(),
      );

      expect(pullRequests).toEqual([
        {
          number: 10,
          html_url: 'https://github.com/owner/repo/pull/10',
          head: {ref: 'feat/dummyapp-123-something'},
        },
      ]);
    }),
  );
});
