import {Args, Command, Options} from '@effect/cli';
import {Console, Effect, Option, pipe} from 'effect';
import {resolveTicketSelection} from '../../services/ticket-selector.js';
import {type DeletedBranch, UsageError} from '../../types.js';
import {formatDeletedBranch} from '../../utils/result-formatter.js';
import {deleteBranch, deleteBranchByName} from './delete.handler.js';

export const deleteCommand = pipe(
  Command.make(
    'delete',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira ticket key associated with the branch to delete (e.g. FOOX-1234)',
      ),
      force: Options.withDescription(
        Options.boolean('force'),
        'Force branch deletion - use to delete not fully merged branches',
      ),
    },
    ({jiraKey, force}) =>
      resolveTicketSelection(jiraKey, {
        command: 'delete',
        type: Option.none(),
        reset: false,
      }).pipe(
        Effect.flatMap((selection) =>
          Option.match(selection.associatedBranch, {
            onSome: (branch) => deleteBranchByName(branch.name, force),
            onNone: () => deleteBranch(selection.key, force),
          }),
        ),
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
