import {AppConfigService} from '../src/app-config';
import {ConfigProvider, Effect, Either, Layer} from 'effect';
import * as Option from 'effect/Option';
import {describe, expect} from 'vitest';
import {itEffect} from './util';
import {
  JiraApiToken,
  JiraCloudAuth,
  JiraDataCenterAuth,
  JiraPat,
  JiraUserEmail,
} from '../src/types';

const testProg = AppConfigService.pipe(Effect.flatMap((_) => _.getAppConfig));

const mkTestLayer = (
  configProvider: ConfigProvider.ConfigProvider,
): Layer.Layer<AppConfigService> =>
  AppConfigService.Live.pipe(
    Layer.provide(Layer.setConfigProvider(configProvider)),
  );

describe('AppConfigService', () => {
  itEffect('should provide jira data center appconfig', () =>
    Effect.gen(function* ($) {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
        ]),
      );

      const env = yield* $(
        Effect.provide(testProg, mkTestLayer(configProvider)),
      );

      expect(env).toEqual({
        defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
        jiraApiUrl: 'https://dummy-jira-instance.com',
        jiraAuth: JiraDataCenterAuth({
          jiraPat: JiraPat('dummy-jira-pat'),
        }),
      });
    }),
  );

  itEffect('should provide jira cloud appconfig', () =>
    Effect.gen(function* ($) {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_API_TOKEN', 'dummy-jira-api-token'],
          ['JIRA_USER_EMAIL', 'dummyuser@example.com'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['JIRA_KEY_PREFIX', 'DUMMYAPP'],
        ]),
      );

      const env = yield* $(
        Effect.provide(testProg, mkTestLayer(configProvider)),
      );

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

  itEffect('should provide appconfig with missing optional values', () =>
    Effect.gen(function* ($) {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
        ]),
      );

      const env = yield* $(
        Effect.provide(testProg, mkTestLayer(configProvider)),
      );

      expect(env).toEqual({
        defaultJiraKeyPrefix: Option.none(),
        jiraApiUrl: 'https://dummy-jira-instance.com',
        jiraAuth: JiraDataCenterAuth({
          jiraPat: JiraPat('dummy-jira-pat'),
        }),
      });
    }),
  );

  itEffect('should report missing configuration values', () =>
    Effect.gen(function* ($) {
      const configProvider = ConfigProvider.fromMap(
        new Map([['JIRA_API_URL', 'https://dummy-jira-instance.com']]),
      );

      const result = yield* $(
        Effect.either(Effect.provide(testProg, mkTestLayer(configProvider))),
      );
      Either.match(result, {
        onLeft: (e) => expect(e).toMatchSnapshot(),
        onRight: (_) => expect.unreachable('Should have returned an error'),
      });
    }),
  );

  itEffect('should validate config values', () =>
    Effect.gen(function* ($) {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_API_TOKEN', ''],
          ['JIRA_USER_EMAIL', ''],
          ['JIRA_API_URL', ''],
          ['JIRA_KEY_PREFIX', ''],
        ]),
      );

      yield* $(
        Effect.provide(testProg, mkTestLayer(configProvider)),
        Effect.match({
          onSuccess: () => expect.unreachable('Should have returned an error'),
          onFailure: (e) => expect(e).toMatchSnapshot(),
        }),
      );
    }),
  );
});
