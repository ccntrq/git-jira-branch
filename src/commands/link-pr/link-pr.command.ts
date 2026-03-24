import {Args, Command, Options} from '@effect/cli';
import {Console, Effect, Option, pipe} from 'effect';
import {UsageError} from '../../types.js';
import {
  type LinkPrRepositoryOverride,
  type LinkPrResult,
  type LinkPrScanLimit,
  linkPullRequestsForCurrentBranch,
} from './link-pr.handler.js';

const formatLinkPrResult = (result: LinkPrResult): string =>
  result._tag === 'NoPullRequestsFound'
    ? `No GitHub PRs found for ${result.jiraKey} in ${result.repository}.`
    : [
        `Linked ${result.linked}, skipped ${result.skipped}.`,
        ...result.results.map(
          (pullRequest) =>
            `${pullRequest.action} #${pullRequest.number} ${pullRequest.url}`,
        ),
      ].join('\n');

const parseScanLimit = (
  scanLimit: Option.Option<string>,
): Effect.Effect<Option.Option<LinkPrScanLimit>, UsageError> => {
  if (Option.isNone(scanLimit)) {
    return Effect.succeed(Option.none());
  }

  if (scanLimit.value === 'all') {
    return Effect.succeed(Option.some('all'));
  }

  const parsed = Number(scanLimit.value);
  return Number.isInteger(parsed) && parsed > 0
    ? Effect.succeed(Option.some(parsed))
    : Effect.fail(
        UsageError({
          message: 'Invalid scan limit. Use a positive integer or `all`.',
        }),
      );
};

const parseRepositoryOverride = (
  remote: Option.Option<string>,
  repo: Option.Option<string>,
): LinkPrRepositoryOverride =>
  Option.isSome(remote) && Option.isSome(repo)
    ? {remote: remote.value, repo: repo.value}
    : Option.isSome(remote)
      ? {remote: remote.value}
      : Option.isSome(repo)
        ? {repo: repo.value}
        : {};

export const linkPr = pipe(
  Command.make(
    'link-pr',
    {
      options: Options.all({
        provider: Options.withDescription(
          Options.withDefault(Options.text('provider'), 'github'),
          'Pull request provider. Only `github` is supported.',
        ),
        scanLimit: Options.withDescription(
          Options.optional(Options.text('scan-limit')),
          'Newest pull requests to scan, or `all`. Defaults to `LINK_PR_SCAN_LIMIT` or `500`.',
        ),
        remote: Options.withDescription(
          Options.optional(Options.text('remote')),
          'Git remote to query PRs from, for example `upstream`.',
        ),
        repo: Options.withDescription(
          Options.optional(Options.text('repo')),
          'GitHub repository to query directly in `owner/repo` format.',
        ),
      }),
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'Jira key to link pull requests for. Defaults to the current branch ticket.',
      ),
    },
    ({options, jiraKey}) => {
      return parseScanLimit(options.scanLimit).pipe(
        Effect.flatMap((scanLimit) =>
          linkPullRequestsForCurrentBranch(
            Option.getOrUndefined(jiraKey),
            options.provider,
            scanLimit,
            parseRepositoryOverride(options.remote, options.repo),
          ),
        ),
        Effect.map(formatLinkPrResult),
        Effect.flatMap(Console.log),
      );
    },
  ),
  Command.withDescription(
    `
Finds GitHub pull requests whose head branch contains the Jira key and adds
missing Jira remote links. Uses the current branch ticket by default, prefers
the GitHub \`upstream\` remote when present, and supports \`--remote\` / \`--repo\`
to override repository selection.`,
  ),
);
