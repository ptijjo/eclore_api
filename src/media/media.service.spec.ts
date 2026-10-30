import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { MediaService } from './media.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../test/mocks/prisma.mock.js';
import { createMockConfigService } from '../test/mocks/config.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';
import type { ObjectStorageService } from './object-storage.service.js';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: MockPrismaService;
  let storage: {
    putObject: ReturnType<typeof mockFn>;
    getSignedGetUrl: ReturnType<typeof mockFn>;
    deleteObject: ReturnType<typeof mockFn>;
  };
  let membershipAccess: {
    requireAcceptedMembership: ReturnType<typeof mockFn>;
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    storage = {
      putObject: mockFn().mockResolvedValue(undefined),
      getSignedGetUrl: mockFn().mockResolvedValue('https://signed.example/a'),
      deleteObject: mockFn().mockResolvedValue(undefined),
    };
    membershipAccess = {
      requireAcceptedMembership: mockFn().mockResolvedValue({
        status: 'ACCEPTED',
      }),
    };
    service = new MediaService(
      prisma as never,
      storage as unknown as ObjectStorageService,
      membershipAccess as unknown as MembershipAccessService,
      createMockConfigService({
        MEDIA_MAX_BYTES: 5_000_000,
        MEDIA_SIGNED_URL_TTL_SECONDS: 60,
        MEDIA_MAX_DURATION_MS: 180_000,
      }),
    );
  });

  describe('uploadAudio', () => {
    it('accepte un MP3 valide', async () => {
      prisma.mediaAsset.create.mockResolvedValue({
        id: 'media-1',
        status: 'PENDING_UPLOAD',
        objectKey: 'key',
      });
      prisma.mediaAsset.update.mockResolvedValue({
        id: 'media-1',
        status: 'READY',
        contentType: 'audio/mpeg',
        durationMs: 12_000,
        byteSize: 100,
      });

      const file = {
        buffer: Buffer.from('audio'),
        mimetype: 'audio/mpeg',
        size: 100,
        originalname: 'voice.mp3',
      };

      const result = await service.uploadAudio('u1', file, 12_000);
      expect(storage.putObject).toHaveBeenCalled();
      expect(result.status).toBe('READY');
    });

    it('refuse un MIME hors liste (WAV)', async () => {
      await expect(
        service.uploadAudio(
          'u1',
          {
            buffer: Buffer.from('x'),
            mimetype: 'audio/wav',
            size: 10,
            originalname: 'a.wav',
          },
          1000,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse une durée > 3 minutes', async () => {
      await expect(
        service.uploadAudio(
          'u1',
          {
            buffer: Buffer.from('x'),
            mimetype: 'audio/mpeg',
            size: 10,
            originalname: 'a.mp3',
          },
          181_000,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un fichier trop lourd', async () => {
      await expect(
        service.uploadAudio(
          'u1',
          {
            buffer: Buffer.from('x'),
            mimetype: 'audio/mpeg',
            size: 9_000_000,
            originalname: 'a.mp3',
          },
          1000,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSignedUrl', () => {
    it('autorise le propriétaire', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'u1',
        objectKey: 'obj/1',
        status: 'READY',
        testimonial: null,
      });

      await expect(service.getSignedUrl('u1', 'media-1')).resolves.toEqual({
        url: 'https://signed.example/a',
        expiresInSeconds: 60,
      });
    });

    it('autorise un membre ACCEPTED sur témoignage publié', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'author',
        objectKey: 'obj/1',
        status: 'READY',
        testimonial: {
          status: 'PUBLISHED',
          communityId: 'c1',
        },
      });

      await expect(service.getSignedUrl('u1', 'media-1')).resolves.toMatchObject(
        {
          url: expect.any(String),
        },
      );
      expect(membershipAccess.requireAcceptedMembership).toHaveBeenCalledWith(
        'u1',
        'c1',
      );
    });

    it('refuse un non-membre (404)', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'author',
        objectKey: 'obj/1',
        status: 'READY',
        testimonial: {
          status: 'PUBLISHED',
          communityId: 'c1',
        },
      });
      membershipAccess.requireAcceptedMembership.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(
        service.getSignedUrl('u1', 'media-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un média non READY', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'media-1',
        ownerId: 'u1',
        status: 'DELETED',
        testimonial: null,
      });
      await expect(
        service.getSignedUrl('u1', 'media-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
