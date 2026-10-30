import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MembershipAccessService } from '../memberships/membership-access.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorageService,
} from './object-storage.service.js';

const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
]);

export type UploadedAudioFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorageService,
    private readonly membershipAccess: MembershipAccessService,
    private readonly config: ConfigService,
  ) {}

  async uploadAudio(
    ownerId: string,
    file: UploadedAudioFile,
    durationMs: number,
  ) {
    const maxBytes = Number(this.config.get('MEDIA_MAX_BYTES', 10_000_000));
    const maxDurationMs = Number(
      this.config.get('MEDIA_MAX_DURATION_MS', 180_000),
    );

    if (!ALLOWED_AUDIO_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Format audio non accepté. Utilise M4A, AAC ou MP3.',
      );
    }
    if (file.size <= 0 || file.size > maxBytes) {
      throw new BadRequestException('Fichier audio trop volumineux.');
    }
    if (
      !Number.isFinite(durationMs) ||
      durationMs <= 0 ||
      durationMs > maxDurationMs
    ) {
      throw new BadRequestException(
        'La durée audio doit être positive et au plus 3 minutes.',
      );
    }

    const objectKey = `audio/${ownerId}/${randomUUID()}`;
    const pending = await this.prisma.mediaAsset.create({
      data: {
        ownerId,
        objectKey,
        contentType: file.mimetype,
        durationMs,
        byteSize: file.size,
        status: 'PENDING_UPLOAD',
      },
    });

    try {
      // Stockage privé : pas d’URL publique durable.
      await this.storage.putObject({
        objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch {
      await this.prisma.mediaAsset.update({
        where: { id: pending.id },
        data: { status: 'DELETED' },
      });
      throw new BadRequestException('Échec de l’upload audio.');
    }

    return this.prisma.mediaAsset.update({
      where: { id: pending.id },
      data: { status: 'READY' },
      select: {
        id: true,
        contentType: true,
        durationMs: true,
        byteSize: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getSignedUrl(userId: string, mediaId: string) {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        ownerId: true,
        objectKey: true,
        status: true,
        testimonial: {
          select: {
            status: true,
            communityId: true,
          },
        },
      },
    });

    if (!media || media.status !== 'READY') {
      throw new NotFoundException();
    }

    // 1. Propriétaire (écoute avant publication)
    // 2. Sinon membre ACCEPTED d’un témoignage publié rattaché
    if (media.ownerId !== userId) {
      if (
        !media.testimonial ||
        media.testimonial.status !== 'PUBLISHED'
      ) {
        throw new NotFoundException();
      }
      await this.membershipAccess.requireAcceptedMembership(
        userId,
        media.testimonial.communityId,
      );
    }

    const ttl = Number(
      this.config.get('MEDIA_SIGNED_URL_TTL_SECONDS', 60),
    );
    const url = await this.storage.getSignedGetUrl(media.objectKey, ttl);
    return { url, expiresInSeconds: ttl };
  }
}
