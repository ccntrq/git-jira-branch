import {Args, Command} from '@effect/cli';
import {Console, Effect, pipe} from 'effect';
import {compose} from 'effect/Function';
import {formatSwitchedBranch} from '../../utils/result-formatter.js';
import {switchBranch} from './switch.handler.js';

export const switchCommand = pipe(
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
