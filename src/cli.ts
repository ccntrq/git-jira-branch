import {ValidationError} from '@effect/cli';
import type {CliApp} from '@effect/cli/CliApp';
import * as Command from '@effect/cli/Command';
import * as HelpDoc from '@effect/cli/HelpDoc';
import * as Span from '@effect/cli/HelpDoc/Span';
import type * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Console, Effect, pipe} from 'effect';

import packageJson from '../package.json' with {type: 'json'};
import {create} from './commands/create/create.command.js';
import {deleteCommand} from './commands/delete/delete.command.js';
import {info} from './commands/info/info.command.js';
import {list} from './commands/list/list.command.js';
import {open} from './commands/open/open.command.js';
import {switchCommand} from './commands/switch/switch.command.js';
import {tidy} from './commands/tidy/tidy.command.js';
import type {NoAssociatedBranch} from './schema/no-associated-branch.js';
import type {AppConfigService} from './services/app-config.js';
import type {GitClient} from './services/git-client.js';
import type {JiraClient} from './services/jira-client.js';
import type {GitJiraBranchError} from './types.js';

// for version and help
const gitJiraBranch = pipe(Command.make('git-jira-branch', {}));

const mainCommand = gitJiraBranch.pipe(
  Command.withSubcommands([
    create,
    switchCommand,
    deleteCommand,
    open,
    info,
    list,
    tidy,
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
  GitJiraBranchError | ValidationError.ValidationError | NoAssociatedBranch,
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
      return printErrors(HelpDoc.p(Span.error(e.message)));
    }),
  );

const printErrors = (doc: HelpDoc.HelpDoc): Effect.Effect<void> =>
  Console.error(HelpDoc.toAnsiText(doc));
