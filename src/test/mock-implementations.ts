import {NodeContext} from '@effect/platform-node';
import {Chunk, Effect, Layer} from 'effect';

import {AppConfigService} from '../services/app-config';
import {GitClient} from '../services/git-client';
import {JiraClient} from '../services/jira-client';
import type {GitBranch} from '../types';
import {curriedEffectMock2, effectMock} from './util';

export const mockGitClient = {
  listBranches: effectMock(() => Effect.succeed(Chunk.empty<GitBranch>())),
  getCurrentBranch: effectMock(),
  createGitBranch: effectMock(),
  deleteBranch: effectMock(),
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
      defaultJiraKeyPrefix: Effect.suspend(() =>
        mockAppConfigService
          .getAppConfig()
          .pipe(Effect.map((_) => _.defaultJiraKeyPrefix)),
      ),
    }),
  ),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
);

export const cliTestLayer = Layer.mergeAll(testLayer, NodeContext.layer);
