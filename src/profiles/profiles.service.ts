import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

const profileSelect = {
  id: true,
  userId: true,
  pseudonym: true,
  bio: true,
  avatarKey: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: profileSelect,
    });
    if (!profile) {
      throw new NotFoundException();
    }
    return profile;
  }

  /**
   * 1. Met à jour bio / pseudonym.
   * 2. Pseudonyme unique : conflit → 409 (pas de doublon visible).
   */
  async updateMine(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true, pseudonym: true },
    });
    if (!existing) {
      throw new NotFoundException();
    }

    const data: Prisma.ProfileUpdateInput = {};
    if (dto.pseudonym !== undefined && dto.pseudonym !== existing.pseudonym) {
      data.pseudonym = dto.pseudonym;
    }
    if (dto.bio !== undefined) {
      const trimmed = dto.bio?.trim() ?? '';
      data.bio = trimmed.length > 0 ? trimmed : null;
    }

    if (Object.keys(data).length === 0) {
      return this.getMine(userId);
    }

    try {
      return await this.prisma.profile.update({
        where: { userId },
        data,
        select: profileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ce pseudonyme est déjà utilisé. Choisis-en un autre.',
        );
      }
      throw error;
    }
  }
}
