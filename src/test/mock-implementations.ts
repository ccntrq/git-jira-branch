import * as CommandExecutor from '@effect/platform/CommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as NodeTerminal from '@effect/platform-node/NodeTerminal';
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
    }),
  ),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
  Layer.succeed(CommandExecutor.CommandExecutor, noopCommandExecutor),
);

export const cliTestLayer = Layer.mergeAll(
  testLayer,
  NodePath.layer,
  NodeTerminal.layer,
  NodeFileSystem.layer,
);
