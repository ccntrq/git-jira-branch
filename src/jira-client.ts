import * as Http from '@effect/platform/HttpClient';
import * as ArrayFormatter from '@effect/schema/ArrayFormatter';
import type * as ParseResult from '@effect/schema/ParseResult';
import {Context, Effect, Layer} from 'effect';

import {AppConfigService} from './app-config';
import {
  type AppConfigError,
  JiraApiError,
  type JiraAuth,
  type JiraIssue,
  JiraIssueSchema,
} from './types';

export class JiraClient extends Context.Tag('JiraClient')<
  JiraClient,
  {
    readonly getJiraIssue: (
      issueKey: string,
    ) => Effect.Effect<JiraIssue, AppConfigError | JiraApiError>;
  }
>() {}

export const JiraClientLive = Layer.effect(
  JiraClient,
  Effect.all([AppConfigService, Http.client.Client]).pipe(
    Effect.map(([env, httpClient]) =>
      JiraClient.of({
        getJiraIssue: (issueId: string) =>
          Effect.gen(function* () {
            const endPoint = `/rest/api/latest/issue/${issueId}`;
            const {jiraAuth, jiraApiUrl} = yield* env.getAppConfig;

            return yield* Http.request
              .get(jiraApiUrl + endPoint, {
                headers: {
                  Authorization: buildJiraAuthorizationHeader(jiraAuth),
                  Accept: 'application/json',
                },
              })
              .pipe(
                Http.client.filterStatusOk(httpClient),
                Effect.flatMap(Http.response.schemaBodyJson(JiraIssueSchema)),
                Effect.scoped,
                handleJiraClientErrors(issueId),
              );
          }),
      }),
    ),
  ),
);

const buildJiraAuthorizationHeader = (jiraAuth: JiraAuth): string => {
  switch (jiraAuth._tag) {
    case 'JiraCloudAuth':
      return `Basic ${Buffer.from(
        `${jiraAuth.jiraUserEmail}:${jiraAuth.jiraApiToken}`,
      ).toString('base64')}`;
    case 'JiraDataCenterAuth':
      return `Bearer ${jiraAuth.jiraPat}`;
  }
};

const handleJiraClientErrors =
  (issueId: string) =>
  (
    eff: Effect.Effect<
      JiraIssue,
      AppConfigError | ParseResult.ParseError | Http.error.HttpClientError
    >,
  ): Effect.Effect<JiraIssue, AppConfigError | JiraApiError> =>
    eff.pipe(
      Effect.catchTag('ParseError', (e) =>
        Effect.fail(
          JiraApiError({
            message: [
              'Failed to parse ticket response from Jira:',
              ...ArrayFormatter.formatErrorSync(e).map(
                (issue) => `'${issue.path.join(' ')}': '${issue.message}'`,
              ),
            ].join('\n'),
          }),
        ),
      ),
      Effect.catchTag('RequestError', (e) =>
        Effect.fail(
          JiraApiError({
            message: `Failed to make ticket request to Jira. Reason: ${e.reason}`,
          }),
        ),
      ),
      Effect.catchTag('ResponseError', (e) =>
        Effect.fail(
          JiraApiError({
            message:
              e.response.status === 404
                ? `Jira returned status 404. Make sure the ticket with id ${issueId} exists.`
                : `Jira Ticket request returned failure. Reason: ${e.reason}${
                    typeof e.error === 'string' ? ` (${e.error})` : ''
                  } StatusCode: ${e.response.status}`,
          }),
        ),
      ),
    );
