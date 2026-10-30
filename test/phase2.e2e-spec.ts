import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { RedisService } from './../src/redis/redis.service.js';
import { MailService } from './../src/mail/mail.service.js';
import { OBJECT_STORAGE } from './../src/media/object-storage.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../src/test/mocks/prisma.mock.js';
import {
  createMockRedisService,
  type MockRedisService,
} from '../src/test/mocks/redis.mock.js';
import {
  createMockMailService,
  type MockMailService,
} from '../src/test/mocks/mail.mock.js';
import { createMockObjectStorage } from './helpers/storage.mock.js';

describe('Phase 2 communities (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrismaService;
  let redis: MockRedisService;
  let mail: MockMailService;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    redis = createMockRedisService();
    mail = createMockMailService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .overrideProvider(MailService)
      .useValue(mail)
      .overrideProvider(OBJECT_STORAGE)
      .useValue(createMockObjectStorage())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /communities sans Bearer → 401', async () => {
    await request(app.getHttpServer()).get('/communities').expect(401);
  });

  it('GET /communities/:id/testimonials sans Bearer → 401', async () => {
    await request(app.getHttpServer())
      .get('/communities/c1/testimonials')
      .expect(401);
  });
});
