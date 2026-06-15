import {describe, expect, it} from 'vitest';
import {jiraDescriptionToText} from './jira-description.js';

describe('jiraDescriptionToText', () => {
  it('returns plain string descriptions unchanged', () => {
    expect(jiraDescriptionToText('Plain description')).toBe(
      'Plain description',
    );
  });

  it('extracts text from Atlassian Document Format descriptions', () => {
    expect(
      jiraDescriptionToText({
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{type: 'text', text: 'First paragraph'}],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {type: 'text', text: '#123'},
                  {type: 'text', text: ' Update dependency'},
                ],
              },
            ],
          },
        ],
      }),
    ).toBe('First paragraph\n#123 Update dependency');
  });

  it('renders ADF date nodes as ISO dates', () => {
    expect(
      jiraDescriptionToText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{type: 'date', attrs: {timestamp: '1718409600000'}}],
          },
        ],
      }),
    ).toBe('2024-06-15');
  });

  it('ignores ADF date nodes with a non-numeric timestamp', () => {
    expect(
      jiraDescriptionToText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {type: 'text', text: 'Due '},
              {type: 'date', attrs: {timestamp: 'not-a-timestamp'}},
            ],
          },
        ],
      }),
    ).toBe('Due');
  });

  it('returns an empty string for nullish descriptions', () => {
    expect(jiraDescriptionToText(null)).toBe('');
    expect(jiraDescriptionToText(undefined)).toBe('');
  });
});
