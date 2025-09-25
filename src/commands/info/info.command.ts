import {Args, Command} from '@effect/cli';
import {Console, Effect, Option, pipe} from 'effect';
import {formatIssue} from '../../utils/issue-formatter.js';
import {ticketInfo, ticketInfoForCurrentBranch} from './info.handler.js';

export const info = pipe(
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
