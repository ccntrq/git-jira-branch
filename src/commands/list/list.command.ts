import {Command} from '@effect/cli';
import {Console, Effect, pipe} from 'effect';
import {getAssociatedBranches} from '../../utils/associated-branch';
import {formatBranches} from '../../utils/branch-formatter';

export const list = pipe(
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
