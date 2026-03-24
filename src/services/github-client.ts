import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import {
  Context,
  Effect,
  Layer,
  Option,
  type ParseResult,
  pipe,
  Schema,
} from 'effect';
import {ArrayFormatter} from 'effect/ParseResult';

import {
  type AppConfigError,
  GitHubApiError,
  GitHubPullRequestLink,
  GitHubRepository,
  type GitHubRepository as GitHubRepositoryType,
  type GitRemote,
  UsageError,
} from '../types.js';
import {AppConfigService} from './app-config.js';

export class GitHubClient extends Context.Tag('GitHubClient')<
  GitHubClient,
  {
    readonly getRepoPulls: (args: {
      owner: string;
      repo: string;
      perPage: number;
      scanLimit: number | 'all';
    }) => Effect.Effect<
      ReadonlyArray<PullRequestSummary>,
      AppConfigError | GitHubApiError
    >;
    readonly findPullRequestsForJiraKey: (args: {
      owner: string;
      repo: string;
      jiraKey: string;
      displayRepoName: string;
      scanLimit: number | 'all';
    }) => Effect.Effect<
      ReadonlyArray<GitHubPullRequestLink>,
      AppConfigError | GitHubApiError
    >;
  }
>() {}

type PullRequestSummary = {
  number: number;
  html_url: string;
  head: {ref: string};
};

const PullRequestSummarySchema = Schema.Struct({
  number: Schema.Number,
  html_url: Schema.String,
  head: Schema.Struct({
    ref: Schema.String,
  }),
});

export const GitHubClientLive = Layer.effect(
  GitHubClient,
  Effect.all([AppConfigService, HttpClient.HttpClient]).pipe(
    Effect.map(([appConfig, httpClient]) => {
      const getRepoPulls = ({
        owner,
        repo,
        perPage,
        scanLimit,
      }: {
        owner: string;
        repo: string;
        perPage: number;
        scanLimit: number | 'all';
      }) =>
        Effect.gen(function* () {
          const token = yield* appConfig.githubToken;
          const filteredClient = HttpClient.filterStatusOk(httpClient);

          const fetchPage = (page: number) =>
            pipe(
              HttpClientRequest.get(
                `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=${perPage}&page=${page}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                  },
                },
              ),
              filteredClient.execute,
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(
                  Schema.Array(PullRequestSummarySchema),
                ),
              ),
              Effect.scoped,
              handleGitHubPullsErrors(owner, repo, page),
            );

          const pullRequests =
            scanLimit === 'all'
              ? yield* fetchAllPullRequestPages(fetchPage, perPage)
              : yield* Effect.forEach(
                  buildPullRequestPages(scanLimit, perPage),
                  fetchPage,
                  {concurrency: 10},
                ).pipe(
                  Effect.map((pullRequestPages) =>
                    pullRequestPages.flat().slice(0, scanLimit),
                  ),
                );

          return pullRequests;
        });

      return GitHubClient.of({
        getRepoPulls,
        findPullRequestsForJiraKey: ({
          owner,
          repo,
          jiraKey,
          displayRepoName,
          scanLimit,
        }) =>
          Effect.gen(function* () {
            const normalizedKey = jiraKey.toLowerCase();

            const pullRequests = yield* getRepoPulls({
              owner,
              repo,
              perPage: 100,
              scanLimit,
            });
            const matchingPullRequests = filterGitHubPullRequests(
              pullRequests,
              normalizedKey,
              displayRepoName,
            );

            return matchingPullRequests;
          }),
      });
    }),
  ),
);

export const filterGitHubPullRequests = (
  pullRequests: ReadonlyArray<PullRequestSummary>,
  jiraKey: string,
  displayRepoName: string,
): ReadonlyArray<GitHubPullRequestLink> => {
  const jiraKeyPattern = new RegExp(
    `(^|[^A-Z0-9])${escapeRegExp(jiraKey)}($|[^A-Z0-9])`,
    'i',
  );

  return pullRequests
    .filter((pullRequest) => jiraKeyPattern.test(pullRequest.head.ref))
    .map((pullRequest) =>
      GitHubPullRequestLink({
        number: pullRequest.number,
        htmlUrl: pullRequest.html_url,
        displayRepoName,
      }),
    );
};

export const parseGitHubRemoteUrl = (
  remote: GitRemote,
): Option.Option<GitHubRepositoryType> => {
  const sshRepository = parseGitHubSshRemoteUrl(remote.url);
  if (sshRepository) {
    const {owner, repo} = sshRepository;
    if (!(owner && repo)) {
      return Option.none();
    }
    return Option.some(
      GitHubRepository({
        owner,
        repo,
        displayName: repo,
        remoteName: remote.name,
      }),
    );
  }

  const httpsRepository = parseGitHubHttpsRemoteUrl(remote.url);
  if (httpsRepository) {
    const {owner, repo} = httpsRepository;
    if (!(owner && repo)) {
      return Option.none();
    }
    return Option.some(
      GitHubRepository({
        owner,
        repo,
        displayName: repo,
        remoteName: remote.name,
      }),
    );
  }

  return Option.none();
};

const parseGitHubSshRemoteUrl = (
  remoteUrl: string,
): {owner: string; repo: string} | null => {
  const scpStyleMatch = remoteUrl.match(
    /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/,
  );
  if (scpStyleMatch) {
    const owner = scpStyleMatch[1];
    const repo = scpStyleMatch[2];
    return owner && repo ? {owner, repo} : null;
  }

  try {
    const url = new URL(remoteUrl);
    if (
      url.protocol !== 'ssh:' ||
      url.hostname !== 'github.com' ||
      url.username !== 'git'
    ) {
      return null;
    }

    const pathSegments = url.pathname.replace(/^\/+/, '').split('/');
    const owner = pathSegments[0];
    const repo = pathSegments[1]?.replace(/\.git$/, '');
    return owner && repo ? {owner, repo} : null;
  } catch {
    return null;
  }
};

const parseGitHubHttpsRemoteUrl = (
  remoteUrl: string,
): {owner: string; repo: string} | null => {
  try {
    const url = new URL(remoteUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
      return null;
    }

    const pathSegments = url.pathname.replace(/^\/+/, '').split('/');
    const owner = pathSegments[0];
    const repo = pathSegments[1]?.replace(/\.git$/, '');
    return owner && repo ? {owner, repo} : null;
  } catch {
    return null;
  }
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPullRequestPages = (
  scanLimit: number,
  perPage: number,
): ReadonlyArray<number> =>
  Array.from({length: Math.ceil(scanLimit / perPage)}, (_, index) => index + 1);

const fetchAllPullRequestPages = (
  fetchPage: (
    page: number,
  ) => Effect.Effect<
    ReadonlyArray<PullRequestSummary>,
    AppConfigError | GitHubApiError
  >,
  perPage: number,
): Effect.Effect<
  ReadonlyArray<PullRequestSummary>,
  AppConfigError | GitHubApiError
> => {
  const fetchRemainingPages = (
    page: number,
    accumulatedPullRequests: ReadonlyArray<PullRequestSummary>,
  ): Effect.Effect<
    ReadonlyArray<PullRequestSummary>,
    AppConfigError | GitHubApiError
  > =>
    fetchPage(page).pipe(
      Effect.flatMap((pullRequests) => {
        const nextPullRequests = [
          ...accumulatedPullRequests,
          ...pullRequests,
        ] as const;

        return pullRequests.length < perPage
          ? Effect.succeed(nextPullRequests)
          : fetchRemainingPages(page + 1, nextPullRequests);
      }),
    );

  return fetchRemainingPages(1, []);
};

export const selectGitHubRepository = (
  remotes: ReadonlyArray<GitRemote>,
  remoteNameOverride?: string,
): Effect.Effect<GitHubRepositoryType, UsageError> => {
  const parsedRemotes = remotes.flatMap((remote) => {
    const parsed = parseGitHubRemoteUrl(remote);
    return parsed._tag === 'Some' ? [parsed.value] : [];
  });

  if (remoteNameOverride !== undefined) {
    const matchingRemote = remotes.find(
      (remote) => remote.name === remoteNameOverride,
    );

    if (matchingRemote === undefined) {
      return Effect.fail(
        UsageError({
          message: `Git remote \`${remoteNameOverride}\` does not exist.`,
        }),
      );
    }

    return pipe(
      parseGitHubRemoteUrl(matchingRemote),
      Option.match({
        onNone: () =>
          Effect.fail(
            UsageError({
              message: `Git remote \`${remoteNameOverride}\` is not a GitHub remote.`,
            }),
          ),
        onSome: Effect.succeed,
      }),
    );
  }

  const upstream = parsedRemotes.find(
    (remote) => remote.remoteName === 'upstream',
  );
  const origin = parsedRemotes.find((remote) => remote.remoteName === 'origin');

  return pipe(
    upstream ?? origin ?? parsedRemotes[0],
    Effect.fromNullable,
    Effect.mapError(() =>
      UsageError({
        message:
          'Could not detect a GitHub repository from git remotes. Add at least one GitHub remote or pass `--remote` / `--repo` to link-pr.',
      }),
    ),
  );
};

const handleGitHubPullsErrors =
  (owner: string, repo: string, page: number) =>
  (
    eff: Effect.Effect<
      ReadonlyArray<PullRequestSummary>,
      AppConfigError | ParseResult.ParseError | HttpClientError.HttpClientError
    >,
  ): Effect.Effect<
    ReadonlyArray<PullRequestSummary>,
    AppConfigError | GitHubApiError
  > =>
    eff.pipe(
      Effect.catchTag('ParseError', (e) =>
        Effect.fail(
          GitHubApiError({
            message: [
              `Failed to parse pull request response from GitHub for ${owner}/${repo} page ${page}:`,
              ...ArrayFormatter.formatErrorSync(e).map(
                (issue) => `'${issue.path.join(' ')}': '${issue.message}'`,
              ),
            ].join('\n'),
          }),
        ),
      ),
      Effect.catchTag('RequestError', (e) =>
        Effect.fail(
          GitHubApiError({
            message: `Failed to make pull request request to GitHub: ${e.message}`,
          }),
        ),
      ),
      Effect.catchTag('ResponseError', (e) =>
        Effect.fail(
          GitHubApiError({
            message:
              e.response.status === 404
                ? `GitHub returned status 404 for ${owner}/${repo}. Make sure the repository exists and the token can access it.`
                : `GitHub pull request request failed: ${e.message}`,
          }),
        ),
      ),
    );
