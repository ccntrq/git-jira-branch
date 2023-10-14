#!/usr/bin/env node
import { Console, Data, Effect, Layer, pipe } from "effect";
import { get } from "effect/Chunk";
import { isSome, type Option } from "effect/Option";
import * as Args from "@effect/cli/Args";
import * as CliApp from "@effect/cli/CliApp";
import * as Command from "@effect/cli/Command";
import * as Options from "@effect/cli/Options";
import * as Span from "@effect/cli/HelpDoc/Span";
import * as HelpDoc from "@effect/cli/HelpDoc";
import * as ValidationError from "@effect/cli/ValidationError";
import * as Http from "@effect/platform/HttpClient";

import { Environment, EnvironmentLive } from "./environment";
import { GitClient, GitClientLive } from "./git-client";
import { JiraClient, JiraClientLive } from "./jira-client";
import { gitCreateJiraBranch } from "./core";
import { GitCreateJiraBranchError } from "./types";
import * as packageJson from "./package.json";

export interface GitCreateJiraBranch extends Data.Case {
  readonly version: boolean;
  readonly jiraKey: Option<string>;
  readonly baseBranch: Option<string>;
}

export const GitCreateJiraBranch = Data.case<GitCreateJiraBranch>();

const mainCommand = pipe(
  Command.make("git-create-jira-branch", {
    options: Options.all({
      baseBranch: Options.withDescription(
        Options.optional(Options.alias(Options.text("baseBranch"), "b")),
        "Base branch to create the new branch from"
      ),
      version: Options.withDescription(
        Options.alias(Options.boolean("version"), "v"),
        "Show version information"
      ),
      help: Options.withDescription(
        Options.alias(Options.boolean("help"), "h"),
        "Show this help text"
      ),
    }),
    args: Args.addDescription(
      Args.atMost(Args.text({ name: "jira-key" }), 1),
      "The Jira ticket key to create a branch for (e.g. FOOX-1234)"
    ),
  }),
  Command.map((args) => {
    return GitCreateJiraBranch({
      version: args.options.version,
      baseBranch: args.options.baseBranch,
      jiraKey: get(args.args, 0),
    });
  })
);

const cli = CliApp.make({
  name: packageJson.name,
  version: packageJson.version,
  command: mainCommand,
  summary: Span.text("Create a git branch from a Jira ticket"),
});

const baseLayer = Layer.merge(
  Http.client.layer,
  Layer.merge(GitClientLive, EnvironmentLive)
);
const mainLive = Layer.merge(
  baseLayer,
  baseLayer.pipe(Layer.provide(JiraClientLive))
);

Effect.runPromise(
  Effect.provide(
    pipe(
      Effect.sync(() => process.argv.slice(2)),
      Effect.flatMap((args) =>
        CliApp.run(
          cli,
          args,
          (
            command
          ): Effect.Effect<
            GitClient | Environment | JiraClient,
            GitCreateJiraBranchError | ValidationError.ValidationError,
            void
          > =>
            command.version
              ? Console.log(`${cli.name} v${cli.version}`)
              : isSome(command.jiraKey)
              ? gitCreateJiraBranch(
                  command.jiraKey.value,
                  command.baseBranch
                ).pipe(
                  Effect.flatMap((branch) =>
                    Console.log(`Successfully created branch: '${branch}`)
                  )
                )
              : Effect.fail(
                  ValidationError.missingValue(
                    HelpDoc.p(Span.error("No Jira Key provided"))
                  )
                ).pipe(Effect.catchAll((e) => printDocs(e.error)))
        )
      ),
      Effect.catchIf(ValidationError.isValidationError, (e) =>
        // Validation errors are already handled by the CLI
        Effect.succeed(undefined)
      ),
      Effect.catchAll((e) => printDocs(HelpDoc.p(Span.error(e.message))))
    ),
    mainLive
  )
);

const printDocs = (doc: HelpDoc.HelpDoc) =>
  Console.log(HelpDoc.toAnsiText(doc));
