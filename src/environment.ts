import {Config, ConfigError, Context, Effect, Layer} from 'effect';
import * as Option from 'effect/Option';

import {
  AppConfig,
  AppConfigError,
  JiraApiToken,
  JiraApiUrl,
  JiraCloudAuth,
  JiraDataCenterAuth,
  JiraKeyPrefix,
  JiraPat,
  JiraUserEmail,
} from './types';

export interface Environment {
  readonly getEnv: () => Effect.Effect<never, AppConfigError, AppConfig>;
}

export const Environment = Context.Tag<Environment>();

export const EnvironmentLive = Layer.succeed(
  Environment,
  Environment.of({
    getEnv: () =>
      Effect.all(
        [
          Config.string('JIRA_API_URL'),
          Config.option(Config.string('JIRA_PAT')),
          Config.option(Config.string('JIRA_USER_EMAIL')),
          Config.option(Config.string('JIRA_API_TOKEN')),
          Config.option(Config.string('JIRA_KEY_PREFIX')),
        ],
        {concurrency: 'unbounded', mode: 'validate'},
      ).pipe(
        Effect.catchAll((maybeErrors) => {
          return Effect.fail(
            AppConfigError({
              message: Option.reduceCompact<ConfigError.ConfigError, string[]>(
                maybeErrors,
                [],
                (acc, e) =>
                  acc.concat(
                    ConfigError.reduceWithContext(
                      e,
                      void 0,
                      mkCollectConfigErrorMessagesReducer(),
                    ),
                  ),
              ).join('\n'),
            }),
          );
        }),
        Effect.flatMap(
          ([
            jiraApiUrl,
            jiraPat,
            jiraUserEmail,
            jiraApiToken,
            defaultJiraKeyPrefix,
          ]) =>
            Effect.gen(function* (_) {
              if (
                Option.isSome(jiraPat) &&
                (Option.isSome(jiraUserEmail) || Option.isSome(jiraApiToken))
              ) {
                return yield* _(
                  Effect.fail(
                    AppConfigError({
                      message:
                        'Please provide either JIRA_PAT (for Jira Data Center) or JIRA_API_TOKEN and JIRA_USER_EMAIL (for Jira Cloud), but not both',
                    }),
                  ),
                );
              }

              if (Option.isSome(jiraPat)) {
                return {
                  jiraAuth: JiraDataCenterAuth({
                    jiraPat: JiraPat(jiraPat.value),
                  }),
                  jiraApiUrl: JiraApiUrl(jiraApiUrl),
                  defaultJiraKeyPrefix: Option.map(
                    defaultJiraKeyPrefix,
                    JiraKeyPrefix,
                  ),
                };
              }

              if (Option.isSome(jiraApiToken) && Option.isSome(jiraUserEmail)) {
                return {
                  jiraAuth: JiraCloudAuth({
                    jiraApiToken: JiraApiToken(jiraApiToken.value),
                    jiraUserEmail: JiraUserEmail(jiraUserEmail.value),
                  }),
                  jiraApiUrl: JiraApiUrl(jiraApiUrl),
                  defaultJiraKeyPrefix: Option.map(
                    defaultJiraKeyPrefix,
                    JiraKeyPrefix,
                  ),
                };
              }

              return yield* _(
                Effect.fail(
                  AppConfigError({
                    message:
                      'Please provide JIRA_PAT (for Jira Data Center) or JIRA_API_TOKEN and JIRA_USER_EMAIL (for Jira Cloud).',
                  }),
                ),
              );
            }),
        ),
      ),
  }),
);

const mkCollectConfigErrorMessagesReducer = (): ConfigError.ConfigErrorReducer<
  unknown,
  string[]
> => {
  const collectMessage = (
    _: unknown,
    _path: string[],
    message: string,
  ): string[] => [message];

  const mergeErrors = (
    _: unknown,
    left: string[],
    right: string[],
  ): string[] => [...left, ...right];

  return {
    andCase: mergeErrors,
    orCase: mergeErrors,
    invalidDataCase: collectMessage,
    missingDataCase: collectMessage,
    sourceUnavailableCase: collectMessage,
    unsupportedCase: collectMessage,
  };
};
