import {Chunk} from 'effect';
import {describe, expect, it} from 'vitest';
import {LocalGitBranch} from '../types.js';
import {formatBranches} from './branch-formatter.js';

describe('branch-formatter', () => {
  describe('formatBranches', () => {
    it('should format branches with current', () =>
      expect(
        formatBranches(
          Chunk.fromIterable([
            LocalGitBranch({
              name: 'feat/DUMMYAPP-123-dummy-issue-summary',
              isCurrent: true,
            }),
            LocalGitBranch({
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
          LocalGitBranch({
            name: 'feat/DUMMYAPP-123-dummy-issue-summary',
            isCurrent: false,
          }),
          LocalGitBranch({
            name: 'feat/DUMMYAPP-124-another-issue-summary',
            isCurrent: false,
          }),
        ]),
      ),
    ).toMatchSnapshot());
});
