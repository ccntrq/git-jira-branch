import * as Terminal from '@effect/platform/Terminal';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import {live} from '@effect/vitest';
import {
  Chunk,
  Deferred,
  Effect,
  Fiber,
  Layer,
  Mailbox,
  Option,
  Ref,
} from 'effect';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppConfigService} from '../services/app-config.js';
import {GitClient} from '../services/git-client.js';
import {dummyJiraIssue} from '../test/dummies/dummyJiraIssue.js';
import {
  mockAppConfigService,
  mockGitClient,
  mockJiraClient,
  resetTestMocks,
} from '../test/mock-implementations.js';
import {
  AppConfigError,
  AssociatedBranch,
  GitBranch,
  JiraApiError,
  type JiraIssue,
  JiraKeyPrefix,
} from '../types.js';
import {JiraClient} from './jira-client.js';
import {
  buildTicketPickerCandidates,
  parseTicketSearchQuery,
  TicketSelector,
  TicketSelectorLive,
  ticketSearchJql,
} from './ticket-selector.js';

describe('ticket-selector', () => {
  const appProject = Option.some(JiraKeyPrefix('APP'));
  const otherProject = Option.some(JiraKeyPrefix('OTHER'));

  describe('parseTicketSearchQuery', () => {
    it('uses default project for empty and numeric input', () => {
      expect(parseTicketSearchQuery('', appProject)).toEqual(
        Option.some({project: 'APP', issueNumberPrefix: ''}),
      );
      expect(parseTicketSearchQuery('81', appProject)).toEqual(
        Option.some({project: 'APP', issueNumberPrefix: '81'}),
      );
    });

    it('uses the project from a full key prefix', () => {
      expect(parseTicketSearchQuery('app-81', otherProject)).toEqual(
        Option.some({project: 'APP', issueNumberPrefix: '81'}),
      );
      expect(parseTicketSearchQuery('app1-81', otherProject)).toEqual(
        Option.some({project: 'APP1', issueNumberPrefix: '81'}),
      );
    });

    it('rejects numeric input without a default project', () => {
      expect(parseTicketSearchQuery('81', Option.none())).toEqual(
        Option.none(),
      );
    });
  });

  it('builds JQL sorted by last update', () => {
    expect(
      ticketSearchJql({
        project: 'APP',
        issueNumberPrefix: '81',
      }),
    ).toBe('project = APP AND key ~ "APP-81*" ORDER BY updated DESC');
  });

  it('marks Jira-only switch candidates disabled and keeps branch-backed candidates selectable', () => {
    const candidates = buildTicketPickerCandidates(
      {command: 'switch', type: Option.none(), reset: false},
      [dummyJiraIssue],
      Chunk.fromIterable([
        AssociatedBranch({
          jiraKey: 'DUMMYAPP-123',
          name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
          isCurrent: false,
        }),
        AssociatedBranch({
          jiraKey: 'DUMMYAPP-124',
          name: 'feat/DUMMYAPP-124-local-only',
          isCurrent: false,
        }),
      ]),
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '12'}),
      'DUMMYAPP-12',
    );

    expect(candidates.map((_) => [_.key, _.disabled, _.branchPreview])).toEqual(
      [
        ['DUMMYAPP-123', false, 'feat/DUMMYAPP-123-dummy-isssue-summary'],
        ['DUMMYAPP-124', false, 'feat/DUMMYAPP-124-local-only'],
      ],
    );
  });

  it('leads with actionable candidates for switch and sinks disabled rows', () => {
    const withBranch: JiraIssue = {...dummyJiraIssue, key: 'DUMMYAPP-123'};
    const withoutBranch: JiraIssue = {...dummyJiraIssue, key: 'DUMMYAPP-200'};

    const candidates = buildTicketPickerCandidates(
      {command: 'switch', type: Option.none(), reset: false},
      // Jira returns the branch-less ticket first (e.g. more recently updated).
      [withoutBranch, withBranch],
      Chunk.of(
        AssociatedBranch({
          jiraKey: 'DUMMYAPP-123',
          name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
          isCurrent: false,
        }),
      ),
      Option.none(),
      'DUMMYAPP',
    );

    expect(candidates.map((_) => [_.key, _.disabled])).toEqual([
      ['DUMMYAPP-123', false],
      ['DUMMYAPP-200', true],
    ]);
  });

  it('shows all local branches on startup but hides them when searching another project', () => {
    const branches = Chunk.fromIterable([
      AssociatedBranch({
        jiraKey: 'ACME-101',
        name: 'feat/ACME-101-first',
        isCurrent: false,
      }),
      AssociatedBranch({
        jiraKey: 'ACME-102',
        name: 'feat/ACME-102-second',
        isCurrent: false,
      }),
    ]);

    // On startup (empty query) every local branch is actionable, even when the
    // default project's Jira search targets an unrelated project.
    const onOpen = buildTicketPickerCandidates(
      {command: 'switch', type: Option.none(), reset: false},
      [{...dummyJiraIssue, key: 'DUMMYAPP-9'}],
      branches,
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: ''}),
      '',
    );
    expect(onOpen.map((_) => [_.key, _.disabled])).toEqual([
      ['ACME-101', false],
      ['ACME-102', false],
      ['DUMMYAPP-9', true],
    ]);

    // Explicitly searching another project must not surface this project's
    // local branches.
    const otherProjectSearch = buildTicketPickerCandidates(
      {command: 'switch', type: Option.none(), reset: false},
      [],
      branches,
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '1'}),
      'DUMMYAPP-1',
    );
    expect(otherProjectSearch).toEqual([]);
  });

  it('matches local branches by issue number for a numeric search, across any project', () => {
    const branches = Chunk.fromIterable([
      AssociatedBranch({
        jiraKey: 'ACME-101',
        name: 'feat/ACME-101-first',
        isCurrent: false,
      }),
      AssociatedBranch({
        jiraKey: 'ACME-202',
        name: 'feat/ACME-202-second',
        isCurrent: false,
      }),
    ]);

    // A bare number resolves the Jira search against the default project
    // (DUMMYAPP here), but local branches match on the issue number alone, so
    // the ACME branch with that number stays visible even though its project
    // differs from the default prefix.
    const candidates = buildTicketPickerCandidates(
      {command: 'switch', type: Option.none(), reset: false},
      [],
      branches,
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '101'}),
      '101',
    );
    expect(candidates.map((_) => _.key)).toEqual(['ACME-101']);
  });

  it('disables existing branches for create unless reset is set', () => {
    const branch = AssociatedBranch({
      jiraKey: 'DUMMYAPP-123',
      name: 'feat/DUMMYAPP-123-dummy-isssue-summary',
      isCurrent: false,
    });

    const withoutReset = buildTicketPickerCandidates(
      {command: 'create', type: Option.none(), reset: false},
      [dummyJiraIssue],
      Chunk.of(branch),
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '123'}),
      '123',
    );
    const withReset = buildTicketPickerCandidates(
      {command: 'create', type: Option.none(), reset: true},
      [dummyJiraIssue],
      Chunk.of(branch),
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '123'}),
      '123',
    );

    expect(withoutReset[0]?.disabled).toBe(true);
    expect(withReset[0]?.disabled).toBe(false);
  });

  it('shows local-only create candidates as disabled without reset', () => {
    const candidates = buildTicketPickerCandidates(
      {command: 'create', type: Option.none(), reset: false},
      [],
      Chunk.of(
        AssociatedBranch({
          jiraKey: 'DUMMYAPP-124',
          name: 'feat/DUMMYAPP-124-local-only',
          isCurrent: false,
        }),
      ),
      Option.some({project: 'DUMMYAPP', issueNumberPrefix: '124'}),
      '124',
    );

    expect(candidates.map((_) => [_.key, _.disabled, _.branchPreview])).toEqual(
      [['DUMMYAPP-124', true, 'feat/DUMMYAPP-124-local-only']],
    );
  });

  describe('interactive picker', () => {
    beforeEach(() => {
      resetTestMocks();
      vi.clearAllMocks();
    });

    const issue = (key: string): JiraIssue => ({
      key,
      fields: {
        summary: `Summary for ${key}`,
        updated: '2026-06-15T10:00:00.000+0000',
        issuetype: {name: 'Task'},
        status: {name: 'To Do'},
        description: null,
        assignee: null,
        creator: {displayName: 'Wendy Darling'},
      },
    });

    const keyPress = (
      input: string | undefined,
      name = '',
      ctrl = false,
    ): Terminal.UserInput => ({
      input: Option.fromNullable(input),
      key: {name, ctrl, meta: false, shift: false},
    });

    const fakeTerminal = (
      mailbox: Mailbox.ReadonlyMailbox<Terminal.UserInput>,
    ) =>
      Layer.succeed(
        Terminal.Terminal,
        Terminal.Terminal.of({
          columns: Effect.succeed(80),
          rows: Effect.succeed(24),
          isTTY: Effect.succeed(true),
          readInput: Effect.succeed(mailbox),
          readLine: Effect.succeed(''),
          display: () => Effect.void,
        }),
      );

    const servicesLayerWithDefaultPrefix = (
      defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>,
    ) =>
      Layer.mergeAll(
        Layer.succeed(GitClient, GitClient.of(mockGitClient)),
        Layer.succeed(JiraClient, JiraClient.of(mockJiraClient)),
        Layer.succeed(
          AppConfigService,
          AppConfigService.of({
            getAppConfig: Effect.suspend(() =>
              mockAppConfigService.getAppConfig(),
            ),
            defaultJiraKeyPrefix: Effect.succeed(defaultJiraKeyPrefix),
            linkPrScanLimit: Effect.succeed(500),
            githubToken: Effect.fail(AppConfigError({message: 'unused'})),
          }),
        ),
      );

    // No default prefix: only fully-qualified keys (APP-…) hit the API, which
    // keeps the request count in these tests deterministic unless overridden.
    const servicesLayer = servicesLayerWithDefaultPrefix(Option.none());

    live(
      'keeps typing responsive and cancels the in-flight request on each edit',
      () =>
        Effect.gen(function* () {
          const mailbox = yield* Mailbox.make<Terminal.UserInput>();
          const starts = yield* Ref.make(0);
          const interruptions = yield* Ref.make(0);
          const firstRequestStarted = yield* Deferred.make<void>();

          // A slow, interruptible Jira search that records each start and any
          // interruption so the test can assert the in-flight request is killed.
          mockJiraClient.searchJiraIssues.mockImplementation(({jql}) =>
            Effect.gen(function* () {
              yield* Ref.update(starts, (_) => _ + 1);
              if (jql.includes('APP-8*')) {
                yield* Deferred.succeed(firstRequestStarted, undefined);
              }
              yield* Effect.sleep('50 millis');
              const key = jql.includes('APP-81*') ? 'APP-81' : 'APP-8';
              return [issue(`${key}1`), issue(`${key}2`)];
            }).pipe(
              Effect.onInterrupt(() => Ref.update(interruptions, (_) => _ + 1)),
            ),
          );

          const env = Layer.mergeAll(
            TicketSelectorLive.pipe(Layer.provide(fakeTerminal(mailbox))),
            fakeTerminal(mailbox),
            servicesLayer,
            NodeFileSystem.layer,
            NodePath.layer,
          );

          const selection = yield* Effect.fork(
            TicketSelector.pipe(
              Effect.flatMap((_) =>
                _.selectTicket({
                  command: 'create',
                  type: Option.none(),
                  reset: false,
                }),
              ),
              Effect.provide(env),
            ),
          );

          // Type "APP-8" in a burst — the debounce collapses it to one request.
          for (const char of 'APP-8') {
            yield* mailbox.offer(keyPress(char));
          }
          // Wait until that request is actually in flight...
          yield* Deferred.await(firstRequestStarted);
          // ...then keep typing, which must interrupt it and search "APP-81".
          yield* mailbox.offer(keyPress('1'));
          // Give the debounced "APP-81" request time to complete.
          yield* Effect.sleep('400 millis');
          // Move to the second result and submit it.
          yield* mailbox.offer(keyPress(undefined, 'down'));
          yield* mailbox.offer(keyPress('\r', 'return'));

          const selected = yield* Fiber.join(selection);

          expect(selected.key).toBe('APP-812');
          expect(yield* Ref.get(starts)).toBe(2);
          expect(yield* Ref.get(interruptions)).toBe(1);
        }),
    );

    live('does not submit stale results while a new search is loading', () =>
      Effect.gen(function* () {
        const mailbox = yield* Mailbox.make<Terminal.UserInput>();
        const secondRequestStarted = yield* Deferred.make<void>();
        const finishSecondRequest = yield* Deferred.make<void>();

        mockJiraClient.searchJiraIssues.mockImplementation(({jql}) =>
          jql.includes('APP-81*')
            ? Effect.gen(function* () {
                yield* Deferred.succeed(secondRequestStarted, undefined);
                yield* Deferred.await(finishSecondRequest);
                return [issue('APP-811')];
              })
            : Effect.succeed([issue('APP-801')]),
        );

        const env = Layer.mergeAll(
          TicketSelectorLive.pipe(Layer.provide(fakeTerminal(mailbox))),
          fakeTerminal(mailbox),
          servicesLayer,
          NodeFileSystem.layer,
          NodePath.layer,
        );

        const selection = yield* Effect.fork(
          TicketSelector.pipe(
            Effect.flatMap((_) =>
              _.selectTicket({
                command: 'create',
                type: Option.none(),
                reset: false,
              }),
            ),
            Effect.provide(env),
          ),
        );

        for (const char of 'APP-8') {
          yield* mailbox.offer(keyPress(char));
        }
        yield* Effect.sleep('400 millis');

        yield* mailbox.offer(keyPress('1'));
        yield* mailbox.offer(keyPress('\r', 'return'));
        yield* Effect.sleep('50 millis');
        expect(Option.isNone(yield* Fiber.poll(selection))).toBe(true);
        yield* Deferred.await(secondRequestStarted);
        yield* Deferred.succeed(finishSecondRequest, undefined);
        yield* Effect.sleep('50 millis');
        yield* mailbox.offer(keyPress('\r', 'return'));

        const selected = yield* Fiber.join(selection);
        expect(selected.key).toBe('APP-811');
      }),
    );

    live('shows matching local switch branches when Jira search fails', () =>
      Effect.gen(function* () {
        const mailbox = yield* Mailbox.make<Terminal.UserInput>();
        mockGitClient.listBranches.mockSuccessValue(
          Chunk.of(
            GitBranch({
              name: 'feat/APP-123-local-branch',
              isCurrent: false,
            }),
          ),
        );
        mockJiraClient.searchJiraIssues.mockFailValue(
          JiraApiError({message: 'offline'}),
        );

        const env = Layer.mergeAll(
          TicketSelectorLive.pipe(Layer.provide(fakeTerminal(mailbox))),
          fakeTerminal(mailbox),
          servicesLayerWithDefaultPrefix(appProject),
          NodeFileSystem.layer,
          NodePath.layer,
        );

        const selection = yield* Effect.fork(
          TicketSelector.pipe(
            Effect.flatMap((_) =>
              _.selectTicket({
                command: 'switch',
                type: Option.none(),
                reset: false,
              }),
            ),
            Effect.provide(env),
          ),
        );

        yield* Effect.sleep('400 millis');
        yield* mailbox.offer(keyPress('\r', 'return'));

        const selected = yield* Fiber.join(selection);
        expect(selected).toMatchObject({
          key: 'APP-123',
          associatedBranch: Option.some(
            AssociatedBranch({
              name: 'feat/APP-123-local-branch',
              jiraKey: 'APP-123',
              isCurrent: false,
            }),
          ),
        });
      }),
    );

    live('cancels the picker on ctrl+c', () =>
      Effect.gen(function* () {
        const mailbox = yield* Mailbox.make<Terminal.UserInput>();
        mockJiraClient.searchJiraIssues.mockImplementation(() =>
          Effect.succeed([]),
        );

        const env = Layer.mergeAll(
          TicketSelectorLive.pipe(Layer.provide(fakeTerminal(mailbox))),
          fakeTerminal(mailbox),
          servicesLayer,
          NodeFileSystem.layer,
          NodePath.layer,
        );

        const selection = yield* Effect.fork(
          TicketSelector.pipe(
            Effect.flatMap((_) =>
              _.selectTicket({
                command: 'switch',
                type: Option.none(),
                reset: false,
              }),
            ),
            Effect.provide(env),
            Effect.flip,
          ),
        );

        yield* mailbox.offer(keyPress(undefined, 'c', true));

        const error = yield* Fiber.join(selection);
        expect(error.message).toBe('Ticket selection cancelled.');
      }),
    );

    live('fetches a full page and scrolls beyond the visible window', () =>
      Effect.gen(function* () {
        const mailbox = yield* Mailbox.make<Terminal.UserInput>();
        mockJiraClient.searchJiraIssues.mockImplementation(() =>
          Effect.succeed(
            Array.from({length: 25}, (_, i) => issue(`APP-${800 + i}`)),
          ),
        );

        const env = Layer.mergeAll(
          TicketSelectorLive.pipe(Layer.provide(fakeTerminal(mailbox))),
          fakeTerminal(mailbox),
          servicesLayer,
          NodeFileSystem.layer,
          NodePath.layer,
        );

        const selection = yield* Effect.fork(
          TicketSelector.pipe(
            Effect.flatMap((_) =>
              // `create` keeps branch-less issues selectable (nothing to
              // switch to without a local branch).
              _.selectTicket({
                command: 'create',
                type: Option.none(),
                reset: false,
              }),
            ),
            Effect.provide(env),
          ),
        );

        for (const char of 'APP-8') {
          yield* mailbox.offer(keyPress(char));
        }
        // Let the debounced search populate all 25 matches.
        yield* Effect.sleep('400 millis');
        // Move 14 rows down — past the 10-row viewport — then submit.
        for (let i = 0; i < 14; i++) {
          yield* mailbox.offer(keyPress(undefined, 'down'));
        }
        yield* mailbox.offer(keyPress('\r', 'return'));

        const selected = yield* Fiber.join(selection);

        expect(selected.key).toBe('APP-814');
        // The whole page is fetched, not just the first viewport.
        expect(mockJiraClient.searchJiraIssues).toHaveBeenCalledWith(
          expect.objectContaining({maxResults: 50}),
        );
      }),
    );
  });
});
