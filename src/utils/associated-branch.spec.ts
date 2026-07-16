import {live} from '@effect/vitest';
import {Chunk, Effect, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {
  mockGitClient,
  resetTestMocks,
  testLayer,
} from '../test/mock-implementations.js';
import {GitBranch, GitRemoteBranch} from '../types.js';
import {
  getAssociatedBranches,
  getAssociatedBranchesIncludingRemote,
  getAssociatedRemoteBranch,
} from './associated-branch.js';

beforeEach(() => {
  resetTestMocks();
  vi.clearAllMocks();
});

describe('getAssociatedBranches', () => {
  live('should list branches possibly associated with a jira ticket', () =>
    Effect.gen(function* () {
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable([
          ...[
            'feat/DUMMYAPP-123-dummy-isssue-summary',
            'feat/APP1-124-project-key-with-number',
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
              "remote": {
                "_id": "Option",
                "_tag": "None",
              },
            },
            {
              "isCurrent": false,
              "jiraKey": "APP1-124",
              "name": "feat/APP1-124-project-key-with-number",
              "remote": {
                "_id": "Option",
                "_tag": "None",
              },
            },
            {
              "isCurrent": false,
              "jiraKey": "DUMMYAPP-121",
              "name": "DUMMYAPP-121-asociated",
              "remote": {
                "_id": "Option",
                "_tag": "None",
              },
            },
            {
              "isCurrent": true,
              "jiraKey": "DUMMYAPP-122",
              "name": "fix/DUMMYAPP-122-another-isssue-summary",
              "remote": {
                "_id": "Option",
                "_tag": "None",
              },
            },
          ],
        }
      `);
    }),
  );
});

describe('getAssociatedBranchesIncludingRemote', () => {
  live('should append remote-only branches after local ones', () =>
    Effect.gen(function* () {
      mockGitClient.listBranches.mockSuccessValue(
        Chunk.fromIterable(
          ['feat/DUMMYAPP-123-local', 'master'].map((name) =>
            GitBranch({name, isCurrent: false}),
          ),
        ),
      );
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.fromIterable([
          // same key exists locally -> dropped
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-local',
          }),
          // remote-only, on two remotes -> deduped with origin preference
          GitRemoteBranch({
            remoteName: 'upstream',
            name: 'feat/DUMMYAPP-124-remote-only',
          }),
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-124-remote-only',
          }),
          // no jira key -> dropped
          GitRemoteBranch({remoteName: 'origin', name: 'master'}),
        ]),
      );

      const result = yield* Effect.provide(
        getAssociatedBranchesIncludingRemote(),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "_id": "Chunk",
          "values": [
            {
              "isCurrent": false,
              "jiraKey": "DUMMYAPP-123",
              "name": "feat/DUMMYAPP-123-local",
              "remote": {
                "_id": "Option",
                "_tag": "None",
              },
            },
            {
              "isCurrent": false,
              "jiraKey": "DUMMYAPP-124",
              "name": "feat/DUMMYAPP-124-remote-only",
              "remote": {
                "_id": "Option",
                "_tag": "Some",
                "value": "origin",
              },
            },
          ],
        }
      `);
    }),
  );
});

describe('getAssociatedRemoteBranch', () => {
  live('should find the remote branch associated with a jira ticket', () =>
    Effect.gen(function* () {
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.fromIterable([
          GitRemoteBranch({remoteName: 'origin', name: 'master'}),
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-remote-only',
          }),
        ]),
      );

      const result = yield* Effect.provide(
        getAssociatedRemoteBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toEqual(
        Option.some(
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-remote-only',
          }),
        ),
      );
    }),
  );

  live('should prefer origin when multiple remotes have the branch', () =>
    Effect.gen(function* () {
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.fromIterable([
          GitRemoteBranch({
            remoteName: 'upstream',
            name: 'feat/DUMMYAPP-123-remote-only',
          }),
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-remote-only',
          }),
        ]),
      );

      const result = yield* Effect.provide(
        getAssociatedRemoteBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toEqual(
        Option.some(
          GitRemoteBranch({
            remoteName: 'origin',
            name: 'feat/DUMMYAPP-123-remote-only',
          }),
        ),
      );
    }),
  );

  live('should return none when no remote branch matches', () =>
    Effect.gen(function* () {
      mockGitClient.listRemoteBranches.mockSuccessValue(
        Chunk.of(GitRemoteBranch({remoteName: 'origin', name: 'master'})),
      );

      const result = yield* Effect.provide(
        getAssociatedRemoteBranch('DUMMYAPP-123'),
        testLayer,
      );

      expect(result).toEqual(Option.none());
    }),
  );
});
