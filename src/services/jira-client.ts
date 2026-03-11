import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import {Context, Effect, Layer, type ParseResult, pipe, Schema} from 'effect';

import {ArrayFormatter} from 'effect/ParseResult';
import {
  type AppConfigError,
  JiraApiError,
  type JiraAuth,
  type JiraIssue,
  JiraIssueSchema,
  JiraRemoteLink,
  JiraRemoteLinkSchema,
  type JiraRemoteLink as JiraRemoteLinkType,
} from '../types.js';
import {AppConfigService} from './app-config.js';

export class JiraClient extends Context.Tag('JiraClient')<
  JiraClient,
  {
    readonly getJiraIssue: (
      issueKey: string,
    ) => Effect.Effect<JiraIssue, AppConfigError | JiraApiError>;
    readonly listRemoteLinks: (
      issueKey: string,
    ) => Effect.Effect<
      ReadonlyArray<JiraRemoteLinkType>,
      AppConfigError | JiraApiError
    >;
    readonly createRemoteLink: (
      issueKey: string,
      remoteLink: JiraRemoteLinkType,
    ) => Effect.Effect<void, AppConfigError | JiraApiError>;
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

            const filteredClient = HttpClient.filterStatusOk(httpClient);

            return yield* pipe(
              HttpClientRequest.get(jiraApiUrl + endPoint, {
                headers: {
                  Authorization: buildJiraAuthorizationHeader(jiraAuth),
                  Accept: 'application/json',
                },
              }),
              filteredClient.execute,
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(JiraIssueSchema),
              ),
              Effect.scoped,
              handleJiraIssueErrors(issueId),
            );
          }),
        listRemoteLinks: (issueId: string) =>
          Effect.gen(function* () {
            const endPoint = `/rest/api/latest/issue/${issueId}/remotelink`;
            const {jiraAuth, jiraApiUrl} = yield* env.getAppConfig;

            const filteredClient = HttpClient.filterStatusOk(httpClient);

            const remoteLinks = yield* pipe(
              HttpClientRequest.get(jiraApiUrl + endPoint, {
                headers: {
                  Authorization: buildJiraAuthorizationHeader(jiraAuth),
                  Accept: 'application/json',
                },
              }),
              filteredClient.execute,
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(
                  Schema.Array(JiraRemoteLinkSchema),
                ),
              ),
              Effect.scoped,
              handleJiraRemoteLinksErrors(issueId),
            );

            return remoteLinks.map((remoteLink) =>
              JiraRemoteLink({
                url: remoteLink.object.url,
                title: remoteLink.object.title,
              }),
            );
          }),
        createRemoteLink: (issueId: string, remoteLink: JiraRemoteLinkType) =>
          Effect.gen(function* () {
            const endPoint = `/rest/api/latest/issue/${issueId}/remotelink`;
            const {jiraAuth, jiraApiUrl} = yield* env.getAppConfig;

            const filteredClient = HttpClient.filterStatusOk(httpClient);

            yield* pipe(
              HttpClientRequest.post(jiraApiUrl + endPoint, {
                headers: {
                  Authorization: buildJiraAuthorizationHeader(jiraAuth),
                  Accept: 'application/json',
                },
              }).pipe(
                HttpClientRequest.bodyUnsafeJson({
                  object: {
                    url: remoteLink.url,
                    title: remoteLink.title,
                  },
                }),
              ),
              filteredClient.execute,
              Effect.asVoid,
              Effect.scoped,
              handleVoidJiraClientErrors(issueId),
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

const handleJiraIssueErrors =
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

const handleJiraRemoteLinksErrors =
  (issueId: string) =>
  (
    eff: Effect.Effect<
      ReadonlyArray<{
        readonly object: {readonly url: string; readonly title: string};
      }>,
      AppConfigError | ParseResult.ParseError | HttpClientError.HttpClientError
    >,
  ): Effect.Effect<
    ReadonlyArray<{
      readonly object: {readonly url: string; readonly title: string};
    }>,
    AppConfigError | JiraApiError
  > =>
    eff.pipe(
      Effect.catchTag('ParseError', (e) =>
        Effect.fail(
          JiraApiError({
            message: [
              'Failed to parse remote link response from Jira:',
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

const handleVoidJiraClientErrors =
  (issueId: string) =>
  (
    eff: Effect.Effect<void, AppConfigError | HttpClientError.HttpClientError>,
  ): Effect.Effect<void, AppConfigError | JiraApiError> =>
    eff.pipe(
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
