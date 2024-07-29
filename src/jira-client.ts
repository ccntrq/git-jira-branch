import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
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
  Effect.all([AppConfigService, HttpClient.HttpClient]).pipe(
    Effect.map(([env, httpClient]) =>
      JiraClient.of({
        getJiraIssue: (issueId: string) =>
          Effect.gen(function* () {
            const endPoint = `/rest/api/latest/issue/${issueId}`;
            const {jiraAuth, jiraApiUrl} = yield* env.getAppConfig;

            return yield* HttpClientRequest.get(jiraApiUrl + endPoint, {
              headers: {
                Authorization: buildJiraAuthorizationHeader(jiraAuth),
                Accept: 'application/json',
              },
            }).pipe(
              HttpClient.filterStatusOk(httpClient),
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(JiraIssueSchema),
              ),
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
      AppConfigError | ParseResult.ParseError | HttpClientError.HttpClientError
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
            message: `Failed to make ticket request to Jira: ${e.message}`,
          }),
        ),
      ),
      Effect.catchTag('ResponseError', (e) =>
        Effect.fail(
          JiraApiError({
            message:
              e.response.status === 404
                ? `Jira returned status 404. Make sure the ticket with id ${issueId} exists.`
                : `Jira Ticket request failed: ${e.message}`,
          }),
        ),
      ),
    );
