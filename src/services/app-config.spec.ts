import {live} from '@effect/vitest';
import {ConfigProvider, Effect, Either, Layer, pipe} from 'effect';
import * as Option from 'effect/Option';
import {describe, expect} from 'vitest';
import {
  JiraApiToken,
  JiraCloudAuth,
  JiraDataCenterAuth,
  JiraPat,
  JiraUserEmail,
} from '../types.js';
import {AppConfigService} from './app-config.js';

const testProg = AppConfigService.pipe(Effect.flatMap((_) => _.getAppConfig));

const mkTestLayer = (
  configProvider: ConfigProvider.ConfigProvider,
): Layer.Layer<AppConfigService> =>
  AppConfigService.Live.pipe(
    Layer.provide(Layer.setConfigProvider(configProvider)),
  );

describe('AppConfigService', () => {
  live('should provide jira data center appconfig', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
        ]),
      );

      const env = yield* Effect.provide(testProg, mkTestLayer(configProvider));

      expect(env).toEqual({
        defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
        jiraApiUrl: 'https://dummy-jira-instance.com',
        jiraAuth: JiraDataCenterAuth({
          jiraPat: JiraPat('dummy-jira-pat'),
        }),
      });
    }),
  );

  live('should provide jira cloud appconfig', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_API_TOKEN', 'dummy-jira-api-token'],
          ['JIRA_USER_EMAIL', 'dummyuser@example.com'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
        ]),
      );

      const env = yield* Effect.provide(testProg, mkTestLayer(configProvider));

      expect(env).toEqual({
        defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
        jiraApiUrl: 'https://dummy-jira-instance.com',
        jiraAuth: JiraCloudAuth({
          jiraApiToken: JiraApiToken('dummy-jira-api-token'),
          jiraUserEmail: JiraUserEmail('dummyuser@example.com'),
        }),
      });
    }),
  );

  live('should provide appconfig with missing optional values', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
        ]),
      );

      const env = yield* Effect.provide(testProg, mkTestLayer(configProvider));

      expect(env).toEqual({
        defaultJiraKeyPrefix: Option.none(),
        jiraApiUrl: 'https://dummy-jira-instance.com',
        jiraAuth: JiraDataCenterAuth({
          jiraPat: JiraPat('dummy-jira-pat'),
        }),
      });
    }),
  );

  live('should report missing configuration values', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([['JIRA_API_URL', 'https://dummy-jira-instance.com']]),
      );

      const result = yield* Effect.either(
        Effect.provide(testProg, mkTestLayer(configProvider)),
      );
      Either.match(result, {
        onLeft: (e) => expect(e).toMatchSnapshot(),
        onRight: (_) => expect.unreachable('Should have returned an error'),
      });
    }),
  );

  live(
    '`defaultJiraKeyPrefix` should work with missing configuration values',
    () =>
      Effect.gen(function* () {
        const configProvider = ConfigProvider.fromMap(new Map());

        return yield* Effect.provide(
          AppConfigService.pipe(Effect.flatMap((_) => _.defaultJiraKeyPrefix)),
          mkTestLayer(configProvider),
        ).pipe(
          Effect.match({
            onFailure: () => expect.unreachable('should work without config'),
            onSuccess: (d) =>
              expect(d).toMatchInlineSnapshot(`
              {
                "_id": "Option",
                "_tag": "None",
              }
            `),
          }),
        );
      }),
  );

  live('should validate config values', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_API_TOKEN', ''],
          ['JIRA_USER_EMAIL', ''],
          ['JIRA_API_URL', ''],
          ['JIRA_KEY_PREFIX', ''],
        ]),
      );

      yield* pipe(
        Effect.provide(testProg, mkTestLayer(configProvider)),
        Effect.match({
          onSuccess: () => expect.unreachable('Should have returned an error'),
          onFailure: (e) => expect(e).toMatchSnapshot(),
        }),
      );
    }),
  );
});
