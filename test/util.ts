import {Effect, pipe} from 'effect';
import type {Effect as EffectNs} from 'effect/Effect';

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
export interface EffectMock<T extends Array<any>, R = any, E = any>
  extends Mock<T, Effect.Effect<R, E>> {
  mockSuccessValue: (obj: R) => this;
  mockSuccessValueOnce: (obj: R) => this;
  mockFailValue: (e: E) => this;
  mockFailValueOnce: (e: E) => this;
}

type ToEffectMock = {
  // biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
  <T extends Array<any>, R = any, E = any>(
    fn: Mock<T, Effect.Effect<R, E>>,
  ): EffectMock<T, R, E>;
  <
    FN extends (
      // biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
      ...args: Array<any>
    ) => Effect.Effect<unknown, unknown, unknown>,
  >(
    fn: Mock<
      Parameters<FN>,
      Effect.Effect<
        EffectNs.Success<ReturnType<FN>>,
        EffectNs.Error<ReturnType<FN>>
      >
    >,
  ): EffectMock<
    Parameters<FN>,
    EffectNs.Success<ReturnType<FN>>,
    EffectNs.Error<ReturnType<FN>>
  >;
};

export const toEffectMock: ToEffectMock = (
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  fn: Mock<any, Effect.Effect<any, any>>,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
): EffectMock<any, any, any> => {
  const mock = Object.assign(fn, {
    // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
    mockSuccessValue: (obj: any) => fn.mockReturnValue(Effect.succeed(obj)),
    // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
    mockSuccessValueOnce: (obj: any) =>
      fn.mockReturnValueOnce(Effect.succeed(obj)),
    // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
    mockFailValue: (e: any) => fn.mockReturnValue(Effect.fail(e)),
    // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
    mockFailValueOnce: (e: any) => fn.mockReturnValueOnce(Effect.fail(e)),
    // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  }) as EffectMock<any, any, any>;
  if (!mock.getMockImplementation()) {
    mock.mockImplementation(
      // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
      () => Effect.succeed(undefined) as unknown as Effect.Effect<any, any>,
    );
  }
  return mock;
};

type MKEffectMock = {
  // biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
  <T extends Array<any>, R = any, E = any>(
    implementation?: (...args: T) => Effect.Effect<R, E>,
  ): EffectMock<T, R, E>;
  <
    FN extends (
      // biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
      ...args: Array<any>
    ) => Effect.Effect<unknown, unknown, unknown>,
  >(
    implementation?: (
      ...args: Parameters<FN>
    ) => Effect.Effect<
      EffectNs.Success<ReturnType<FN>>,
      EffectNs.Error<ReturnType<FN>>
    >,
  ): EffectMock<
    Parameters<FN>,
    EffectNs.Success<ReturnType<FN>>,
    EffectNs.Error<ReturnType<FN>>
  >;
};

// biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
export const effectMock: MKEffectMock = (implementation?: any) =>
  toEffectMock(
    implementation
      ? vi.fn(implementation)
      : // biome-ignore lint/suspicious/noExplicitAny: Okay to use any in tests
        vi.fn(() => Effect.succeed(undefined) as any),
  );

export const curriedEffectMock2 = <
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  T1 extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  T2 extends Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  R = any,
  // biome-ignore lint/suspicious/noExplicitAny: any okay in tests
  E = any,
>(
  implementation?: (...args: T2) => Effect.Effect<R, E>,
): Mock<T1, EffectMock<T2, R, E>> & {innerMock: EffectMock<T2, R, E>} => {
  const mock = effectMock(implementation);
  return Object.assign(
    vi.fn<T1, EffectMock<T2, R, E>>(() => mock),

    {innerMock: mock},
  );
};
