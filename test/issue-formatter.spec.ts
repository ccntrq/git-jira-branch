import {describe, expect, it} from 'vitest';
import {formatIssue} from '../src/issue-formatter';
import {dummyJiraIssue} from './dummies/dummyJiraIssue';

describe('issue-formatter', () => {
  describe('formatIssue', () => {
    it('should format issue', () =>
      expect(formatIssue(dummyJiraIssue)).toMatchSnapshot());
  });
});
