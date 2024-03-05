import {Option, Effect, pipe, Console} from 'effect';
import {ValidationError} from '@effect/cli';
import {CliApp} from '@effect/cli/CliApp';
import {compose} from 'effect/Function';
import * as Args from '@effect/cli/Args';
import * as Command from '@effect/cli/Command';
import * as Options from '@effect/cli/Options';
import * as Span from '@effect/cli/HelpDoc/Span';
import * as HelpDoc from '@effect/cli/HelpDoc';
import * as CommandExecutor from '@effect/platform/CommandExecutor';

import {
  gitCreateJiraBranch,
  ticketUrl,
  ticketUrlForCurrentBranch,
} from './core';
import * as packageJson from '../package.json';
import {matchGitCreateJiraBranchResult} from './types';
import {AppConfigService} from './app-config';
import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {openUrl} from './url-opener';

// for version and help
const gitJiraBranch = pipe(Command.make('git-create-jira-branch', {}));

const createCommand = pipe(
  Command.make(
    'create',
    {
      options: Options.all({
        baseBranch: Options.withDescription(
          Options.optional(Options.withAlias(Options.text('base'), 'b')),
          'Base revision to create the new branch from (a branch name, tag or commit SHA)',
        ),
        reset: Options.withDescription(
          Options.withAlias(Options.boolean('reset'), 'r'),
          'Reset the branch if it already exists',
        ),
      }),
      jiraKey: Args.withDescription(
        Args.text({name: 'jira-key'}),
        'The Jira ticket key to create a branch for (e.g. FOOX-1234)',
      ),
    },
    ({options, jiraKey}) => {
      return Effect.flatMap(
        gitCreateJiraBranch(jiraKey, options.baseBranch, options.reset),
        compose(
          matchGitCreateJiraBranchResult({
            onCreatedBranch: (branch) =>
              `Successfully created branch: '${branch}'`,
            onSwitchedBranch: (branch) =>
              `Switched to already existing branch: '${branch}'`,
            onResetBranch: (branch) => `Reset branch: '${branch}'`,
          }),
          Console.log,
        ),
      );
    },
  ),
  Command.withDescription(
    `
Fetches the given Jira ticket and creates an aproriately named branch for it.
The branch type (bug or feat) is determined by the ticket type. The branch name
is based on the ticket summary.`,
  ),
);

const openCommand = pipe(
  Command.make(
    'open',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira ticket key to create a branch for (e.g. FOOX-1234)',
      ),
    },
    ({jiraKey}) =>
      pipe(
        jiraKey,
        Option.match({
          onSome: (jiraKey) => ticketUrl(jiraKey),
          onNone: () => ticketUrlForCurrentBranch(),
        }),
        Effect.tap((url) =>
          Console.log(`Opening ticket url '${url}' in your default browser...`),
        ),
        Effect.flatMap(openUrl),
      ),
  ),
  Command.withDescription(
    `
Opens the given Jira ticket in your default browser. If no ticket is given the
jira ticket for the current branch is opened.`,
  ),
);

const mainCommand = gitJiraBranch.pipe(
  Command.withSubcommands([createCommand, openCommand]),
);

const cli = {
  name: packageJson.name,
  version: packageJson.version,
  summary: Span.text(packageJson.description),
};

export const cliEffect = (
  args: string[],
): Effect.Effect<
  void,
  never,
  | CliApp.Environment
  | GitClient
  | AppConfigService
  | JiraClient
  | CommandExecutor.CommandExecutor
> =>
  Command.run(
    mainCommand,
    cli,
  )(args).pipe(
    Effect.catchIf(ValidationError.isValidationError, (e) =>
      ValidationError.isInvalidValue(e) // Not printed by the cli yet
        ? printDocs(HelpDoc.p(Span.error(HelpDoc.getSpan(e.error))))
        : Effect.succeed(undefined),
    ),
    Effect.catchAll((e) => printDocs(HelpDoc.p(Span.error(e.message)))),
  );

const printDocs = (doc: HelpDoc.HelpDoc): Effect.Effect<void> =>
  Console.log(HelpDoc.toAnsiText(doc));
