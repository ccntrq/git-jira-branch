import {Command, Options} from '@effect/cli';
import {Console, Array as EArray, Effect, pipe} from 'effect';
import {tidyUpBranches} from './tidy.handler';

export const tidy = pipe(
  Command.make(
    'tidy',
    {
      force: Options.withDescription(
        Options.boolean('force'),
        'Force branch deletion - use to delete not fully merged branches',
      ),
    },
    ({force}) =>
      tidyUpBranches(force).pipe(
        Effect.andThen((res) =>
          Effect.all([
            pipe(
              res,
              EArray.getLefts,
              EArray.map((e) =>
                e.error._tag === 'BranchNotMerged'
                  ? `Branch for ticket '${e.key}' '${e.error.branch}' is not fully merged. If you are sure you want to delete run with '-f'`
                  : `Failed to delete branch for ticket '${e.key}' Error: ${e.error.message}'`,
              ),
              EArray.map((e) => Console.error(e)),
              Effect.all,
            ),
            pipe(res, EArray.getRights, (deleted) =>
              deleted.length > 0
                ? Console.log(
                    `Deleted branches: [
${deleted.map((d) => d.branch).join('\n')}
]`,
                  )
                : Console.log('No branches deleted.'),
            ),
          ]),
        ),
      ),
  ),
  Command.withDescription(
    `
Deletes branches for tickets that are done.`,
  ),
);
