import { jest } from '@jest/globals';

/**
 * Mock async typé pour Jest ESM.
 * `TResult` doit être une Promise, sinon `mockResolvedValue` devient `never`.
 */
export function mockFn<
  TResolved = unknown,
  TArgs extends unknown[] = unknown[],
>() {
  return jest.fn<(...args: TArgs) => Promise<TResolved>>();
}

/** Mock synchrone (ex. `mockReturnValue`). */
export function mockSyncFn<
  TResult = unknown,
  TArgs extends unknown[] = unknown[],
>() {
  return jest.fn<(...args: TArgs) => TResult>();
}
