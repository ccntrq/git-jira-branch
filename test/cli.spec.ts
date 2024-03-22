import {live} from '@effect/vitest';
import {Effect, Option, pipe} from 'effect';
import type {Effect as EffectNs} from 'effect/Effect';

import {cliEffect} from '../src/cli';
import {
  gitCreateJiraBranch,
  ticketInfo,
  ticketInfoForCurrentBranch,
  ticketUrl,
  ticketUrlForCurrentBranch,
} from '../src/core';
import {openUrl} from '../src/url-opener';

import {type Mock, afterEach, describe, expect, vi} from 'vitest';
import {formatIssue} from '../src/issue-formatter';
import {
  CreatedBranch,
  type JiraIssue,
  ResetBranch,
  SwitchedBranch,
} from '../src/types';
import {dummyJiraIssue} from './dummies/dummyJiraIssue';
import {cliTestLayer} from './mock-implementations';
import {toEffectMock} from './util';

vi.mock('../src/core');
vi.mock('../src/url-opener');
vi.mock('../src/issue-formatter');

const mockGitCreateJiraBranch = toEffectMock(
  gitCreateJiraBranch as unknown as Mock<
    Parameters<typeof gitCreateJiraBranch>,
    Effect.Effect<
      EffectNs.Success<ReturnType<typeof gitCreateJiraBranch>>,
      EffectNs.Error<ReturnType<typeof gitCreateJiraBranch>>
    >
  >,
);

const mockTicketUrl = toEffectMock(
  ticketUrl as unknown as Mock<
    Parameters<typeof ticketUrl>,
    Effect.Effect<
      EffectNs.Success<ReturnType<typeof ticketUrl>>,
      EffectNs.Error<ReturnType<typeof ticketUrl>>
    >
  >,
);

const mockTicketUrlForCurrentBranch = toEffectMock(
  ticketUrlForCurrentBranch as unknown as Mock<
    Parameters<typeof ticketUrlForCurrentBranch>,
    Effect.Effect<
      EffectNs.Success<ReturnType<typeof ticketUrlForCurrentBranch>>,
      EffectNs.Error<ReturnType<typeof ticketUrlForCurrentBranch>>
    >
  >,
);

const mockTicketInfoForCurrentBranch = toEffectMock<
  typeof ticketInfoForCurrentBranch
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
>(ticketInfoForCurrentBranch as any);

const mockTicketInfo = toEffectMock<
  typeof ticketInfo
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
>(ticketInfo as any);

const mockOpenUrl = toEffectMock(
  openUrl as unknown as Mock<
    Parameters<typeof openUrl>,
    Effect.Effect<
      EffectNs.Success<ReturnType<typeof openUrl>>,
      EffectNs.Error<ReturnType<typeof openUrl>>
    >
  >,
);

const mockFormatIssue = formatIssue as unknown as Mock<[JiraIssue], string>;

const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

const withBaseArgs = (args: Array<string>): Effect.Effect<Array<string>> =>
  Effect.sync(() => ['node', 'git-jira-branch', ...args]);

describe('cli', () => {
  describe('main command', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    live('should print version (--version)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['--version']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls[0]?.[0]).toMatch(/\d+\.\d+\.\d+/);
      }),
    );

    live('should print help (--help)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['--help']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(
          (mockLog.mock.calls[0]?.[0] as string)
            .split(/\n/)
            .slice(3)
            .join('\n'),
        ).toMatchSnapshot();
      }),
    );
  });

  describe('create subcommand', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    live('should create branch with single argument', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          CreatedBranch({branch: 'feat/FOOX-1234-description'}),
        );
        yield* $(
          Effect.provide(
            pipe(
              withBaseArgs(['create', 'FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    live('should inform about branch switch', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          SwitchedBranch({branch: 'feat/FOOX-1234-description'}),
        );
        yield* $(
          Effect.provide(
            pipe(
              withBaseArgs(['create', 'FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    live('should handle basebranch argument (-b)', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          CreatedBranch({branch: 'feat/FOOX-1234-description'}),
        );
        yield* $(
          Effect.provide(
            pipe(
              withBaseArgs(['create', '-b', 'master', 'FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.some('master'),
          false,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    live('should handle reset option (-r)', () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          ResetBranch({branch: 'feat/FOOX-1234-description'}),
        );
        yield* $(
          Effect.provide(
            pipe(
              withBaseArgs(['create', '-r', 'FOOX-1234']),
              Effect.flatMap(cliEffect),
            ),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          'FOOX-1234',
          Option.none(),
          true,
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    live('should report missing jirakey', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['create']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );

    live('should print subcommand help (--help)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['create', '--help']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(
          (mockLog.mock.calls[0]?.[0] as string)
            .split(/\n/)
            .slice(3)
            .join('\n'),
        ).toMatchSnapshot();
      }),
    );

    live('should report unknwon argument', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(
              withBaseArgs(['create', '111', 'unknown']),
              Effect.flatMap(cliEffect),
            ),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls).toMatchSnapshot();
      }),
    );
  });

  describe('open subcommand', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    live('should open url for current branch without arguments', () =>
      Effect.gen(function* ($) {
        mockTicketUrlForCurrentBranch.mockSuccessValue(
          'https://gcjb.atlassian.net/browse/GCJB-1234',
        );
        mockOpenUrl.mockSuccessValue();
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['open']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockTicketUrlForCurrentBranch).toHaveBeenCalledWith();
        expect(mockLog.mock.calls).toMatchSnapshot();
        expect(mockOpenUrl.mock.calls).toMatchSnapshot();
      }),
    );

    live('should open url for given ticket', () =>
      Effect.gen(function* ($) {
        mockTicketUrl.mockSuccessValue(
          'https://gcjb.atlassian.net/browse/GCJB-1234',
        );
        mockOpenUrl.mockSuccessValue();
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['open', '1234']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockTicketUrl).toHaveBeenCalledWith('1234');
        expect(mockLog.mock.calls).toMatchSnapshot();
        expect(mockOpenUrl.mock.calls).toMatchSnapshot();
      }),
    );

    live('should print subcommand help (--help)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['open', '--help']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(
          (mockLog.mock.calls[0]?.[0] as string)
            .split(/\n/)
            .slice(3)
            .join('\n'),
        ).toMatchSnapshot();
      }),
    );
  });

  describe('info subcommand', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    live('should render ticket info for current branch', () =>
      Effect.gen(function* ($) {
        mockTicketInfoForCurrentBranch.mockSuccessValue(dummyJiraIssue);
        mockFormatIssue.mockReturnValue('formatted issue');

        yield* $(
          withBaseArgs(['info']),
          Effect.flatMap(cliEffect),
          Effect.provide(cliTestLayer),
        );

        expect(mockTicketInfoForCurrentBranch).toHaveBeenCalledWith();
        expect(mockLog).toHaveBeenCalledWith('formatted issue');
        expect(mockFormatIssue).toHaveBeenCalledWith(dummyJiraIssue);
      }),
    );

    live('should render ticket info for given branch', () =>
      Effect.gen(function* ($) {
        mockTicketInfo.mockSuccessValue(dummyJiraIssue);
        mockFormatIssue.mockReturnValue('formatted issue');

        yield* $(
          withBaseArgs(['info', '1234']),
          Effect.flatMap(cliEffect),
          Effect.provide(cliTestLayer),
        );

        expect(mockTicketInfo).toHaveBeenCalledWith('1234');
        expect(mockLog).toHaveBeenCalledWith('formatted issue');
        expect(mockFormatIssue).toHaveBeenCalledWith(dummyJiraIssue);
      }),
    );

    live('should print subcommand help (--help)', () =>
      Effect.gen(function* ($) {
        yield* $(
          Effect.provide(
            pipe(withBaseArgs(['info', '--help']), Effect.flatMap(cliEffect)),
            cliTestLayer,
          ),
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(
          (mockLog.mock.calls[0]?.[0] as string)
            .split(/\n/)
            .slice(3)
            .join('\n'),
        ).toMatchSnapshot();
      }),
    );
  });
});
