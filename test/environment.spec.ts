import { Environment, EnvironmentLive } from "../src/environment";
import { ConfigProvider, Effect, Layer } from "effect";
import * as Option from "effect/Option";
import { it, describe, expect, assert } from "vitest";

const testProg = Effect.all([Environment]).pipe(
  Effect.flatMap(([env]) => env.getEnv())
);

const mkTestLayer = (configProvider: ConfigProvider.ConfigProvider) =>
  Layer.setConfigProvider(configProvider).pipe(Layer.provide(EnvironmentLive));

describe("Environment", () => {
  it("should provide environment", () =>
    Effect.runPromise(
      Effect.gen(function* ($) {
        const configProvider = ConfigProvider.fromMap(
          new Map([
            ["JIRA_PAT", "dummy-jira-pat"],
            ["JIRA_API_URL", "https://dummy-jira-instance.com"],
            ["JIRA_KEY_PREFIX", "DUMMYAPP"],
          ])
        );

        const env = yield* $(
          Effect.provide(testProg, mkTestLayer(configProvider))
        );

        expect(env).toEqual({
          defaultJiraKeyPrefix: Option.some("DUMMYAPP"),
          jiraApiUrl: "https://dummy-jira-instance.com",
          jiraPat: "dummy-jira-pat",
        });
      })
    ));

  it("should provide environment with missing optional values", () =>
    Effect.runPromise(
      Effect.gen(function* ($) {
        const configProvider = ConfigProvider.fromMap(
          new Map([
            ["JIRA_PAT", "dummy-jira-pat"],
            ["JIRA_API_URL", "https://dummy-jira-instance.com"],
          ])
        );
        const environmentTest = Layer.setConfigProvider(configProvider).pipe(
          Layer.provide(EnvironmentLive)
        );

        const env = yield* $(Effect.provide(testProg, environmentTest));

        expect(env).toEqual({
          defaultJiraKeyPrefix: Option.none(),
          jiraApiUrl: "https://dummy-jira-instance.com",
          jiraPat: "dummy-jira-pat",
        });
      })
    ));

  it("should report missing configuration values", async () => {
    try {
      await Effect.runPromise(
        Effect.gen(function* ($) {
          const configProvider = ConfigProvider.fromMap(
            new Map([["JIRA_API_URL", "https://dummy-jira-instance.com"]])
          );
          const environmentTest = Layer.setConfigProvider(configProvider).pipe(
            Layer.provide(EnvironmentLive)
          );

          const env = yield* $(Effect.provide(testProg, environmentTest));
        })
      );
      assert.fail("should have thrown");
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        '[Error: {"_tag":"AppConfigError","message":"Expected JIRA_PAT to exist in the provided map"}]'
      );
    }
  });

  it("should report multiple missing configuration values", async () => {
    try {
      await Effect.runPromise(
        Effect.gen(function* ($) {
          const configProvider = ConfigProvider.fromMap(new Map());
          const environmentTest = Layer.setConfigProvider(configProvider).pipe(
            Layer.provide(EnvironmentLive)
          );

          const env = yield* $(Effect.provide(testProg, environmentTest));
        })
      );
      assert.fail("should have thrown");
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        '[Error: {"_tag":"AppConfigError","message":"Expected JIRA_PAT to exist in the provided map\\nExpected JIRA_API_URL to exist in the provided map"}]'
      );
    }
  });
});
