import {Effect} from 'effect';
import {JiraClient} from '../../services/jira-client.js';
import {fullJiraKey} from '../../utils/jira-key.js';
import {jiraKeyFromCurrentBranch} from '../../utils/jira-key-from-branch.js';

export const ticketInfoForCurrentBranch = () =>
  jiraKeyFromCurrentBranch().pipe(Effect.flatMap(ticketInfo));

export const ticketInfo = (jiraKey: string) =>
  Effect.gen(function* () {
    const jiraClient = yield* JiraClient;

    const issue = yield* fullJiraKey(jiraKey).pipe(
      Effect.flatMap(jiraClient.getJiraIssue),
    );

    return issue;
  });
