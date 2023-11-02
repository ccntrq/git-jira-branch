import {Console, Option, Data, Effect, pipe} from 'effect';
import {get} from 'effect/Chunk';
import * as Args from '@effect/cli/Args';
import * as CliApp from '@effect/cli/CliApp';
import * as Command from '@effect/cli/Command';
import * as Options from '@effect/cli/Options';
import * as Span from '@effect/cli/HelpDoc/Span';
import * as HelpDoc from '@effect/cli/HelpDoc';
import * as ValidationError from '@effect/cli/ValidationError';

import {Environment} from './environment';
import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {gitCreateJiraBranch} from './core';
import * as packageJson from '../package.json';
import {matchGitCreateJiraBranchResult} from './types';
import {compose} from 'effect/Function';

interface GitCreateJiraBranch extends Data.Case {
  readonly version: boolean;
  readonly jiraKey: Option.Option<string>;
  readonly baseBranch: Option.Option<string>;
}

const GitCreateJiraBranch = Data.case<GitCreateJiraBranch>();

const mainCommand = pipe(
  Command.make('git-create-jira-branch', {
    options: Options.all({
      baseBranch: Options.withDescription(
        Options.optional(Options.alias(Options.text('baseBranch'), 'b')),
        'Base branch to create the new branch from',
      ),
      version: Options.withDescription(
        Options.alias(Options.boolean('version'), 'v'),
        'Show version information',
      ),
      help: Options.withDescription(
        Options.alias(Options.boolean('help'), 'h'),
        'Show this help text',
      ),
    }),
    args: Args.addDescription(
      Args.atMost(Args.text({name: 'jira-key'}), 1),
      'The Jira ticket key to create a branch for (e.g. FOOX-1234)',
    ),
  }),
  Command.withHelp(
    HelpDoc.p(
      `Fetches the given Jira ticket and creates an aproriately named branch for it.
The branch type (bug or feat) is determined by the ticket type. The branch name
is based on the ticket summary.`,
    ),
  ),
  Command.map((args) => {
    return GitCreateJiraBranch({
      version: args.options.version,
      baseBranch: args.options.baseBranch,
      jiraKey: get(args.args, 0),
    });
  }),
);

const cli = CliApp.make({
  name: packageJson.name,
  version: packageJson.version,
  command: mainCommand,
  summary: Span.text(packageJson.description),
});

export const cliEffect = (
  args: string[],
): Effect.Effect<GitClient | Environment | JiraClient, never, void> =>
  CliApp.run(cli, args, (command) => {
    if (command.version) {
      return Console.log(`${cli.name} v${cli.version}`);
    }

    return Option.match(command.jiraKey, {
      onSome: (jiraKey) =>
        Effect.flatMap(
          gitCreateJiraBranch(jiraKey, command.baseBranch),
          compose(
            matchGitCreateJiraBranchResult({
              onCreatedBranch: (branch) =>
                `Successfully created branch: '${branch}'`,
              onSwitchedBranch: (branch) =>
                `Switched to already existing branch: '${branch}'`,
            }),
            Console.log,
          ),
        ),
      onNone: () => printDocs(HelpDoc.p(Span.error('No Jira Key provided'))),
    });
  }).pipe(
    Effect.catchIf(ValidationError.isValidationError, (_) =>
      // Validation errors are already handled by the CLI
      Effect.succeed(undefined),
    ),
    Effect.catchAll((e) => printDocs(HelpDoc.p(Span.error(e.message)))),
  );

const printDocs = (doc: HelpDoc.HelpDoc): Effect.Effect<never, never, void> =>
  Console.log(HelpDoc.toAnsiText(doc));
