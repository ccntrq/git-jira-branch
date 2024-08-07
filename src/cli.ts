import {ValidationError} from '@effect/cli';
import * as Args from '@effect/cli/Args';
import type {CliApp} from '@effect/cli/CliApp';
import * as Command from '@effect/cli/Command';
import * as HelpDoc from '@effect/cli/HelpDoc';
import * as Span from '@effect/cli/HelpDoc/Span';
import * as Options from '@effect/cli/Options';
import type * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Console, Effect, Option, pipe} from 'effect';
import {compose} from 'effect/Function';

import {catchTag} from 'effect/Effect';
import * as packageJson from '../package.json';
import type {AppConfigService} from './app-config';
import {formatBranches} from './branch-formatter';
import {
  deleteBranch,
  getAssociatedBranches,
  gitCreateJiraBranch,
  switchBranch,
  ticketInfo,
  ticketInfoForCurrentBranch,
  ticketUrl,
  ticketUrlForCurrentBranch,
} from './core';
import type {GitClient} from './git-client';
import {formatIssue} from './issue-formatter';
import type {JiraClient} from './jira-client';
import {
  type AppConfigError,
  type DeletedBranch,
  type GitExecError,
  type GitJiraBranchError,
  type SwitchedBranch,
  UsageError,
  matchGitCreateJiraBranchResult,
} from './types';
import {openUrl} from './url-opener';

// for version and help
const gitJiraBranch = pipe(Command.make('git-jira-branch', {}));

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
        compose(formatGitCreateJiraBranchResult, Console.log),
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

const switchCommand = pipe(
  Command.make(
    'switch',
    {
      jiraKey: Args.withDescription(
        Args.text({name: 'jira-key'}),
        'The Jira ticket key associated with the branch to switch to (e.g. FOOX-1234)',
      ),
    },
    ({jiraKey}) =>
      switchBranch(jiraKey).pipe(
        Effect.flatMap(compose(formatSwitchedBranch, Console.log)),
      ),
  ),
  Command.withDescription(
    `
Switches to an already existing branch that is associated with the given Jira
ticket.`,
  ),
);

const deleteCommand: Command.Command<
  'delete',
  AppConfigService | GitClient,
  AppConfigError | UsageError | GitExecError,
  {readonly jiraKey: string; readonly force: boolean}
> = pipe(
  Command.make(
    'delete',
    {
      jiraKey: Args.withDescription(
        Args.text({name: 'jira-key'}),
        'The Jira ticket key associated with the branch to delete (e.g. FOOX-1234)',
      ),
      force: Options.withDescription(
        Options.boolean('force'),
        'Force branch deletion - use to delete not fully merged branches',
      ),
    },
    ({jiraKey, force}) =>
      deleteBranch(jiraKey, force).pipe(
        Effect.flatMap((res: DeletedBranch) =>
          pipe(res, formatDeletedBranch, Console.log),
        ),
        catchTag('BranchNotMerged', (e) =>
          Effect.fail(
            UsageError({
              message: `Branch not fully merged '${e.branch}'. 
- try with \`--force\`              
              `,
            }),
          ),
        ),
      ),
  ),
  Command.withDescription(
    `
Deletes the branch associated with the given Jira Ticket.`,
  ),
);

const openCommand = pipe(
  Command.make(
    'open',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira key for the ticket to open (e.g. FOOX-1234)',
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

const infoCommand = pipe(
  Command.make(
    'info',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira key for the ticket to get information for (e.g. FOOX-1234)',
      ),
    },
    ({jiraKey}) =>
      pipe(
        jiraKey,
        Option.match({
          onSome: ticketInfo,
          onNone: () => ticketInfoForCurrentBranch(),
        }),
        Effect.map(formatIssue),
        Effect.flatMap(Console.log),
      ),
  ),
  Command.withDescription(
    `
Displays information for the given Jira ticket on your terminal. If no ticket is
provided, it presents information for the Jira ticket associated with the
current branch.`,
  ),
);

const listCommand = pipe(
  Command.make('list', {}, () =>
    pipe(
      getAssociatedBranches(),
      Effect.map(formatBranches),
      Effect.flatMap(Console.log),
    ),
  ),
  Command.withDescription(
    `
Lists all branches that appear to be associated with a Jira ticket.`,
  ),
);

const mainCommand = gitJiraBranch.pipe(
  Command.withSubcommands([
    createCommand,
    switchCommand,
    deleteCommand,
    openCommand,
    infoCommand,
    listCommand,
  ]),
);

const cli = {
  name: packageJson.name,
  version: packageJson.version,
  summary: Span.text(packageJson.description),
};

export const cliEffect = (
  args: Array<string>,
): Effect.Effect<
  void,
  GitJiraBranchError | ValidationError.ValidationError,
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
    Effect.tapError((e) => {
      if (ValidationError.isValidationError(e)) {
        // handled and printed by the cli library already
        return Effect.void;
      }
      return printDocs(HelpDoc.p(Span.error(e.message)));
    }),
  );

const formatSwitchedBranch = (switchedBranch: SwitchedBranch): string =>
  `Switched to already existing branch: '${switchedBranch.branch}'`;

const formatDeletedBranch = (deletedBranch: DeletedBranch): string =>
  `Deleted branch: '${deletedBranch.branch}'`;

const formatGitCreateJiraBranchResult = matchGitCreateJiraBranchResult({
  onCreatedBranch: ({branch}) => `Successfully created branch: '${branch}'`,
  onSwitchedBranch: formatSwitchedBranch,
  onDeletedBranch: formatDeletedBranch,
  onResetBranch: ({branch}) => `Reset branch: '${branch}'`,
});

const printDocs = (doc: HelpDoc.HelpDoc): Effect.Effect<void> =>
  Console.log(HelpDoc.toAnsiText(doc));
