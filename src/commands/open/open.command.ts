import {Args, Command} from '@effect/cli';
import {pipe} from 'effect';
import {openTicket} from './open.handler';

export const open = pipe(
  Command.make(
    'open',
    {
      jiraKey: Args.withDescription(
        Args.optional(Args.text({name: 'jira-key'})),
        'The Jira key for the ticket to open (e.g. FOOX-1234)',
      ),
    },
    (args) => openTicket(args.jiraKey),
  ),
  Command.withDescription(
    `
Opens the given Jira ticket in your default browser. If no ticket is given the
jira ticket for the current branch is opened.`,
  ),
);
