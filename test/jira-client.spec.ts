import { ConfigProvider, Effect, Layer } from "effect";
import * as Http from "@effect/platform/HttpClient";

import { EnvironmentLive } from "../src/environment";
import { JiraClient, JiraClientLive } from "../src/jira-client";
import { JiraIssue } from "../src/types";

import { it, describe, expect, assert } from "vitest";

const environmentTest = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["JIRA_PAT", "dummy-jira-pat"],
      ["JIRA_API_URL", "https://dummy-jira-instance.com"],
      ["JIRA_KEY_PREFIX", "DUMMYAPP"],
    ])
  )
).pipe(Layer.provide(EnvironmentLive));

const mkHttpMock = (response: Response) =>
  Layer.succeed(
    Http.client.Client,
    Http.client.make((req) =>
      Effect.succeed(Http.response.fromWeb(req, response))
    )
  );

const mkTestLayer = (response: Response) => {
  const baseTestLayer = Layer.merge(environmentTest, mkHttpMock(response));
  return Layer.merge(
    baseTestLayer,
    baseTestLayer.pipe(Layer.provide(JiraClientLive))
  );
};

const testProg = Effect.gen(function* ($) {
  const jiraClient = yield* $(JiraClient);
  const ticket = yield* $(jiraClient.getJiraIssue("DUMMYAPP-123"));
  return ticket;
});

describe("JiraClient", () => {
  it("should make ticket request", async () => {
    const testIssue: JiraIssue = {
      key: "DUMMYAPP-123",
      fields: {
        summary: "Dummy isssue summary",
        issuetype: {
          name: "Feature",
        },
      },
    };

    await Effect.runPromise(
      Effect.provide(
        testProg.pipe(
          Effect.tap((ticket) =>
            Effect.succeed(expect(ticket).toEqual(testIssue))
          ),
          Effect.catchAll((e) =>
            Effect.succeed(assert.fail(`Unexpected error: ${e}`))
          )
        ),
        mkTestLayer(Response.json(testIssue))
      )
    );
  });
  it("should return ParseError for invalid response", async () => {
    const testIssue: Partial<JiraIssue> = {
      fields: {
        summary: "Dummy isssue summary",
        issuetype: {
          name: "Feature",
        },
      },
    };

    await Effect.runPromise(
      Effect.provide(
        testProg.pipe(
          Effect.tap((ticket) =>
            Effect.succeed(assert.fail("Should have failed"))
          ),
          Effect.catchAll((e) =>
            Effect.succeed(
              expect(e).toMatchInlineSnapshot(`
              {
                "_tag": "JiraApiError",
                "message": "Failed to parse ticket response from Jira:
              'key': 'Missing key or index'",
              }
            `)
            )
          )
        ),
        mkTestLayer(Response.json(testIssue))
      )
    );
  });

  it("should return error for response with non 200 status", async () => {
    const failedResponse = new Response(null, { status: 404 });

    await Effect.runPromise(
      Effect.provide(
        testProg.pipe(
          Effect.tap((ticket) =>
            Effect.succeed(assert.fail("Should have failed"))
          ),
          Effect.catchAll((e) =>
            Effect.succeed(
              expect(e).toMatchInlineSnapshot(`
                {
                  "_tag": "JiraApiError",
                  "message": "Jira Ticket request returned failure. Reason: StatusCode (non 2xx status code) StatusCode: 404",
                }
              `)
            )
          )
        ),
        mkTestLayer(failedResponse)
      )
    );
  });
});
