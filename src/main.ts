#!/usr/bin/env node

import {Cause, Console, Effect, Layer, pipe} from 'effect';
import * as Http from '@effect/platform/HttpClient';
import * as NodeCommandExecutor from '@effect/platform-node/NodeCommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';

import {EnvironmentLive} from './environment';
import {GitClientLive} from './git-client';
import {JiraClientLive} from './jira-client';
import {cliEffect} from './cli';
import {NodeContext} from '@effect/platform-node';

const commandExecutorLayer = NodeCommandExecutor.layer.pipe(
  Layer.provide(NodeFileSystem.layer),
);

const gitClientLayer = GitClientLive.pipe(Layer.provide(commandExecutorLayer));

const jiraClientLayer = JiraClientLive.pipe(
  Layer.provide(Http.client.layer),
  Layer.provide(EnvironmentLive),
);

const mainLive = Layer.mergeAll(
  commandExecutorLayer,
  gitClientLayer,
  EnvironmentLive,
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
