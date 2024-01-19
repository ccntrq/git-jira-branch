#!/usr/bin/env node

import {Effect, Layer, pipe} from 'effect';
import * as Http from '@effect/platform/HttpClient';
import * as NodeCommandExecutor from '@effect/platform-node/CommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/FileSystem';

import {EnvironmentLive} from './environment';
import {GitClientLive} from './git-client';
import {JiraClientLive} from './jira-client';
import {cliEffect} from './cli';
import {NodeContext} from '@effect/platform-node';

const gitClientLayer = GitClientLive.pipe(
  Layer.provide(NodeCommandExecutor.layer),
  Layer.provide(NodeFileSystem.layer),
);

const jiraClientLayer = JiraClientLive.pipe(
  Layer.provide(Http.client.layer),
  Layer.provide(EnvironmentLive),
);

const mainLive = Layer.mergeAll(
  gitClientLayer,
  EnvironmentLive,
  jiraClientLayer,
  NodeContext.layer,
);

const mainEffect = pipe(
  Effect.sync(() => process.argv),
  Effect.flatMap(cliEffect),
  Effect.provide(mainLive),
);

Effect.runPromise(mainEffect);
