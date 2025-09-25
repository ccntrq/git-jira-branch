import type {JiraIssue} from '../../types.js';

export const dummyJiraIssue: JiraIssue = {
  key: 'DUMMYAPP-123',
  fields: {
    summary: 'Dummy isssue summary',
    issuetype: {
      name: 'Feature',
    },
    status: {
      name: 'done',
    },
    description: `Dummy issue description.
    
This is a multiline description with some very very long lines that should be broken up into multiple lines when rendered.

* This is a list item
* This is a list item
`,
    assignee: {
      displayName: 'Peter Pan',
    },
    creator: {
      displayName: 'Wendy Darling',
    },
  },
};
