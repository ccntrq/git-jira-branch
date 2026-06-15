import {Args, Command} from '@effect/cli';
import {Console, Effect, Option, pipe} from 'effect';
import {compose} from 'effect/Function';
import {resolveTicketSelection} from '../../services/ticket-selector.js';
import {formatSwitchedBranch} from '../../utils/result-formatter.js';
import {switchBranch, switchBranchByName} from './switch.handler.js';

export const switchCommand = pipe(
  Command.make(
    'switch',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira ticket key associated with the branch to switch to (e.g. FOOX-1234)',
      ),
    },
    ({jiraKey}) =>
      resolveTicketSelection(jiraKey, {
        command: 'switch',
        type: Option.none(),
        reset: false,
      }).pipe(
        Effect.flatMap((selection) =>
          Option.match(selection.associatedBranch, {
            onSome: (branch) => switchBranchByName(branch.name),
            onNone: () => switchBranch(selection.key),
          }),
        ),
        Effect.flatMap(compose(formatSwitchedBranch, Console.log)),
      ),
  ),
  Command.withDescription(
    `
Switches to an already existing branch that is associated with the given Jira
ticket.`,
  ),
);
