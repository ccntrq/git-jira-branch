import * as Terminal from '@effect/platform/Terminal';
import {Duration, Effect, Fiber, Option, Stream, SubscriptionRef} from 'effect';
import {UsageError} from '../types.js';

/**
 * A reusable "type-to-search" select prompt that, unlike `Prompt.select`, never
 * blocks the keyboard on the async lookup behind each query.
 *
 * The lookup runs on its own fiber: every edit repaints immediately, debounces,
 * then fires the request, and a fresh edit interrupts the in-flight one before
 * starting the next. A background fiber repaints whenever the shared state
 * changes, and a spinner ticks only while a request is in flight.
 *
 * Callers supply the async `search`, decide which items are selectable, and own
 * the rendering; the engine owns the terminal lifecycle, navigation, scrolling
 * and debounce/interrupt machinery.
 */

export interface AsyncSelectResult<A> {
  readonly items: ReadonlyArray<A>;
  // A hint to show instead of (or alongside) results, e.g. "type a key prefix".
  readonly message: Option.Option<string>;
}

// The read-only snapshot handed to `render` on every repaint.
export interface AsyncSelectView<A> {
  readonly query: string;
  readonly items: ReadonlyArray<A>;
  readonly selected: number;
  readonly scroll: number;
  readonly loading: boolean;
  // The current spinner glyph, or '' when nothing is in flight.
  readonly spinnerFrame: string;
  readonly message: Option.Option<string>;
  readonly columns: number;
  readonly viewportSize: number;
}

export interface AsyncSelectOptions<A, E, R> {
  readonly search: (query: string) => Effect.Effect<AsyncSelectResult<A>, E, R>;
  // Renders the whole screen body for the given snapshot (the engine prepends
  // the clear-screen sequence and manages the cursor).
  readonly render: (view: AsyncSelectView<A>) => string;
  // Items that can't be picked are skipped during navigation and ring the bell
  // when submitted.
  readonly isDisabled: (item: A) => boolean;
  // Turns a failed `search` into the message shown in the picker.
  readonly formatError: (error: E) => string;
  // The error message used when the user cancels (escape / ctrl-c / ctrl-d) or
  // the input stream closes.
  readonly cancelMessage: string;
  readonly initialQuery?: string;
  readonly viewportSize?: number;
  readonly debounce?: Duration.Duration;
}

interface AsyncSelectState<A> {
  readonly query: string;
  readonly selected: number;
  readonly scroll: number;
  readonly items: ReadonlyArray<A>;
  readonly message: Option.Option<string>;
  readonly loading: boolean;
  readonly spinner: number;
}

// How long to wait for typing to settle before hitting the search. Keeps
// keystrokes responsive and collapses bursts of input into a single request.
const DEFAULT_DEBOUNCE = Duration.millis(180);
const SPINNER_TICK = Duration.millis(90);
// Number of items shown at once; the rest are reachable by scrolling.
const DEFAULT_VIEWPORT_SIZE = 10;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const HIDE_CURSOR = '\x1B[?25l';
const SHOW_CURSOR = '\x1B[?25h';
const ENTER_ALT_SCREEN = '\x1B[?1049h';
const EXIT_ALT_SCREEN = '\x1B[?1049l';
const CLEAR_SCREEN = '\x1B[H\x1B[J';
const BELL = '\x07';

export const asyncSelect = <A, E, R>(
  options: AsyncSelectOptions<A, E, R>,
): Effect.Effect<A, E | UsageError, R | Terminal.Terminal> =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const columns = yield* terminal.columns;
    return yield* runSelect(terminal, columns, options).pipe(
      Effect.ensuring(
        Effect.orDie(terminal.display(`${SHOW_CURSOR}${EXIT_ALT_SCREEN}`)),
      ),
    );
  });

const runSelect = <A, E, R>(
  terminal: Terminal.Terminal,
  columns: number,
  options: AsyncSelectOptions<A, E, R>,
): Effect.Effect<A, UsageError, R> =>
  Effect.scoped(
    Effect.gen(function* () {
      const viewportSize = options.viewportSize ?? DEFAULT_VIEWPORT_SIZE;
      const debounce = options.debounce ?? DEFAULT_DEBOUNCE;
      const initialQuery = options.initialQuery ?? '';

      const input = yield* terminal.readInput;
      yield* Effect.orDie(
        terminal.display(`${ENTER_ALT_SCREEN}${HIDE_CURSOR}`),
      );

      const stateRef = yield* SubscriptionRef.make<AsyncSelectState<A>>({
        query: initialQuery,
        selected: 0,
        scroll: 0,
        items: [],
        message: Option.none(),
        loading: true,
        spinner: 0,
      });

      // Repaint whenever the state changes.
      yield* stateRef.changes.pipe(
        Stream.runForEach((state) =>
          Effect.orDie(
            terminal.display(
              `${CLEAR_SCREEN}${options.render(toView(state, columns, viewportSize))}`,
            ),
          ),
        ),
        Effect.forkScoped,
      );

      // Advance the spinner only while a request is in flight.
      yield* Effect.forkScoped(
        Effect.forever(
          Effect.sleep(SPINNER_TICK).pipe(
            Effect.zipRight(SubscriptionRef.get(stateRef)),
            Effect.flatMap((state) =>
              state.loading
                ? SubscriptionRef.update(stateRef, (_) => ({
                    ..._,
                    spinner: _.spinner + 1,
                  }))
                : Effect.void,
            ),
          ),
        ),
      );

      // Holds the current debounced lookup so a new keystroke can cancel it.
      let searchFiber: Fiber.RuntimeFiber<void, never> | null = null;
      const scheduleSearch = (queryText: string, delay: Duration.Duration) =>
        Effect.gen(function* () {
          if (searchFiber !== null) {
            yield* Fiber.interruptFork(searchFiber);
          }
          // Forked as a child of the loop fiber (not the scope) so completed
          // lookups are reaped immediately instead of piling up as scope
          // finalizers for the whole session.
          searchFiber = yield* Effect.fork(
            runSearchInto(stateRef, options, queryText, delay),
          );
        });

      yield* scheduleSearch(initialQuery, Duration.zero);

      return yield* eventLoop(
        input,
        stateRef,
        terminal,
        options,
        scheduleSearch,
        debounce,
      );
    }),
  );

const toView = <A>(
  state: AsyncSelectState<A>,
  columns: number,
  viewportSize: number,
): AsyncSelectView<A> => ({
  query: state.query,
  items: state.items,
  selected: state.selected,
  scroll: state.scroll,
  loading: state.loading,
  spinnerFrame: state.loading
    ? (SPINNER_FRAMES[state.spinner % SPINNER_FRAMES.length] ?? '')
    : '',
  message: state.message,
  columns,
  viewportSize,
});

const runSearchInto = <A, E, R>(
  stateRef: SubscriptionRef.SubscriptionRef<AsyncSelectState<A>>,
  options: AsyncSelectOptions<A, E, R>,
  queryText: string,
  delay: Duration.Duration,
): Effect.Effect<void, never, R> =>
  Effect.sleep(delay).pipe(
    Effect.zipRight(options.search(queryText)),
    Effect.flatMap((result) =>
      // Ignore late results for a query the user has already moved past.
      SubscriptionRef.update(stateRef, (state) => {
        if (state.query !== queryText) {
          return state;
        }
        const selected = clampSelection(
          result.items,
          state.selected,
          options.isDisabled,
        );
        return {
          ...state,
          items: result.items,
          message: result.message,
          selected,
          scroll: scrollFor(
            state.scroll,
            selected,
            result.items.length,
            options.viewportSize ?? DEFAULT_VIEWPORT_SIZE,
          ),
          loading: false,
        };
      }),
    ),
    Effect.catchAll((error) =>
      SubscriptionRef.update(stateRef, (state) =>
        state.query === queryText
          ? {
              ...state,
              items: [],
              message: Option.some(options.formatError(error)),
              selected: 0,
              scroll: 0,
              loading: false,
            }
          : state,
      ),
    ),
  );

type InputMailbox = Effect.Effect.Success<Terminal.Terminal['readInput']>;

const eventLoop = <A, E, R>(
  input: InputMailbox,
  stateRef: SubscriptionRef.SubscriptionRef<AsyncSelectState<A>>,
  terminal: Terminal.Terminal,
  options: AsyncSelectOptions<A, E, R>,
  scheduleSearch: (
    queryText: string,
    delay: Duration.Duration,
  ) => Effect.Effect<void, never, R>,
  debounce: Duration.Duration,
): Effect.Effect<A, UsageError, R> =>
  Effect.gen(function* () {
    const viewportSize = options.viewportSize ?? DEFAULT_VIEWPORT_SIZE;
    while (true) {
      const event = yield* input.take.pipe(
        Effect.mapError(() => UsageError({message: options.cancelMessage})),
      );
      const {name, ctrl} = event.key;

      if (name === 'escape' || (ctrl && (name === 'c' || name === 'd'))) {
        return yield* Effect.fail(UsageError({message: options.cancelMessage}));
      }

      if (name === 'up' || (ctrl && name === 'p')) {
        yield* SubscriptionRef.update(stateRef, (state) =>
          moveSelection(
            state,
            previousSelectable(state.items, state.selected, options.isDisabled),
            viewportSize,
          ),
        );
        continue;
      }

      if (name === 'down' || name === 'tab' || (ctrl && name === 'n')) {
        yield* SubscriptionRef.update(stateRef, (state) =>
          moveSelection(
            state,
            nextSelectable(state.items, state.selected, options.isDisabled),
            viewportSize,
          ),
        );
        continue;
      }

      if (name === 'enter' || name === 'return') {
        const state = yield* SubscriptionRef.get(stateRef);
        const item = state.items[state.selected];
        if (item === undefined || options.isDisabled(item)) {
          yield* Effect.orDie(terminal.display(BELL));
          continue;
        }
        return item;
      }

      if (name === 'backspace') {
        const query = yield* SubscriptionRef.modify(stateRef, (state) => {
          const next = state.query.slice(0, -1);
          return [
            next,
            {
              ...state,
              query: next,
              selected: 0,
              scroll: 0,
              loading: true,
              message: Option.none(),
            },
          ];
        });
        yield* scheduleSearch(query, debounce);
        continue;
      }

      const typed = stripControlChars(Option.getOrElse(event.input, () => ''));
      if (typed.length === 0) {
        yield* Effect.orDie(terminal.display(BELL));
        continue;
      }
      const query = yield* SubscriptionRef.modify(stateRef, (state) => {
        const next = `${state.query}${typed}`;
        return [
          next,
          {
            ...state,
            query: next,
            selected: 0,
            scroll: 0,
            loading: true,
            message: Option.none(),
          },
        ];
      });
      yield* scheduleSearch(query, debounce);
    }
  });

// Drop control characters (which can slip in via pasted input) so only
// printable text reaches the query, rather than only checking the first byte.
const stripControlChars = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');

const moveSelection = <A>(
  state: AsyncSelectState<A>,
  selected: number,
  viewportSize: number,
): AsyncSelectState<A> => ({
  ...state,
  selected,
  scroll: scrollFor(state.scroll, selected, state.items.length, viewportSize),
});

// Slides the viewport just enough to keep the selected row visible.
const scrollFor = (
  scroll: number,
  selected: number,
  total: number,
  viewportSize: number,
): number => {
  if (total <= viewportSize) {
    return 0;
  }
  const maxScroll = total - viewportSize;
  const next =
    selected < scroll
      ? selected
      : selected >= scroll + viewportSize
        ? selected - viewportSize + 1
        : scroll;
  return Math.max(0, Math.min(next, maxScroll));
};

const clampSelection = <A>(
  items: ReadonlyArray<A>,
  selected: number,
  isDisabled: (item: A) => boolean,
): number => {
  if (items.length === 0) {
    return 0;
  }
  const index = Math.min(selected, items.length - 1);
  const item = items[index];
  return item !== undefined && isDisabled(item)
    ? nextSelectable(items, index, isDisabled)
    : index;
};

const nextSelectable = <A>(
  items: ReadonlyArray<A>,
  selected: number,
  isDisabled: (item: A) => boolean,
): number => {
  if (items.length === 0 || items.every(isDisabled)) {
    return selected;
  }
  let index = selected;
  do {
    index = (index + 1) % items.length;
  } while (isDisabled(items[index] as A));
  return index;
};

const previousSelectable = <A>(
  items: ReadonlyArray<A>,
  selected: number,
  isDisabled: (item: A) => boolean,
): number => {
  if (items.length === 0 || items.every(isDisabled)) {
    return selected;
  }
  let index = selected;
  do {
    index = (index - 1 + items.length) % items.length;
  } while (isDisabled(items[index] as A));
  return index;
};
