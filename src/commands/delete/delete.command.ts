import {Args, Command, Options} from '@effect/cli';
import {Console, Effect, pipe} from 'effect';
import type {NoAssociatedBranch} from '../../schema/no-associated-branch';
import type {AppConfigService} from '../../services/app-config';
import type {GitClient} from '../../services/git-client';
import {
  type AppConfigError,
  type DeletedBranch,
  type GitExecError,
  UsageError,
} from '../../types';
import {formatDeletedBranch} from '../../utils/result-formatter';
import {deleteBranch} from './delete.handler';

export const deleteCommand: Command.Command<
  'delete',
  AppConfigService | GitClient,
  AppConfigError | UsageError | GitExecError | NoAssociatedBranch,
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
        Effect.catchTag('BranchNotMerged', (e) =>
          Effect.fail(
            UsageError({
              message: `Branch not fully merged '${e.branch}'. 
- If you are sure you want to delete retry with \`--force\`              
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
