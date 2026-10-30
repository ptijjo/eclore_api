import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn, mockSyncFn } from '../test/mocks/jest-fn.js';

const RedisCtor = mockSyncFn().mockImplementation(() => client);

const client = {
  status: 'ready',
  connect: mockFn(),
  quit: mockFn(),
  on: mockSyncFn(),
  get: mockFn(),
  set: mockFn(),
  del: mockFn(),
  exists: mockFn(),
  lrange: mockFn(),
  lpush: mockFn(),
  ltrim: mockFn(),
  lrem: mockFn(),
};

jest.unstable_mockModule('ioredis', () => ({
  Redis: RedisCtor,
}));

const { RedisService } = await import('./redis.service.js');
const { createMockConfigService } = await import(
  '../test/mocks/config.mock.js'
);

describe('RedisService', () => {
  let service: InstanceType<typeof RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    client.status = 'ready';
    RedisCtor.mockImplementation(() => client);
    service = new RedisService(
      createMockConfigService({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6375',
        REDIS_USERNAME: 'default',
        REDIS_PASSWORD: 'mot_de_passe_secure',
      }),
    );
  });

  it('configure ioredis depuis REDIS_HOST/PORT/USERNAME/PASSWORD', () => {
    expect(RedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 6375,
        username: 'default',
        password: 'mot_de_passe_secure',
        lazyConnect: true,
      }),
    );
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('connecte si le client est en attente', async () => {
    client.status = 'wait';
    await service.onModuleInit();
    expect(client.connect).toHaveBeenCalled();
  });

  it('délègue get/set/del/list', async () => {
    await service.get('k');
    await service.set('k', 'v', 10);
    await service.set('k2', 'v2');
    await service.del();
    await service.del('k');
    await service.exists('k');
    await service.lrange('k', 0, -1);
    await service.lpush('k', 'a');
    await service.ltrim('k', 0, 2);
    await service.lrem('k', 0, 'a');
    await service.onModuleDestroy();

    expect(client.get).toHaveBeenCalledWith('k');
    expect(client.set).toHaveBeenCalled();
    expect(client.quit).toHaveBeenCalled();
  });
});
