import {Effect, Option, pipe} from 'effect';
import {GitClient} from '../services/git-client';
import {type GitExecError, UsageError} from '../types';

export const jiraKeyFromCurrentBranch = (): Effect.Effect<
  string,
  UsageError | GitExecError,
  GitClient
> =>
  pipe(
    GitClient,
    Effect.flatMap((_) => _.getCurrentBranch()),
    Effect.map(jiraKeyFromBranch),
    Effect.flatMap((key) =>
      Option.match({
        onNone: () =>
          Effect.fail(
            UsageError({message: 'No Jira Key found in current branch'}),
          ),
        onSome: (key: string) => Effect.succeed(key),
      })(key),
    ),
  );

export const jiraKeyFromBranch = (
  branchName: string,
): Option.Option<string> => {
  const res = branchName.match(/^(?:\w+\/)?([A-Z]+-\d+)/);
  return Option.fromNullable(res?.[1]);
};
