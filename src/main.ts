#!/usr/bin/env node

import * as NodeCommandExecutor from '@effect/platform-node/NodeCommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Http from '@effect/platform/HttpClient';
import {Cause, Console, Effect, Exit, Layer, pipe} from 'effect';

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
    return Console.log(
      Cause.isRuntimeException(defect)
        ? `RuntimeException defect caught: ${defect.message}`
        : `Unknown defect caught: ${JSON.stringify(defect)}`,
    ).pipe(Effect.andThen(Effect.fail('Defect')));
  }),
);

Effect.runPromiseExit(mainEffect).then((exit) => {
  if (Exit.isFailure(exit)) {
    process.exit(1);
  }
});
