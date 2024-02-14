import {Effect, Chunk, Layer} from 'effect';
import {NodeContext} from '@effect/platform-node';

import {GitClient} from '../src/git-client';
import {JiraClient} from '../src/jira-client';
import {Environment} from '../src/environment';
import {curriedEffectMock2, effectMock} from './util';

export const mockGitClient = {
  listBranches: effectMock(() => Effect.succeed(Chunk.empty<string>())),
  getCurrentBranch: effectMock(),
  createGitBranch: effectMock(),
  createGitBranchFrom: curriedEffectMock2(),
  switchBranch: effectMock(),
};

export const mockEnvironment = {getEnv: effectMock()};
export const mockJiraClient = {getJiraIssue: effectMock()};

export const testLayer = Layer.mergeAll(
  Layer.succeed(GitClient, GitClient.of(mockGitClient)),
  Layer.succeed(Environment, Environment.of(mockEnvironment)),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
);

export const cliTestLayer = Layer.mergeAll(testLayer, NodeContext.layer);
