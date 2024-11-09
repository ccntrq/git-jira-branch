import {ValidationError} from '@effect/cli';
import type {CliApp} from '@effect/cli/CliApp';
import * as Command from '@effect/cli/Command';
import * as HelpDoc from '@effect/cli/HelpDoc';
import * as Span from '@effect/cli/HelpDoc/Span';
import type * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Console, Effect, pipe} from 'effect';

import * as packageJson from '../package.json';
import {create} from './commands/create/create.command';
import {deleteCommand} from './commands/delete/delete.command';
import {info} from './commands/info/info.command';
import {list} from './commands/list/list.command';
import {open} from './commands/open/open.command';
import {switchCommand} from './commands/switch/switch.command';
import {tidy} from './commands/tidy/tidy.command';
import type {NoAssociatedBranch} from './schema/no-associated-branch';
import type {AppConfigService} from './services/app-config';
import type {GitClient} from './services/git-client';
import type {JiraClient} from './services/jira-client';
import type {GitJiraBranchError} from './types';

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
