#!/usr/bin/env node

import { Effect, Layer, pipe } from "effect";
import * as Http from "@effect/platform/HttpClient";
import * as NodeCommandExecutor from "@effect/platform-node/CommandExecutor";
import * as NodeFileSystem from "@effect/platform-node/FileSystem";

import { EnvironmentLive } from "./environment";
import { GitClientLive } from "./git-client";
import { JiraClientLive } from "./jira-client";
import { cliEffect } from "./cli";

const mainLive = Layer.merge(
  NodeFileSystem.layer
    .pipe(Layer.provide(NodeCommandExecutor.layer))
    .pipe(Layer.provide(GitClientLive)),
  EnvironmentLive
).pipe(
  Layer.provideMerge(Http.client.layer.pipe(Layer.provide(JiraClientLive)))
);

Effect.runPromise(
  Effect.provide(
    pipe(
      Effect.sync(() => process.argv.slice(2)),
      Effect.flatMap(cliEffect)
    ),
    mainLive
  )
);
