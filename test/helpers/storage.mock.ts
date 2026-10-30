import { OBJECT_STORAGE } from '../../src/media/object-storage.service.js';
import { mockFn } from '../../src/test/mocks/jest-fn.js';

export function createMockObjectStorage() {
  return {
    putObject: mockFn().mockResolvedValue(undefined),
    getSignedGetUrl: mockFn().mockResolvedValue('https://signed.test/x'),
    deleteObject: mockFn().mockResolvedValue(undefined),
  };
}

export function overrideObjectStorage(
  builder: {
    overrideProvider: (token: unknown) => {
      useValue: (value: unknown) => unknown;
    };
  },
) {
  return builder
    .overrideProvider(OBJECT_STORAGE)
    .useValue(createMockObjectStorage());
}
