import {live} from '@effect/vitest';
import {Effect, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {
  mockAppConfigService,
  mockGitClient,
  testLayer,
} from '../../test/mock-implementations.js';
import {ticketUrl, ticketUrlForCurrentBranch} from './open.handler.js';

describe('ticketUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  live('should return appropriate url for given ticket key', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.some('MYAPP'),
        jiraApiUrl: 'https://gcjb.atlassian.com',
      });

      const result = yield* Effect.provide(ticketUrl('123'), testLayer);

      expect(result).toMatchInlineSnapshot(
        '"https://gcjb.atlassian.com/browse/MYAPP-123"',
      );
    }),
  );
});

describe('ticketUrlForCurrentBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  live('should extract ticket from branch an return appropriate url', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.some('MYAPP'),
        jiraApiUrl: 'https://gcjb.atlassian.com',
      });

      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/MYAPP-123-dummy-isssue-summary',
      );

      const result = yield* Effect.provide(
        ticketUrlForCurrentBranch(),
        testLayer,
      );

      expect(result).toMatchInlineSnapshot(
        '"https://gcjb.atlassian.com/browse/MYAPP-123"',
      );
    }),
  );
});
