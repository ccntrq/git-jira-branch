import {Option} from 'effect';
import type {JiraIssue, JiraIssuetype} from '../types.js';
import {slugify} from './slugger.js';

export const jiraIssueToBranchName = (
  issue: JiraIssue,
  type: Option.Option<string>,
): string => {
  const branchtype = Option.getOrElse(type, () =>
    jiraIssuetypeBranchtype(issue.fields.issuetype),
  );
  const prefix = branchtype.length === 0 ? '' : `${branchtype}/`;
  return `${prefix}${issue.key}-${slugify(issue.fields.summary)}`;
};

const jiraIssuetypeBranchtype = (issuetype: JiraIssuetype): string => {
  if (issuetype.name.match(/bug/i)) {
    return 'fix';
  }

  if (issuetype.name.match(/task|aufgabe/i)) {
    return 'task';
  }

  return 'feat';
};
