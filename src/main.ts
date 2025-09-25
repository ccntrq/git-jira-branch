#!/usr/bin/env node

import {FetchHttpClient} from '@effect/platform';
import * as NodeCommandExecutor from '@effect/platform-node/NodeCommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as NodeTerminal from '@effect/platform-node/NodeTerminal';
import {Cause, Console, Effect, Exit, Layer, pipe} from 'effect';
import {cliEffect} from './cli';
import {AppConfigService} from './services/app-config';
import {GitClientLive} from './services/git-client';
import {JiraClientLive} from './services/jira-client';

const fileSystemLayer = NodeFileSystem.layer;

const commandExecutorLayer = NodeCommandExecutor.layer.pipe(
  Layer.provide(fileSystemLayer),
);

const gitClientLayer = GitClientLive.pipe(Layer.provide(commandExecutorLayer));

const jiraClientLayer = JiraClientLive.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(AppConfigService.Live),
);

const mainLive = Layer.mergeAll(
  fileSystemLayer,
  commandExecutorLayer,
  NodePath.layer,
  NodeTerminal.layer,
  AppConfigService.Live,
  gitClientLayer,
  jiraClientLayer,
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
    process.exitCode = 1;
  }
});
