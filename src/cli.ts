import {Option, Data, Effect, pipe, Console} from 'effect';
import {ValidationError} from '@effect/cli';
import {CliApp} from '@effect/cli/CliApp';
import {isNone} from 'effect/Option';
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
import {
  GitCreateJiraBranchError,
  matchGitCreateJiraBranchResult,
} from './types';
import {compose} from 'effect/Function';
import {AppConfigService} from './app-config';
import {GitClient} from './git-client';
import {JiraClient} from './jira-client';
import {openUrl} from './url-opener';

interface GitCreateJiraBranch {
  readonly jiraKey: Option.Option<string>;
  readonly baseBranch: Option.Option<string>;
  readonly reset: boolean;
  readonly open: boolean;
}

const GitCreateJiraBranch = Data.case<GitCreateJiraBranch>();

const mainCommand = pipe(
  Command.make(
    'git-create-jira-branch',
    {
      options: Options.all({
        baseBranch: Options.withDescription(
          Options.optional(Options.withAlias(Options.text('baseBranch'), 'b')),
          'Base branch to create the new branch from',
        ),
        reset: Options.withDescription(
          Options.withAlias(Options.boolean('reset'), 'r'),
          'Reset the branch if it already exists',
        ),
        open: Options.withDescription(
          Options.withAlias(Options.boolean('open'), 'o'),
          'Open the ticket for the current branch or the given ticket in the browser',
        ),
      }),
      args: Args.withDescription(
        Args.atMost(Args.text({name: 'jira-key'}), 1),
        'The Jira ticket key to create a branch for (e.g. FOOX-1234)',
      ),
    },
    (
      args,
    ): Effect.Effect<
      void,
      GitCreateJiraBranchError,
      | AppConfigService
      | GitClient
      | JiraClient
      | CommandExecutor.CommandExecutor
    > => {
      const command = GitCreateJiraBranch({
        baseBranch: args.options.baseBranch,
        reset: args.options.reset,
        open: args.options.open,
        jiraKey: Option.fromNullable(args.args[0]),
      });

      if (command.open) {
        return pipe(
          command.jiraKey,
          Option.match({
            onSome: (jiraKey) => ticketUrl(jiraKey),
            onNone: () => ticketUrlForCurrentBranch(),
          }),
          Effect.tap((url) =>
            Console.log(
              `Opening ticket url '${url}' in your default browser...`,
            ),
          ),
          Effect.flatMap(openUrl),
        );
      }

      if (isNone(command.jiraKey)) {
        return printDocs(HelpDoc.p(Span.error('No Jira Key provided')));
      }

      return Effect.flatMap(
        gitCreateJiraBranch(
          command.jiraKey.value,
          command.baseBranch,
          command.reset,
        ),
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
    HelpDoc.p(
      `Fetches the given Jira ticket and creates an aproriately named branch for it.
The branch type (bug or feat) is determined by the ticket type. The branch name
is based on the ticket summary.`,
    ),
  ),
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
      printDocs(HelpDoc.p(Span.error(HelpDoc.getSpan(e.error)))),
    ),
    Effect.catchAll((e) => printDocs(HelpDoc.p(Span.error(e.message)))),
  );

const printDocs = (doc: HelpDoc.HelpDoc): Effect.Effect<void> =>
  Console.log(HelpDoc.toAnsiText(doc));
