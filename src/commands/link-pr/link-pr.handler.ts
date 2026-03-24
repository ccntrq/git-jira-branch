import {Effect, Option} from 'effect';
import {AppConfigService} from '../../services/app-config.js';
import {GitClient} from '../../services/git-client.js';
import {
  GitHubClient,
  selectGitHubRepository,
} from '../../services/github-client.js';
import {JiraClient} from '../../services/jira-client.js';
import {
  type GitHubRepository as GitHubRepositoryType,
  type GitJiraBranchError,
  type GitRemote,
  JiraRemoteLink,
  UsageError,
} from '../../types.js';
import {fullJiraKey} from '../../utils/jira-key.js';
import {jiraKeyFromCurrentBranch} from '../../utils/jira-key-from-branch.js';

export type LinkPrResult =
  | {
      _tag: 'NoPullRequestsFound';
      jiraKey: string;
      repository: string;
    }
  | {
      _tag: 'LinkedPullRequests';
      jiraKey: string;
      repository: string;
      linked: number;
      skipped: number;
      results: ReadonlyArray<{
        number: number;
        url: string;
        action: 'linked' | 'skipped';
      }>;
    };

export type LinkPrScanLimit = number | 'all';

export type LinkPrRepositoryOverride =
  | {
      remote: string;
      repo?: string;
    }
  | {
      remote?: undefined;
      repo: string;
    }
  | {
      remote?: undefined;
      repo?: undefined;
    };

type LinkPrActionResult = {
  number: number;
  url: string;
  action: 'linked' | 'skipped';
};

const parseRepositoryOverride = (
  remotes: ReadonlyArray<GitRemote>,
  repositoryOverride: LinkPrRepositoryOverride,
): Effect.Effect<GitHubRepositoryType, UsageError> => {
  if (
    repositoryOverride.remote !== undefined &&
    repositoryOverride.repo !== undefined
  ) {
    return Effect.fail(
      UsageError({
        message: 'Pass either `--remote` or `--repo`, not both.',
      }),
    );
  }

  if (repositoryOverride.repo !== undefined) {
    return buildExplicitRepository(repositoryOverride.repo);
  }

  return selectGitHubRepository(remotes, repositoryOverride.remote);
};

const buildExplicitRepository = (
  repository: string,
): Effect.Effect<GitHubRepositoryType, UsageError> => {
  const match = repository.match(/^([^/\s]+)\/([^/\s]+)$/);

  return match?.[1] && match[2]
    ? Effect.succeed({
        owner: match[1],
        repo: match[2],
        displayName: match[2],
        remoteName: '[explicit]',
      } as const)
    : Effect.fail(
        UsageError({
          message: 'Invalid GitHub repository. Use the format `owner/repo`.',
        }),
      );
};

export const linkPullRequestsForCurrentBranch = (
  jiraKeyArg: string | undefined,
  provider: string | undefined,
  scanLimitOverride: Option.Option<LinkPrScanLimit> = Option.none(),
  repositoryOverride: LinkPrRepositoryOverride = {},
): Effect.Effect<
  LinkPrResult,
  GitJiraBranchError,
  AppConfigService | GitClient | GitHubClient | JiraClient
> =>
  Effect.gen(function* () {
    if (provider !== undefined && provider !== 'github') {
      return yield* Effect.fail(
        UsageError({message: `Unsupported provider: ${provider}`}),
      );
    }

    const jiraClient = yield* JiraClient;
    const gitClient = yield* GitClient;
    const githubClient = yield* GitHubClient;
    const appConfig = yield* AppConfigService;

    const jiraKey = yield* jiraKeyArg === undefined
      ? jiraKeyFromCurrentBranch().pipe(Effect.flatMap(fullJiraKey))
      : fullJiraKey(jiraKeyArg);
    const remotes = yield* gitClient.listRemotes();
    const repository = yield* parseRepositoryOverride(
      remotes,
      repositoryOverride,
    );
    const scanLimit = Option.isSome(scanLimitOverride)
      ? scanLimitOverride.value
      : yield* appConfig.linkPrScanLimit;

    const pullRequests = yield* githubClient.findPullRequestsForJiraKey({
      owner: repository.owner,
      repo: repository.repo,
      jiraKey,
      displayRepoName: repository.displayName,
      scanLimit,
    });

    if (pullRequests.length === 0) {
      return {
        _tag: 'NoPullRequestsFound',
        jiraKey,
        repository: `${repository.owner}/${repository.repo}`,
      };
    }

    const existingRemoteLinks = yield* jiraClient.listRemoteLinks(jiraKey);
    const existingUrls = new Set(
      existingRemoteLinks.map((remoteLink) => remoteLink.url),
    );

    const results = yield* Effect.forEach(
      pullRequests,
      (pullRequest): Effect.Effect<LinkPrActionResult, GitJiraBranchError> =>
        existingUrls.has(pullRequest.htmlUrl)
          ? Effect.succeed({
              number: pullRequest.number,
              url: pullRequest.htmlUrl,
              action: 'skipped',
            } satisfies LinkPrActionResult)
          : jiraClient
              .createRemoteLink(
                jiraKey,
                JiraRemoteLink({
                  url: pullRequest.htmlUrl,
                  title: `${pullRequest.displayRepoName} PR`,
                }),
              )
              .pipe(
                Effect.as({
                  number: pullRequest.number,
                  url: pullRequest.htmlUrl,
                  action: 'linked',
                } satisfies LinkPrActionResult),
              ),
    );

    return {
      _tag: 'LinkedPullRequests',
      jiraKey,
      repository: `${repository.owner}/${repository.repo}`,
      linked: results.filter(
        (result: LinkPrActionResult) => result.action === 'linked',
      ).length,
      skipped: results.filter(
        (result: LinkPrActionResult) => result.action === 'skipped',
      ).length,
      results,
    };
  });
