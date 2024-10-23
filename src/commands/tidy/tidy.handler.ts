import {Chunk, Array as EArray, Effect, Option, pipe} from 'effect';
import {JiraClient} from '../../services/jira-client';
import {getAssociatedBranches} from '../../utils/associated-branch';
import {deleteBranch} from '../delete/delete.handler';

export const tidyUpBranches = (force: boolean) =>
  Effect.gen(function* () {
    const branches = yield* getAssociatedBranches();
    yield* Effect.logDebug(
      `Checking ticket status for branches: [${pipe(
        branches,
        Chunk.map((b) => `\n  ${b.name}`),
        Chunk.join(''),
      )}${Chunk.isEmpty(branches) ? '' : '\n'}]`,
    );

    const doneTickets = yield* Effect.forEach(
      branches,
      (branch) =>
        JiraClient.pipe(
          Effect.flatMap((jc) => jc.getJiraIssue(branch.jiraKey)),
          Effect.map(Option.some),
          Effect.catchTag('JiraApiError', (e) =>
            Effect.zipRight(
              Effect.logDebug(
                `Couldn't fetch info for '${branch.name}' Error: ${e.message}`,
              ),
              Effect.succeed(Option.none()),
            ),
          ),
        ),
      {concurrency: 10},
    ).pipe(
      Effect.map(EArray.getSomes),
      Effect.map(EArray.filter((ti) => ti.fields.status.name === 'Done')),
    );

    yield* Effect.logDebug(
      `Trying to delete branches for tickets: [${doneTickets.map((ti) => `${ti.key}`).join(', ')}]`,
    );

    const result = yield* Effect.forEach(doneTickets, (ti) =>
      deleteBranch(ti.key, force).pipe(
        Effect.mapError((e) => ({key: ti.key, error: e})),
        Effect.either,
      ),
    );

    return result;
  });
