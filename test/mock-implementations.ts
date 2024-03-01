import {Effect, Chunk, Layer} from 'effect';
import {NodeContext} from '@effect/platform-node';

import {GitClient} from '../src/git-client';
import {JiraClient} from '../src/jira-client';
import {AppConfigService} from '../src/app-config';
import {curriedEffectMock2, effectMock} from './util';

export const mockGitClient = {
  listBranches: effectMock(() => Effect.succeed(Chunk.empty<string>())),
  getCurrentBranch: effectMock(),
  createGitBranch: effectMock(),
  createGitBranchFrom: curriedEffectMock2(),
  switchBranch: effectMock(),
};

export const mockAppConfigService = {getAppConfig: effectMock()};
export const mockJiraClient = {getJiraIssue: effectMock()};

export const testLayer = Layer.mergeAll(
  Layer.succeed(GitClient, GitClient.of(mockGitClient)),
  Layer.succeed(
    AppConfigService,
    AppConfigService.of({
      getAppConfig: Effect.suspend(() => mockAppConfigService.getAppConfig()),
    }),
  ),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
);

export const cliTestLayer = Layer.mergeAll(testLayer, NodeContext.layer);
