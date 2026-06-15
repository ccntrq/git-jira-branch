import {live} from '@effect/vitest';
import {Effect, Option} from 'effect';
import {beforeEach, describe, expect} from 'vitest';
import {
  mockAppConfigService,
  resetTestMocks,
  testLayer,
} from '../test/mock-implementations.js';
import {fullJiraKey} from './jira-key.js';

describe('fullJiraKey', () => {
  beforeEach(() => {
    resetTestMocks();
  });

  live('does not prefix full keys whose project contains digits', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockReturnValue(
        Effect.succeed({
          defaultJiraKeyPrefix: Option.some('APP'),
          githubToken: Option.none(),
        }),
      );

      const key = yield* Effect.provide(fullJiraKey('APP1-123'), testLayer);

      expect(key).toBe('APP1-123');
    }),
  );
});
