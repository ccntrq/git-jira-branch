import {Effect} from 'effect';
import {JiraClient} from '../../services/jira-client';
import {fullJiraKey} from '../../utils/jira-key';
import {jiraKeyFromCurrentBranch} from '../../utils/jira-key-from-branch';

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
