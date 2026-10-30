import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';

export const defaultAuthConfig: Record<string, string | number> = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/eclore?schema=public',
  JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-long',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  AUTH_MAX_SESSIONS: 3,
  BCRYPT_ROUNDS: 4,
  API_PUBLIC_URL: 'http://localhost:8000',
  EMAIL_VERIFY_TTL_HOURS: 48,
  PASSWORD_RESET_TTL_HOURS: 1,
  TERMS_VERSION: '1.0',
  ANONYMITY_ACK_VERSION: '1.0',
  MJ_APIKEY_PUBLIC: 'public-key',
  MJ_APIKEY_PRIVATE: 'private-key',
  MAILJET_SENDER_EMAIL: 'noreply@eclore.test',
  MAILJET_SENDER_NAME: 'Eclore',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  REDIS_USERNAME: 'default',
  REDIS_PASSWORD: 'test-redis-password',
};

export function createMockConfigService(
  overrides: Record<string, string | number> = {},
): ConfigService {
  const values = { ...defaultAuthConfig, ...overrides };
  return {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(`Missing config ${key}`);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

export const mockConfigServiceProvider = {
  provide: ConfigService,
  useFactory: () => createMockConfigService(),
};
