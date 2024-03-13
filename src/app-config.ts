import {Doc} from '@effect/printer';
import {prettyDefault} from '@effect/printer/Render';
import {
  type Brand,
  Config,
  ConfigError,
  Context,
  Effect,
  Either,
  Layer,
  flow,
} from 'effect';
import {InvalidData} from 'effect/ConfigError';

import {
  type AppConfig,
  AppConfigError,
  JiraApiToken,
  JiraApiUrl,
  JiraCloudAuth,
  JiraDataCenterAuth,
  JiraKeyPrefix,
  JiraPat,
  JiraUserEmail,
} from './types';

const mapBrandOrFail =
  <T extends Brand.Brand<string>>(brand: Brand.Brand.Constructor<T>) =>
  (config: Config.Config<Brand.Brand.Unbranded<T>>) =>
    config.pipe(
      Config.mapOrFail((v) =>
        brand.either(v).pipe(Either.mapLeft(brandErrorToConfigError)),
      ),
    );

const brandErrorToConfigError = (
  e: Brand.Brand.BrandErrors,
): ConfigError.ConfigError =>
  InvalidData([], e.map((_) => _.message).join(' '));

const jiraCloudAuthConfig = Config.all({
  jiraApiToken: Config.string('JIRA_API_TOKEN').pipe(
    mapBrandOrFail(JiraApiToken),
  ),
  jiraUserEmail: Config.string('JIRA_USER_EMAIL').pipe(
    mapBrandOrFail(JiraUserEmail),
  ),
}).pipe(Config.map(JiraCloudAuth));

const jiraDataCenterAuthConfig = Config.all({
  jiraPat: Config.string('JIRA_PAT').pipe(mapBrandOrFail(JiraPat)),
}).pipe(Config.map(JiraDataCenterAuth));

const appConfig = Config.all({
  jiraApiUrl: Config.string('JIRA_API_URL').pipe(mapBrandOrFail(JiraApiUrl)),
  defaultJiraKeyPrefix: Config.option(
    Config.string('JIRA_KEY_PREFIX').pipe(mapBrandOrFail(JiraKeyPrefix)),
  ),
  jiraAuth: Config.orElse(jiraCloudAuthConfig, () => jiraDataCenterAuthConfig),
});

const collectConfigErrorMessagesReducer: ConfigError.ConfigErrorReducer<
  undefined,
  Doc.Doc<never>
> = (() => {
  const collectMessage = (
    _: undefined,
    _path: string[],
    message: string,
  ): Doc.Doc<never> => Doc.text(message);

  return {
    andCase: (_, left, right) => Doc.vcat([left, right]),
    orCase: (_, left, right) =>
      Doc.vcat([Doc.indent(left, 2), Doc.text('or'), Doc.indent(right, 2)]),
    invalidDataCase: (_, path, message) =>
      Doc.text(`Expected valid input for ${path.join('.')} (${message})`),
    missingDataCase: collectMessage,
    sourceUnavailableCase: collectMessage,
    unsupportedCase: collectMessage,
  };
})();

export class AppConfigService extends Context.Tag('AppConfigService')<
  AppConfigService,
  {
    readonly getAppConfig: Effect.Effect<AppConfig, AppConfigError, never>;
  }
>() {
  public static readonly Live = Layer.succeed(
    AppConfigService,
    AppConfigService.of({
      getAppConfig: appConfig.pipe(
        Effect.mapError(
          flow(
            ConfigError.reduceWithContext(
              void 0,
              collectConfigErrorMessagesReducer,
            ),
            prettyDefault,
            (message) => AppConfigError({message}),
          ),
        ),
      ),
    }),
  );
}
