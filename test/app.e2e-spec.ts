import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { RedisService } from './../src/redis/redis.service.js';
import { MailService } from './../src/mail/mail.service.js';
import { createMockPrismaService } from '../src/test/mocks/prisma.mock.js';
import { createMockRedisService } from '../src/test/mocks/redis.mock.js';
import { createMockMailService } from '../src/test/mocks/mail.mock.js';
import { OBJECT_STORAGE } from '../src/media/object-storage.service.js';
import { createMockObjectStorage } from './helpers/storage.mock.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createMockPrismaService())
      .overrideProvider(RedisService)
      .useValue(createMockRedisService())
      .overrideProvider(MailService)
      .useValue(createMockMailService())
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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
