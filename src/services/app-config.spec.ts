import {live} from '@effect/vitest';
import {ConfigProvider, Effect, Either, Layer, pipe} from 'effect';
import * as Option from 'effect/Option';
import {describe, expect} from 'vitest';
import {
  GitHubToken,
  JiraApiToken,
  JiraCloudAuth,
  JiraDataCenterAuth,
  JiraPat,
  JiraUserEmail,
} from '../types.js';
import {AppConfigService} from './app-config.js';

const testProg = AppConfigService.pipe(Effect.flatMap((_) => _.getAppConfig));
const githubTokenProg = AppConfigService.pipe(
  Effect.flatMap((_) => _.githubToken),
);
const linkPrScanLimitProg = AppConfigService.pipe(
  Effect.flatMap((_) => _.linkPrScanLimit),
);

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

  live('should prefer GITHUB_TOKEN over GH_TOKEN', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['GITHUB_TOKEN', 'preferred-token'],
          ['GH_TOKEN', 'fallback-token'],
        ]),
      );

      const token = yield* Effect.provide(
        githubTokenProg,
        mkTestLayer(configProvider),
      );

      expect(token).toEqual(GitHubToken('preferred-token'));
    }),
  );

  live('should fall back to GH_TOKEN', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['GH_TOKEN', 'fallback-token'],
        ]),
      );

      const token = yield* Effect.provide(
        githubTokenProg,
        mkTestLayer(configProvider),
      );

      expect(token).toEqual(GitHubToken('fallback-token'));
    }),
  );

  live('should read LINK_PR_SCAN_LIMIT when configured', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['LINK_PR_SCAN_LIMIT', '1000'],
        ]),
      );

      const env = yield* Effect.provide(
        linkPrScanLimitProg,
        mkTestLayer(configProvider),
      );

      expect(env).toBe(1000);
    }),
  );

  live('should ignore invalid link-pr-only env vars in getAppConfig', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['GITHUB_TOKEN', ''],
          ['LINK_PR_SCAN_LIMIT', '0'],
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

  live('should reject non-positive LINK_PR_SCAN_LIMIT values', () =>
    Effect.gen(function* () {
      const configProvider = ConfigProvider.fromMap(
        new Map([
          ['JIRA_PAT', 'dummy-jira-pat'],
          ['JIRA_API_URL', 'https://dummy-jira-instance.com'],
          ['LINK_PR_SCAN_LIMIT', '0'],
        ]),
      );

      yield* pipe(
        Effect.provide(linkPrScanLimitProg, mkTestLayer(configProvider)),
        Effect.match({
          onSuccess: () => expect.unreachable('Should have returned an error'),
          onFailure: (e) =>
            expect(e).toEqual({
              _tag: 'AppConfigError',
              message:
                'Expected valid input for LINK_PR_SCAN_LIMIT (must be a positive integer)',
            }),
        }),
      );
    }),
  );
});
