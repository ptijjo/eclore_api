import { RedisService } from '../../redis/redis.service.js';
import { mockFn } from './jest-fn.js';

export type MockRedisService = {
  get: ReturnType<typeof mockFn>;
  set: ReturnType<typeof mockFn>;
  del: ReturnType<typeof mockFn>;
  exists: ReturnType<typeof mockFn>;
  lrange: ReturnType<typeof mockFn>;
  lpush: ReturnType<typeof mockFn>;
  ltrim: ReturnType<typeof mockFn>;
  lrem: ReturnType<typeof mockFn>;
};

export function createMockRedisService(): MockRedisService {
  return {
    get: mockFn(),
    set: mockFn().mockResolvedValue('OK'),
    del: mockFn().mockResolvedValue(1),
    exists: mockFn().mockResolvedValue(0),
    lrange: mockFn().mockResolvedValue([]),
    lpush: mockFn().mockResolvedValue(1),
    ltrim: mockFn().mockResolvedValue('OK'),
    lrem: mockFn().mockResolvedValue(1),
  };
}

export const mockRedisServiceProvider = {
  provide: RedisService,
  useFactory: createMockRedisService,
};
