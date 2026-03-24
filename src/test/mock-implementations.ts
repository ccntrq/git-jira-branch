import * as CommandExecutor from '@effect/platform/CommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as NodeTerminal from '@effect/platform-node/NodeTerminal';
import {Chunk, Effect, Layer, Option} from 'effect';

import {AppConfigService} from '../services/app-config.js';
import {GitClient} from '../services/git-client.js';
import {GitHubClient} from '../services/github-client.js';
import {JiraClient} from '../services/jira-client.js';
import {
  AppConfigError,
  type GitBranch,
  type GitHubApiError,
  type GitHubPullRequestLink,
  type GitRemote,
  type JiraApiError,
  type JiraRemoteLink,
} from '../types.js';
import {curriedEffectMock2, effectMock} from './util.js';

export const mockGitClient = {
  listBranches: effectMock(() => Effect.succeed(Chunk.empty<GitBranch>())),
  getCurrentBranch: effectMock(),
  listRemotes: effectMock(() => Effect.succeed([] as ReadonlyArray<GitRemote>)),
  createGitBranch: effectMock(),
  deleteBranch: effectMock(),
  createGitBranchFrom: curriedEffectMock2(),
  switchBranch: effectMock(),
};

export const mockAppConfigService = {getAppConfig: effectMock()};
export const mockJiraClient = {
  getJiraIssue: effectMock(),
  listRemoteLinks: effectMock<
    [string],
    ReadonlyArray<JiraRemoteLink>,
    AppConfigError | JiraApiError
  >(() => Effect.succeed([])),
  createRemoteLink: effectMock<
    [string, JiraRemoteLink],
    void,
    AppConfigError | JiraApiError
  >(() => Effect.succeed(undefined)),
};
export const mockGitHubClient = {
  getRepoPulls: effectMock<
    [
      {
        owner: string;
        repo: string;
        perPage: number;
        scanLimit: number | 'all';
      },
    ],
    ReadonlyArray<{
      number: number;
      html_url: string;
      head: {ref: string};
    }>,
    AppConfigError | GitHubApiError
  >(() => Effect.succeed([])),
  findPullRequestsForJiraKey: effectMock<
    [
      {
        owner: string;
        repo: string;
        jiraKey: string;
        displayRepoName: string;
        scanLimit: number | 'all';
      },
    ],
    ReadonlyArray<GitHubPullRequestLink>,
    AppConfigError | GitHubApiError
  >(() => Effect.succeed([])),
};

export const resetTestMocks = (): void => {
  mockGitClient.listBranches
    .mockReset()
    .mockImplementation(() => Effect.succeed(Chunk.empty<GitBranch>()));
  mockGitClient.getCurrentBranch
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockGitClient.listRemotes
    .mockReset()
    .mockImplementation(() => Effect.succeed([]));
  mockGitClient.createGitBranch
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockGitClient.deleteBranch
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockGitClient.createGitBranchFrom.innerMock
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockGitClient.createGitBranchFrom
    .mockReset()
    .mockImplementation(() => mockGitClient.createGitBranchFrom.innerMock);
  mockGitClient.switchBranch
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockAppConfigService.getAppConfig.mockReset().mockImplementation(() =>
    Effect.succeed({
      defaultJiraKeyPrefix: Option.none(),
      githubToken: Option.none(),
      linkPrScanLimit: 500,
    }),
  );
  mockJiraClient.getJiraIssue
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockJiraClient.listRemoteLinks
    .mockReset()
    .mockImplementation(() => Effect.succeed([]));
  mockJiraClient.createRemoteLink
    .mockReset()
    .mockImplementation(() => Effect.succeed(undefined));
  mockGitHubClient.findPullRequestsForJiraKey
    .mockReset()
    .mockImplementation(() => Effect.succeed([]));
  mockGitHubClient.getRepoPulls
    .mockReset()
    .mockImplementation(() => Effect.succeed([]));
};

const noopCommandExecutor = CommandExecutor.makeExecutor(() =>
  Effect.dieMessage('CommandExecutor should not be used in tests'),
);

export const testLayer = Layer.mergeAll(
  Layer.succeed(GitClient, GitClient.of(mockGitClient)),
  Layer.succeed(
    AppConfigService,
    AppConfigService.of({
      getAppConfig: Effect.suspend(() => mockAppConfigService.getAppConfig()),
      defaultJiraKeyPrefix: Effect.suspend(() =>
        mockAppConfigService
          .getAppConfig()
          .pipe(Effect.map((_) => _.defaultJiraKeyPrefix)),
      ),
      linkPrScanLimit: Effect.suspend(() =>
        mockAppConfigService
          .getAppConfig()
          .pipe(Effect.map((_) => _.linkPrScanLimit)),
      ),
      githubToken: Effect.suspend(() =>
        mockAppConfigService.getAppConfig().pipe(
          Effect.flatMap((config) =>
            config.githubToken._tag === 'Some'
              ? Effect.succeed(config.githubToken.value)
              : Effect.fail(
                  AppConfigError({
                    message:
                      'Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.',
                  }),
                ),
          ),
        ),
      ),
    }),
  ),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
  Layer.succeed(GitHubClient, GitHubClient.of(mockGitHubClient)),
  Layer.succeed(CommandExecutor.CommandExecutor, noopCommandExecutor),
);

export const cliTestLayer = Layer.mergeAll(
  testLayer,
  NodePath.layer,
  NodeTerminal.layer,
  NodeFileSystem.layer,
);
