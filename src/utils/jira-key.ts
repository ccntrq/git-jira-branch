import {Effect} from 'effect';
import {isNone} from 'effect/Option';
import {AppConfigService} from '../services/app-config';
import type {AppConfigError} from '../types';

export const fullJiraKey = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  AppConfigService.pipe(
    Effect.flatMap((_) => _.defaultJiraKeyPrefix),
    Effect.map((defaultJiraKeyPrefix) =>
      jiraKey.match(/^([a-z]+)-(\d+)$/i) || isNone(defaultJiraKeyPrefix)
        ? jiraKey
        : `${defaultJiraKeyPrefix.value}-${jiraKey}`,
    ),
  );
