#!/usr/bin/env node

import * as NodeCommandExecutor from '@effect/platform-node/NodeCommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Http from '@effect/platform/HttpClient';
import {Cause, Console, Effect, Layer, pipe} from 'effect';

import {NodeContext} from '@effect/platform-node';
import {AppConfigService} from './app-config';
import {cliEffect} from './cli';
import {GitClientLive} from './git-client';
import {JiraClientLive} from './jira-client';

const commandExecutorLayer = NodeCommandExecutor.layer.pipe(
  Layer.provide(NodeFileSystem.layer),
);

const gitClientLayer = GitClientLive.pipe(Layer.provide(commandExecutorLayer));

const jiraClientLayer = JiraClientLive.pipe(
  Layer.provide(Http.client.layer),
  Layer.provide(AppConfigService.Live),
);

const mainLive = Layer.mergeAll(
  commandExecutorLayer,
  gitClientLayer,
  AppConfigService.Live,
  jiraClientLayer,
  NodeContext.layer,
);

const mainEffect = pipe(
  Effect.sync(() => process.argv),
  Effect.flatMap(cliEffect),
  Effect.provide(mainLive),
  Effect.catchAllDefect((defect) => {
    if (Cause.isRuntimeException(defect)) {
      return Console.log(`RuntimeException defect caught: ${defect.message}`);
    }
    return Console.log(`Unknown defect caught: ${JSON.stringify(defect)}`);
  }),
);

Effect.runPromise(mainEffect);
