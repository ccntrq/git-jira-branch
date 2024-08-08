import {describe, expect, it} from 'vitest';
import {dummyJiraIssue} from '../test/dummies/dummyJiraIssue';
import {formatIssue} from './issue-formatter';

describe('issue-formatter', () => {
  describe('formatIssue', () => {
    it('should format issue', () =>
      expect(formatIssue(dummyJiraIssue)).toMatchSnapshot());
  });
});
