import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { createMockConfigService } from '../test/mocks/config.mock.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import {
  createMockRedisService,
  type MockRedisService,
} from '../test/mocks/redis.mock.js';
import {
  createMockMailService,
  type MockMailService,
} from '../test/mocks/mail.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';
import type { RegisterDto } from './dto/register.dto.js';

function adultBirthDate(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
}

function minorBirthDate(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 16);
  return date;
}

function registerDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    email: 'Alice@Example.com',
    password: 'Secret1!',
    pseudonym: 'alice_eclore',
    birthDate: adultBirthDate(),
    confirmIsAdult: true,
    acceptTerms: true,
    acceptAnonymityAck: true,
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let redis: MockRedisService;
  let mail: MockMailService;
  let jwt: {
    signAsync: ReturnType<typeof mockFn>;
    verifyAsync: ReturnType<typeof mockFn>;
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    redis = createMockRedisService();
    mail = createMockMailService();
    jwt = {
      signAsync: mockFn()
        .mockResolvedValueOnce('access.jwt')
        .mockResolvedValueOnce('refresh.jwt'),
      verifyAsync: mockFn(),
    };

    service = new AuthService(
      prisma as never,
      redis as never,
      mail as never,
      jwt as unknown as JwtService,
      createMockConfigService(),
    );
  });

  describe('register', () => {
    it('refuse un mineur sans créer de compte', async () => {
      await expect(
        service.register(registerDto({ birthDate: minorBirthDate() }), '1.2.3.4'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('refuse sans confirmation explicite de majorité', async () => {
      await expect(
        service.register(registerDto({ confirmIsAdult: false }), '1.2.3.4'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse sans acceptation des conditions', async () => {
      await expect(
        service.register(registerDto({ acceptTerms: false }), '1.2.3.4'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un email déjà pris (compte vérifié)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(
        service.register(registerDto(), '1.2.3.4'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse si une inscription non vérifiée est encore dans les 48 h', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-pending',
        emailVerifiedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.register(registerDto(), '1.2.3.4'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('purge l’inscription non vérifiée expirée (>48 h) puis permet de se réinscrire', async () => {
      const expiredAt = new Date(Date.now() - 49 * 3600 * 1000);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-expired',
        emailVerifiedAt: null,
        createdAt: expiredAt,
      });
      prisma.user.delete.mockResolvedValue({ id: 'u-expired' });
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'alice@example.com',
        profile: { pseudonym: 'alice_eclore' },
      });

      const result = await service.register(registerDto(), '1.2.3.4');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'u-expired' },
      });
      expect(result.id).toBe('user-2');
    });

    it('crée un compte non vérifié, envoie l’email, sans jetons', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        profile: { pseudonym: 'alice_eclore' },
      });

      const result = await service.register(registerDto(), '1.2.3.4');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('alice@example.com');
      expect(result.pseudonym).toBe('alice_eclore');
      expect(result.message).toContain('mail');
      expect(result).not.toHaveProperty('accessToken');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'alice@example.com',
            emailVerifiedAt: null,
            birthDate: expect.any(Date),
          }),
        }),
      );
      expect(mail.sendEmailVerification).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^email-verify:/),
        'user-1',
        48 * 3600,
      );
    });
  });

  describe('login', () => {
    const activeUser = {
      id: 'user-1',
      email: 'alice@example.com',
      passwordHash: '',
      role: 'USER',
      status: 'ACTIVE',
      birthDate: adultBirthDate(),
      emailVerifiedAt: new Date(),
      profile: { pseudonym: 'alice_eclore' },
    };

    beforeEach(async () => {
      activeUser.passwordHash = await bcrypt.hash('Secret1!', 4);
    });

    it('refuse si email non vérifié', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...activeUser,
        emailVerifiedAt: null,
      });

      await expect(
        service.login(
          { login: 'alice@example.com', password: 'Secret1!' },
          { ip: '1.2.3.4' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('purge un compte non vérifié expiré puis refuse', async () => {
      const createdAt = new Date(Date.now() - 49 * 3600 * 1000);
      prisma.user.findFirst.mockResolvedValue({
        ...activeUser,
        emailVerifiedAt: null,
        createdAt,
      });
      prisma.user.delete.mockResolvedValue({});

      await expect(
        service.login(
          { login: 'alice@example.com', password: 'Secret1!' },
          { ip: '1.2.3.4' },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('refuse un compte suspendu', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...activeUser,
        status: 'SUSPENDED',
      });

      await expect(
        service.login(
          { login: 'alice@example.com', password: 'Secret1!' },
          { ip: '1.2.3.4' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('émet access + refresh et plafonne à 3 sessions', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser);
      redis.lrange.mockResolvedValue(['s1', 's2', 's3']);

      const tokens = await service.login(
        { login: 'Alice@Example.com', password: 'Secret1!' },
        { ip: '1.2.3.4', userAgent: 'jest' },
      );

      expect(tokens).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'refresh.jwt',
      });
      expect(redis.lpush).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });

    it('accepte le login par pseudonyme', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser);

      await service.login(
        { login: 'alice_eclore', password: 'Secret1!' },
        { ip: '1.2.3.4' },
      );

      expect(prisma.user.findFirst).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('refuse un jeton inconnu', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marque l’email comme vérifié et consomme le jeton', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        emailVerifiedAt: new Date(),
      });

      await service.verifyEmail('good-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(redis.del).toHaveBeenCalledWith('email-verify:good-token');
    });
  });

  describe('resendVerification', () => {
    it('répond de façon neutre si l’email est inconnu', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resendVerification({ email: 'ghost@example.com' }),
      ).resolves.toEqual({
        message: expect.any(String),
      });
      expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('refuse un refresh invalide', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.refresh({ refreshToken: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotate le refresh présent dans Redis', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        sid: 'session-1',
        jti: 'jti-1',
      });
      redis.get.mockImplementation((...args: unknown[]) => {
        const key = String(args[0]);
        if (key === 'refresh:user-1:jti-1') {
          return Promise.resolve('user-1');
        }
        if (key === 'session:user-1:session-1') {
          return Promise.resolve(
            JSON.stringify({
              sessionId: 'session-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              lastSeenAt: '2026-01-01T00:00:00.000Z',
              refreshJti: 'jti-1',
            }),
          );
        }
        return Promise.resolve(null);
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'USER',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      });
      jwt.signAsync.mockReset();
      jwt.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const tokens = await service.refresh({ refreshToken: 'old' });

      expect(tokens).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      expect(redis.del).toHaveBeenCalledWith('refresh:user-1:jti-1');
    });
  });

  describe('logout / sessions', () => {
    it('révoque uniquement la session courante', async () => {
      await service.logout('user-1', 'session-1');

      expect(redis.lrem).toHaveBeenCalledWith(
        'sessions:user-1',
        0,
        'session-1',
      );
      expect(redis.del).toHaveBeenCalledWith(
        'session:user-1:session-1',
        expect.stringMatching(/^refresh:user-1:/),
      );
    });

    it('liste les sessions', async () => {
      redis.lrange.mockResolvedValue(['s1']);
      redis.get.mockResolvedValue(
        JSON.stringify({
          sessionId: 's1',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastSeenAt: '2026-01-01T00:00:00.000Z',
          refreshJti: 'j1',
        }),
      );

      const sessions = await service.listSessions('user-1');

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.sessionId).toBe('s1');
    });
  });

  describe('forgot / reset password', () => {
    it('forgotPassword est neutre', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'x@y.com' }),
      ).resolves.toEqual({ message: expect.any(String) });
    });

    it('resetPassword met à jour le hash', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.resetPassword({ token: 'tok', password: 'NewSecret1!' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(redis.del).toHaveBeenCalledWith('password-reset:tok');
    });
  });
});
