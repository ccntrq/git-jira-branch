import {live} from '@effect/vitest';
import {Effect, Option} from 'effect';
import {beforeEach, describe, expect, vi} from 'vitest';
import {dummyJiraIssue} from '../../test/dummies/dummyJiraIssue.js';
import {
  mockAppConfigService,
  mockGitClient,
  mockJiraClient,
  testLayer,
} from '../../test/mock-implementations.js';
import {ticketInfo, ticketInfoForCurrentBranch} from './info.handler.js';

describe('ticketInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  live('should return info for a given ticket', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
      });

      mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);

      const result = yield* Effect.provide(ticketInfo('123'), testLayer);

      expect(mockJiraClient.getJiraIssue).toHaveBeenLastCalledWith(
        'DUMMYAPP-123',
      );
      expect(result).toBe(dummyJiraIssue);
    }),
  );
});

describe('ticketInfoForCurrentBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  live('should extract ticket from branch and return issue info', () =>
    Effect.gen(function* () {
      mockAppConfigService.getAppConfig.mockSuccessValue({
        defaultJiraKeyPrefix: Option.some('DUMMYAPP'),
      });

      mockJiraClient.getJiraIssue.mockSuccessValue(dummyJiraIssue);

      mockGitClient.getCurrentBranch.mockSuccessValue(
        'feat/DUMMYAPP-123-dummy-isssue-summary',
      );

      const result = yield* Effect.provide(
        ticketInfoForCurrentBranch(),
        testLayer,
      );

      expect(mockJiraClient.getJiraIssue).toHaveBeenLastCalledWith(
        'DUMMYAPP-123',
      );
      expect(result).toBe(dummyJiraIssue);
    }),
  );
});
