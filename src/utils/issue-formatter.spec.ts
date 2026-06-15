import {describe, expect, it} from 'vitest';
import {dummyJiraIssue} from '../test/dummies/dummyJiraIssue.js';
import {formatIssue} from './issue-formatter.js';

describe('issue-formatter', () => {
  describe('formatIssue', () => {
    it('should format issue', () =>
      expect(formatIssue(dummyJiraIssue)).toMatchSnapshot());

    it('should format ADF descriptions', () =>
      expect(
        formatIssue({
          ...dummyJiraIssue,
          fields: {
            ...dummyJiraIssue.fields,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{type: 'text', text: 'ADF description'}],
                },
              ],
            },
          },
        }),
      ).toContain('ADF description'));
  });
});
