import { Config, ConfigError, Context, Effect, Layer } from "effect";
import * as Option from "effect/Option";

import { AppConfigError, JiraApiUrl, JiraKeyPrefix, JiraPat } from "./types";

export interface Environment {
  readonly getEnv: () => Effect.Effect<
    never,
    AppConfigError,
    {
      jiraPat: JiraPat;
      jiraApiUrl: JiraApiUrl;
      defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>;
    }
  >;
}

export const Environment = Context.Tag<Environment>();

export const EnvironmentLive = Layer.succeed(
  Environment,
  Environment.of({
    getEnv: () =>
      Effect.all([
        Effect.config(Config.string("JIRA_PAT")),
        Effect.config(Config.string("JIRA_API_URL")),
        Effect.config(Config.option(Config.string("JIRA_KEY_PREFIX"))),
      ]).pipe(
        Effect.map(([jiraPat, jiraApiUrl, defaultJiraKeyPrefix]) => ({
          jiraPat: JiraPat(jiraPat),
          jiraApiUrl: JiraApiUrl(jiraApiUrl),
          defaultJiraKeyPrefix: Option.map(defaultJiraKeyPrefix, JiraKeyPrefix),
        })),
        Effect.catchAll((e) => {
          return Effect.fail(
            ConfigError.reduceWithContext(
              e,
              void 0,
              mkConfigErrorToAppConfigErrorReducer()
            )
          );
        })
      ),
  })
);

const mkConfigErrorToAppConfigErrorReducer = (): ConfigError.ConfigErrorReducer<
  unknown,
  AppConfigError
> => {
  const collectMessage = (_: unknown, _path: string[], message: string) =>
    AppConfigError({ message });

  const mergeErrors = (
    _: unknown,
    left: AppConfigError,
    right: AppConfigError
  ) => AppConfigError({ message: `${left.message}\n${right.message}` });

  return {
    andCase: mergeErrors,
    orCase: mergeErrors,
    invalidDataCase: collectMessage,
    missingDataCase: collectMessage,
    sourceUnavailableCase: collectMessage,
    unsupportedCase: collectMessage,
  };
};
