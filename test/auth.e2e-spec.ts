import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { RedisService } from './../src/redis/redis.service.js';
import { MailService } from './../src/mail/mail.service.js';
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
import { OBJECT_STORAGE } from '../src/media/object-storage.service.js';
import { createMockObjectStorage } from './helpers/storage.mock.js';

describe('AuthController (e2e)', () => {
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

  it('POST /auth/register refuse un mineur (400)', async () => {
    const minor = new Date();
    minor.setFullYear(minor.getFullYear() - 16);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'mineur@example.com',
        password: 'Secret1!',
        pseudonym: 'jeune',
        birthDate: minor.toISOString(),
        confirmIsAdult: true,
        acceptTerms: true,
        acceptAnonymityAck: true,
      })
      .expect(400);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('POST /auth/register crée un compte majeur sans jetons', async () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 30);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'adulte@example.com',
      profile: { pseudonym: 'adulte' },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'Adulte@Example.com',
        password: 'Secret1!',
        pseudonym: 'adulte',
        birthDate: adult.toISOString(),
        confirmIsAdult: true,
        acceptTerms: true,
        acceptAnonymityAck: true,
      })
      .expect(201);

    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.email).toBe('adulte@example.com');
    expect(mail.sendEmailVerification).toHaveBeenCalled();
  });

  it('POST /auth/register refuse un mot de passe faible', async () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 30);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'faible@example.com',
        password: 'password',
        pseudonym: 'faible',
        birthDate: adult.toISOString(),
        confirmIsAdult: true,
        acceptTerms: true,
        acceptAnonymityAck: true,
      })
      .expect(400);
  });
});
