import {live} from '@effect/vitest';
import {Chunk, Effect} from 'effect';
import {describe, expect} from 'vitest';
import {mockGitClient, testLayer} from '../test/mock-implementations';
import {GitBranch} from '../types';
import {getAssociatedBranches} from './associated-branch';

describe('getAssociatedBranches', () => {
  live('should list branches possibly associated with a jira ticket', () =>
    Effect.gen(function* () {
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable([
          ...[
            'feat/DUMMYAPP-123-dummy-isssue-summary',
            'DUMMYAPP-121-asociated',
            'master',
            '123-not-asociated',
            'dummyapp-121-also-not-asociated',
          ].map((name) => GitBranch({name, isCurrent: false})),
          GitBranch({
            name: 'fix/DUMMYAPP-122-another-isssue-summary',
            isCurrent: true,
          }),
        ]),
      );

      const result = yield* Effect.provide(getAssociatedBranches(), testLayer);

      expect(result).toMatchInlineSnapshot(`
        {
          "_id": "Chunk",
          "values": [
            {
              "isCurrent": false,
              "jiraKey": "DUMMYAPP-123",
              "name": "feat/DUMMYAPP-123-dummy-isssue-summary",
            },
            {
              "isCurrent": false,
              "jiraKey": "DUMMYAPP-121",
              "name": "DUMMYAPP-121-asociated",
            },
            {
              "isCurrent": true,
              "jiraKey": "DUMMYAPP-122",
              "name": "fix/DUMMYAPP-122-another-isssue-summary",
            },
          ],
        }
      `);
    }),
  );
});
