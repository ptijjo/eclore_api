import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import {
  MediaService,
  type UploadedAudioFile,
} from './media.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

describe('MediaController', () => {
  let controller: MediaController;
  const service = {
    uploadAudio: mockFn(),
    getSignedUrl: mockFn(),
  };
  const user: AuthenticatedRequestUser = {
    userId: 'u1',
    sessionId: 's1',
    role: 'USER',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthenticatedUser(user))
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(MediaController);
  });

  it('délègue uploadAudio', async () => {
    const file: UploadedAudioFile = {
      buffer: Buffer.from('x'),
      mimetype: 'audio/mpeg',
      size: 1,
      originalname: 'a.mp3',
    };
    service.uploadAudio.mockResolvedValue({ id: 'media-1' });
    await controller.uploadAudio(user, file, { durationMs: 1000 });
    expect(service.uploadAudio).toHaveBeenCalled();
  });

  it('refuse sans fichier', () => {
    expect(() =>
      controller.uploadAudio(user, undefined, { durationMs: 1000 }),
    ).toThrow(BadRequestException);
  });

  it('délègue getSignedUrl', async () => {
    service.getSignedUrl.mockResolvedValue({
      url: 'https://x',
      expiresInSeconds: 60,
    });
    await controller.getSignedUrl(user, 'media-1');
    expect(service.getSignedUrl).toHaveBeenCalledWith('u1', 'media-1');
  });
});

