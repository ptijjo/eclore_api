import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: mockFn(),
    login: mockFn(),
    refresh: mockFn(),
    verifyEmail: mockFn(),
    resendVerification: mockFn(),
    forgotPassword: mockFn(),
    resetPassword: mockFn(),
    logout: mockFn(),
    listSessions: mockFn(),
    revokeSession: mockFn(),
  };

  const currentUser = {
    userId: 'user-1',
    sessionId: 'session-1',
    role: 'USER',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthenticatedUser(currentUser))
      .compile();

    controller = moduleRef.get(AuthController);
  });

  it('délègue register', async () => {
    authService.register.mockResolvedValue({ id: 'user-1' });
    const dto = {
      email: 'a@b.c',
      password: 'Secret1!',
      pseudonym: 'alice',
      birthDate: new Date('1990-01-01'),
      confirmIsAdult: true,
      acceptTerms: true,
      acceptAnonymityAck: true,
    };

    await controller.register(dto, '9.9.9.9');
    expect(authService.register).toHaveBeenCalledWith(dto, '9.9.9.9');
  });

  it('délègue login', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });

    await controller.login(
      { login: 'a@b.c', password: 'Secret1!' },
      '1.1.1.1',
      'jest',
    );

    expect(authService.login).toHaveBeenCalledWith(
      { login: 'a@b.c', password: 'Secret1!' },
      { ip: '1.1.1.1', userAgent: 'jest' },
    );
  });

  it('délègue refresh', async () => {
    authService.refresh.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });
    await controller.refresh({ refreshToken: 'tok' });
    expect(authService.refresh).toHaveBeenCalledWith({ refreshToken: 'tok' });
  });

  it('verifyEmailGet renvoie du HTML', async () => {
    authService.verifyEmail.mockResolvedValue({
      message: 'Email confirmé. Ouvre l’application Éclore pour te connecter.',
    });

    const html = await controller.verifyEmailGet('tok');
    expect(html).toContain('Email confirmé');
    expect(authService.verifyEmail).toHaveBeenCalledWith('tok');
  });

  it('délègue verifyEmailPost', async () => {
    authService.verifyEmail.mockResolvedValue({ message: 'ok' });
    await controller.verifyEmailPost({ token: 'tok' });
    expect(authService.verifyEmail).toHaveBeenCalledWith('tok');
  });

  it('délègue resendVerification', async () => {
    authService.resendVerification.mockResolvedValue({ message: 'ok' });
    await controller.resendVerification({ email: 'a@b.c' });
    expect(authService.resendVerification).toHaveBeenCalledWith({
      email: 'a@b.c',
    });
  });

  it('délègue forgotPassword', async () => {
    authService.forgotPassword.mockResolvedValue({ message: 'ok' });
    await controller.forgotPassword({ email: 'a@b.c' });
    expect(authService.forgotPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
    });
  });

  it('délègue resetPasswordPost', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'ok' });
    await controller.resetPasswordPost({
      token: 'tok',
      password: 'Secret1!',
    });
    expect(authService.resetPassword).toHaveBeenCalled();
  });

  it('resetPasswordGet expose une page HTML', () => {
    expect(controller.resetPasswordGet('tok')).toContain('tok');
  });

  it('logout révoque la session courante', async () => {
    await controller.logout(currentUser);
    expect(authService.logout).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('liste les sessions', async () => {
    authService.listSessions.mockResolvedValue([]);
    await controller.listSessions(currentUser);
    expect(authService.listSessions).toHaveBeenCalledWith('user-1');
  });

  it('révoque une session ciblée', async () => {
    await controller.revokeSession(currentUser, 'session-2');
    expect(authService.revokeSession).toHaveBeenCalledWith(
      'user-1',
      'session-2',
    );
  });
});
