import {Args, Command, Options} from '@effect/cli';
import {Console, Effect, pipe} from 'effect';
import {compose} from 'effect/Function';
import {formatGitCreateJiraBranchResult} from '../../utils/result-formatter';
import {gitCreateJiraBranch} from './create.handler';

export const create = pipe(
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
