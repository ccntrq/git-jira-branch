import {describe, expect, it} from 'vitest';
import {dummyJiraIssue} from '../test/dummies/dummyJiraIssue.js';
import {formatIssue} from './issue-formatter.js';

describe('issue-formatter', () => {
  describe('formatIssue', () => {
    it('should format issue', () =>
      expect(formatIssue(dummyJiraIssue)).toMatchSnapshot());
  });
});
