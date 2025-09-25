import {HttpClient, HttpClientResponse} from '@effect/platform';
import {live} from '@effect/vitest';
import {ConfigProvider, Effect, Either, Layer} from 'effect';
import {describe, expect} from 'vitest';
import {dummyJiraIssue} from '../test/dummies/dummyJiraIssue';
import {JiraApiError, type JiraIssue} from '../types';
import {AppConfigService} from './app-config';
import {JiraClient, JiraClientLive} from './jira-client';

const appConfigTest = AppConfigService.Live.pipe(
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
        ]),
      ),
    ),
  ),
);

const mkHttpMock = (response: Response): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((req) =>
      Effect.succeed(HttpClientResponse.fromWeb(req, response)),
    ),
  );

const mkTestLayer = (
  response: Response,
): Layer.Layer<AppConfigService | HttpClient.HttpClient | JiraClient> => {
  const baseTestLayer = Layer.merge(appConfigTest, mkHttpMock(response));
  return Layer.merge(
    baseTestLayer,
    JiraClientLive.pipe(Layer.provide(baseTestLayer)),
  );
};

const testProg = Effect.gen(function* () {
  const jiraClient = yield* JiraClient;
  const ticket = yield* jiraClient.getJiraIssue('DUMMYAPP-123');
  return ticket;
});

describe('JiraClient', () => {
  live('should make ticket request', () =>
    Effect.gen(function* () {
      const res = yield* Effect.either(
        Effect.provide(testProg, mkTestLayer(Response.json(dummyJiraIssue))),
      );

      Either.match(res, {
        onLeft: (e) =>
          expect.unreachable(`Should have returned a ticket: ${e}`),
        onRight: (ticket) => expect(ticket).toEqual(dummyJiraIssue),
      });
    }),
  );

  live('should return ParseError for invalid response', () =>
    Effect.gen(function* () {
      const testIssue: Partial<JiraIssue> = {
        fields: {
          ...dummyJiraIssue.fields,
        },
      };
      const res = yield* Effect.either(
        Effect.provide(testProg, mkTestLayer(Response.json(testIssue))),
      );

      Either.match(res, {
        onLeft: (e) => {
          expect(e._tag).toBe('JiraApiError');
          expect(e.message).toMatchInlineSnapshot(`
            "Failed to parse ticket response from Jira:
            'key': 'is missing'"
          `);
        },
        onRight: (_) => expect.unreachable('Should have returned an error.'),
      });
    }),
  );

  live('should handle 404 NOT_FOUND errors', () =>
    Effect.gen(function* () {
      const failedResponse = new Response(null, {status: 404});

      const res = yield* Effect.either(
        Effect.provide(testProg, mkTestLayer(failedResponse)),
      );

      Either.match(res, {
        onLeft: (e) =>
          expect(e).toMatchInlineSnapshot(`
          {
            "_tag": "JiraApiError",
            "message": "Jira returned status 404. Make sure the ticket with id DUMMYAPP-123 exists.",
          }
        `),
        onRight: (_) => expect.unreachable('Should have returned an error.'),
      });
    }),
  );

  live('should return error for response with non 200 status', () =>
    Effect.gen(function* () {
      const failedResponse = new Response(null, {status: 500});

      const res = yield* Effect.either(
        Effect.provide(testProg, mkTestLayer(failedResponse)),
      );

      Either.match(res, {
        onLeft: (e) =>
          expect(e).toEqual(
            JiraApiError({
              message:
                'Jira Ticket request failed: StatusCode: non 2xx status code (500 GET https://dummy-jira-instance.com/rest/api/latest/issue/DUMMYAPP-123)',
            }),
          ),
        onRight: (_) => expect.unreachable('Should have returned an error.'),
      });
    }),
  );
});
