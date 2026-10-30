import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const host = configService.getOrThrow<string>('REDIS_HOST');
    const port = Number(configService.getOrThrow<string>('REDIS_PORT'));
    const username = configService.getOrThrow<string>('REDIS_USERNAME');
    const password = configService.getOrThrow<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      username,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Sans handler 'error', une coupure Redis tue tout le process Node.
      retryStrategy: (times) => {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis indisponible: ${err.message}`);
    });
  }

  async onModuleInit() {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  get(key: string) {
    return this.client.get(key);
  }

  set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds !== undefined) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  del(...keys: string[]) {
    if (keys.length === 0) {
      return Promise.resolve(0);
    }
    return this.client.del(...keys);
  }

  exists(key: string) {
    return this.client.exists(key);
  }

  lrange(key: string, start: number, stop: number) {
    return this.client.lrange(key, start, stop);
  }

  lpush(key: string, ...values: string[]) {
    return this.client.lpush(key, ...values);
  }

  ltrim(key: string, start: number, stop: number) {
    return this.client.ltrim(key, start, stop);
  }

  lrem(key: string, count: number, value: string) {
    return this.client.lrem(key, count, value);
  }
}
