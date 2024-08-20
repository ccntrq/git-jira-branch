#!/usr/bin/env node

import * as NodeCommandExecutor from '@effect/platform-node/NodeCommandExecutor';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import {Cause, Console, Effect, Exit, Layer, pipe} from 'effect';

import {HttpClient} from '@effect/platform';
import {NodeContext} from '@effect/platform-node';
import {cliEffect} from './cli';
import {AppConfigService} from './services/app-config';
import {CustomizationsService} from './services/customizations';
import {GitClientLive} from './services/git-client';
import {JiraClientLive} from './services/jira-client';

const commandExecutorLayer = NodeCommandExecutor.layer.pipe(
  Layer.provide(NodeFileSystem.layer),
);

const gitClientLayer = GitClientLive.pipe(Layer.provide(commandExecutorLayer));

const jiraClientLayer = JiraClientLive.pipe(
  Layer.provide(HttpClient.layer),
  Layer.provide(AppConfigService.Live),
);

const mainLive = Layer.mergeAll(
  commandExecutorLayer,
  gitClientLayer,
  AppConfigService.Live,
  CustomizationsService.Live.pipe(Layer.provide(NodeFileSystem.layer)),
  jiraClientLayer,
  NodeContext.layer,
);

const mainEffect = pipe(
  Effect.sync(() => process.argv),
  Effect.flatMap(cliEffect),
  Effect.provide(mainLive),
  Effect.catchAllDefect((defect) => {
    return Console.error(
      Cause.isRuntimeException(defect)
        ? `RuntimeException defect caught: ${defect.message}`
        : `Unknown defect caught: ${defect}.`,
    ).pipe(Effect.andThen(Effect.fail('Defect')));
  }),
);

Effect.runPromiseExit(mainEffect).then((exit) => {
  if (Exit.isFailure(exit)) {
    process.exit(1);
  }
});
