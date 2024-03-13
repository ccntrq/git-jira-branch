import {Effect, pipe} from 'effect';

import {type Mock, it, vi} from 'vitest';

export const itEffect = (() => {
  const f = <E, A>(
    name: string,
    self: () => Effect.Effect<A, E>,
    timeout = 5_000,
  ): void =>
    it(name, () => pipe(Effect.suspend(self), Effect.runPromise), timeout);
  return Object.assign(f, {
    skip: <E, A>(
      name: string,
      self: () => Effect.Effect<A, E>,
      timeout = 5_000,
    ): void =>
      it.skip(
        name,
        () => pipe(Effect.suspend(self), Effect.runPromise),
        timeout,
      ),
    only: <E, A>(
      name: string,
      self: () => Effect.Effect<A, E>,
      timeout = 5_000,
    ): void =>
      it.only(
        name,
        () => pipe(Effect.suspend(self), Effect.runPromise),
        timeout,
      ),
  });
})();

// biome-ignore lint/suspicious/noExplicitAny: any okay in tests
export interface EffectMock<T extends Array<any>, E = any, R = any>
  extends Mock<T, Effect.Effect<R, E>> {
  mockSuccessValue: (obj: R) => this;
  mockSuccessValueOnce: (obj: R) => this;
  mockFailValue: (e: E) => this;
  mockFailValueOnce: (e: E) => this;
}

// biome-ignore lint/suspicious/noExplicitAny: any okay in tests
export const toEffectMock = <T extends Array<any>, E = any, R = any>(
  fn: Mock<T, Effect.Effect<R, E>>,
): EffectMock<T, E, R> => {
  const mock = Object.assign(fn, {
    mockSuccessValue: (obj: R) => fn.mockReturnValue(Effect.succeed(obj)),
    mockSuccessValueOnce: (obj: R) =>
      fn.mockReturnValueOnce(Effect.succeed(obj)),
    mockFailValue: (e: E) => fn.mockReturnValue(Effect.fail(e)),
    mockFailValueOnce: (e: E) => fn.mockReturnValueOnce(Effect.fail(e)),
  }) as EffectMock<T, E, R>;
  if (!mock.getMockImplementation()) {
    mock.mockImplementation(
      () => Effect.succeed(undefined) as unknown as Effect.Effect<R, E>,
    );
  }
  return mock;
};

// biome-ignore lint/suspicious/noExplicitAny: any okay in tests
export const effectMock = <T extends Array<any>, E = any, R = any>(
  implementation?: (...args: T) => Effect.Effect<R, E>,
): EffectMock<T, E, R> =>
  toEffectMock<T, E, R>(
    implementation
      ? vi.fn(implementation)
      : vi.fn(
          (..._: T) =>
            Effect.succeed(undefined) as unknown as Effect.Effect<R, E>,
        ),
  );

export const curriedEffectMock2 = <
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  T1 extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  T2 extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  E = any,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  R = any,
>(
  implementation?: (...args: T2) => Effect.Effect<R, E>,
): Mock<T1, EffectMock<T2, E, R>> & {innerMock: EffectMock<T2, E, R>} => {
  const mock = effectMock(implementation);
  return Object.assign(
    vi.fn<T1, EffectMock<T2, E, R>>(() => mock),

    {innerMock: mock},
  );
};
