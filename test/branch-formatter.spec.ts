import {Chunk} from 'effect';
import {describe, expect, it} from 'vitest';
import {formatBranches} from '../src/branch-formatter';
import {GitBranch} from '../src/types';

describe('branch-formatter', () => {
  describe('formatBranches', () => {
    it('should format branches with current', () =>
      expect(
        formatBranches(
          Chunk.fromIterable([
            GitBranch({
              name: 'feat/DUMMYAPP-123-dummy-issue-summary',
              isCurrent: true,
            }),
            GitBranch({
              name: 'feat/DUMMYAPP-124-another-issue-summary',
              isCurrent: false,
            }),
          ]),
        ),
      ).toMatchSnapshot());
  });

  it('should format branches without current', () =>
    expect(
      formatBranches(
        Chunk.fromIterable([
          GitBranch({
            name: 'feat/DUMMYAPP-123-dummy-issue-summary',
            isCurrent: false,
          }),
          GitBranch({
            name: 'feat/DUMMYAPP-124-another-issue-summary',
            isCurrent: false,
          }),
        ]),
      ),
    ).toMatchSnapshot());
});
