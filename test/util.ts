import { Effect, pipe } from "effect";

import { Mock, it, vi } from "vitest";

export const itEffect = (() => {
  const f = <E, A>(
    name: string,
    self: () => Effect.Effect<never, E, A>,
    timeout = 5_000
  ) => {
    return it(
      name,
      () => pipe(Effect.suspend(self), Effect.runPromise),
      timeout
    );
  };
  return Object.assign(f, {
    skip: <E, A>(
      name: string,
      self: () => Effect.Effect<never, E, A>,
      timeout = 5_000
    ) => {
      return it.skip(
        name,
        () => pipe(Effect.suspend(self), Effect.runPromise),
        timeout
      );
    },
    only: <E, A>(
      name: string,
      self: () => Effect.Effect<never, E, A>,
      timeout = 5_000
    ) => {
      return it.only(
        name,
        () => pipe(Effect.suspend(self), Effect.runPromise),
        timeout
      );
    },
  });
})();

export interface EffectMock<T extends any[], E = any, R = any>
  extends Mock<T, Effect.Effect<never, E, R>> {
  mockSuccessValue: (obj: R) => this;
  mockSuccessValueOnce: (obj: R) => this;
  mockFailValue: (e: E) => this;
  mockFailValueOnce: (e: E) => this;
}

export const toEffectMock = <T extends any[], E = any, R = any>(fn: Mock<T, Effect.Effect<never, E, R>>): EffectMock<
  T,
  E,
  R
> => {
  const mock = Object.assign(fn, {
    mockSuccessValue: (obj: R) => fn.mockReturnValue(Effect.succeed(obj)),
    mockSuccessValueOnce: (obj: R) =>
      fn.mockReturnValueOnce(Effect.succeed(obj)),
    mockFailValue: (e: E) => fn.mockReturnValue(Effect.fail(e)),
    mockFailValueOnce: (e: E) => fn.mockReturnValueOnce(Effect.fail(e)),
  }) as EffectMock<T, E, R>;
  mock.mockSuccessValue(undefined as any);
  return mock;
};

export const effectMock = <T extends any[], E, R>() => toEffectMock<T, E, R>(vi.fn())