import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
import type { DecideReportDto } from './dto/decide-report.dto.js';

const PREVIEW_MAX = 500;

const reportMemberSelect = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  status: true,
  createdAt: true,
} as const;

type TargetSnapshot = {
  targetAuthorId: string | null;
  targetAuthorEmail: string | null;
  targetAuthorPseudonym: string | null;
  targetPreview: string | null;
  targetCreatedAt: Date | null;
  targetPublishedAt: Date | null;
  communityId: string | null;
  communityName: string | null;
};

/**
 * Signalements + file admin enrichie (snapshot + IP session Redis).
 * Les PII (email, IP) ne sortent que des routes ADMIN.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 1. Résoudre la cible et construire le snapshot (auteur, contenu, dates).
   * 2. Capturer l’IP du signalant + IPs de session de l’auteur (Redis).
   * 3. Créer le Report OPEN puis notifier les ADMIN.
   */
  async create(
    reporterId: string,
    dto: CreateReportDto,
    reporterIp?: string,
  ) {
    const details = dto.details?.trim() || null;
    const snapshot = await this.resolveTargetSnapshot(
      dto.targetType,
      dto.targetId,
    );

    if (
      snapshot.targetAuthorId &&
      snapshot.targetAuthorId === reporterId
    ) {
      throw new BadRequestException(
        'Tu ne peux pas signaler ton propre contenu.',
      );
    }

    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'Tu as déjà un signalement en cours pour ce contenu.',
      );
    }

    const reporter = await this.prisma.user.findUnique({
      where: { id: reporterId },
      select: {
        email: true,
        profile: { select: { pseudonym: true } },
      },
    });
    if (!reporter) {
      throw new NotFoundException();
    }

    const targetAuthorIp = snapshot.targetAuthorId
      ? (await this.resolveSessionIps(snapshot.targetAuthorId)).join(', ') ||
        null
      : null;

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details,
        status: 'OPEN',
        reporterIp: reporterIp?.trim() || null,
        reporterEmail: reporter.email,
        reporterPseudonym: reporter.profile?.pseudonym ?? null,
        targetAuthorId: snapshot.targetAuthorId,
        targetAuthorEmail: snapshot.targetAuthorEmail,
        targetAuthorPseudonym: snapshot.targetAuthorPseudonym,
        targetAuthorIp,
        targetPreview: snapshot.targetPreview,
        targetCreatedAt: snapshot.targetCreatedAt,
        targetPublishedAt: snapshot.targetPublishedAt,
        communityId: snapshot.communityId,
        communityName: snapshot.communityName,
      },
      select: reportMemberSelect,
    });

    await this.notifications.notifyAdminsOfContentReport({
      id: report.id,
      reason: report.reason,
      targetType: report.targetType,
    });

    return report;
  }

  /** File admin — tous statuts, plus récents d’abord, avec snapshot PII. */
  async listForAdmin() {
    const rows = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        moderationAction: {
          select: {
            id: true,
            measure: true,
            reason: true,
            subjectUserId: true,
            createdAt: true,
          },
        },
      },
    });

    return Promise.all(
      rows.map(async (row) => {
        const reporterSessionIps = await this.resolveSessionIps(row.reporterId);
        const targetSessionIps = row.targetAuthorId
          ? await this.resolveSessionIps(row.targetAuthorId)
          : [];

        return {
          id: row.id,
          status: row.status,
          reason: row.reason,
          details: row.details,
          targetType: row.targetType,
          targetId: row.targetId,
          createdAt: row.createdAt,
          reporter: {
            id: row.reporterId,
            email: row.reporterEmail,
            pseudonym: row.reporterPseudonym,
            ipAtReport: row.reporterIp,
            sessionIps: reporterSessionIps,
          },
          target: {
            authorId: row.targetAuthorId,
            authorEmail: row.targetAuthorEmail,
            authorPseudonym: row.targetAuthorPseudonym,
            ipAtReport: row.targetAuthorIp,
            sessionIps: targetSessionIps,
            preview: row.targetPreview,
            createdAt: row.targetCreatedAt,
            publishedAt: row.targetPublishedAt,
            communityId: row.communityId,
            communityName: row.communityName,
          },
          moderationAction: row.moderationAction,
        };
      }),
    );
  }

  async getByIdForAdmin(id: string) {
    const row = await this.prisma.report.findUnique({
      where: { id },
      include: {
        moderationAction: {
          select: {
            id: true,
            measure: true,
            reason: true,
            subjectUserId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException();
    }

    const reporterSessionIps = await this.resolveSessionIps(row.reporterId);
    const targetSessionIps = row.targetAuthorId
      ? await this.resolveSessionIps(row.targetAuthorId)
      : [];

    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      details: row.details,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
      reporter: {
        id: row.reporterId,
        email: row.reporterEmail,
        pseudonym: row.reporterPseudonym,
        ipAtReport: row.reporterIp,
        sessionIps: reporterSessionIps,
      },
      target: {
        authorId: row.targetAuthorId,
        authorEmail: row.targetAuthorEmail,
        authorPseudonym: row.targetAuthorPseudonym,
        ipAtReport: row.targetAuthorIp,
        sessionIps: targetSessionIps,
        preview: row.targetPreview,
        createdAt: row.targetCreatedAt,
        publishedAt: row.targetPublishedAt,
        communityId: row.communityId,
        communityName: row.communityName,
      },
      moderationAction: row.moderationAction,
    };
  }

  /**
   * Décision admin :
   * 1. Vérifier que le report est encore ouvert / en revue.
   * 2. Optionnellement appliquer une mesure (compte + retrait contenu).
   * 3. Clôturer le signalement (RESOLVED / DISMISSED) ou passer IN_REVIEW.
   */
  async decide(id: string, moderatorId: string, dto: DecideReportDto) {
    const existing = await this.prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        targetType: true,
        targetId: true,
        targetAuthorId: true,
        moderationAction: { select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException();
    }
    if (
      existing.status === 'RESOLVED' ||
      existing.status === 'DISMISSED'
    ) {
      throw new ConflictException('Ce signalement a déjà été traité.');
    }

    if (dto.decision === 'IN_REVIEW') {
      return this.prisma.report.update({
        where: { id },
        data: { status: 'IN_REVIEW' },
        select: reportMemberSelect,
      });
    }

    if (dto.decision === 'DISMISSED') {
      return this.prisma.report.update({
        where: { id },
        data: { status: 'DISMISSED' },
        select: reportMemberSelect,
      });
    }

    // RESOLVED
    if (dto.measure && !dto.measureReason?.trim()) {
      throw new BadRequestException(
        'Indique la raison de la mesure de modération.',
      );
    }

    // Par défaut la sanction vise l’auteur du contenu signalé.
    const subjectUserId =
      dto.subjectUserId ?? existing.targetAuthorId ?? null;

    if (
      dto.measure &&
      dto.measure !== 'WARNING' &&
      dto.measure !== 'CONTENT_REMOVAL' &&
      !subjectUserId
    ) {
      throw new BadRequestException(
        'Indique le compte concerné par la mesure.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.measure === 'CONTENT_REMOVAL') {
        await this.applyContentRemoval(
          tx,
          existing.targetType,
          existing.targetId,
        );
      }

      if (
        dto.measure &&
        subjectUserId &&
        dto.measure !== 'CONTENT_REMOVAL'
      ) {
        await this.applyAccountMeasure(tx, subjectUserId, dto.measure);
      }

      if (dto.measure && !existing.moderationAction) {
        await tx.moderationAction.create({
          data: {
            moderatorId,
            reportId: id,
            subjectUserId:
              dto.measure === 'CONTENT_REMOVAL'
                ? (dto.subjectUserId ?? existing.targetAuthorId)
                : subjectUserId,
            measure: dto.measure,
            reason: dto.measureReason!.trim(),
          },
        });
      }

      await tx.report.update({
        where: { id },
        data: { status: 'RESOLVED' },
      });
    });

    return this.prisma.report.findUniqueOrThrow({
      where: { id },
      select: reportMemberSelect,
    });
  }

  private async resolveTargetSnapshot(
    targetType: CreateReportDto['targetType'],
    targetId: string,
  ): Promise<TargetSnapshot> {
    switch (targetType) {
      case 'TESTIMONIAL': {
        const row = await this.prisma.testimonial.findUnique({
          where: { id: targetId },
          select: {
            authorId: true,
            body: true,
            format: true,
            createdAt: true,
            publishedAt: true,
            communityId: true,
            community: { select: { name: true } },
            author: {
              select: {
                email: true,
                profile: { select: { pseudonym: true } },
              },
            },
          },
        });
        if (!row) {
          throw new NotFoundException('Contenu introuvable.');
        }
        const preview =
          row.format === 'VOICE'
            ? '[témoignage vocal]'
            : this.truncate(row.body);
        return {
          targetAuthorId: row.authorId,
          targetAuthorEmail: row.author.email,
          targetAuthorPseudonym: row.author.profile?.pseudonym ?? null,
          targetPreview: preview,
          targetCreatedAt: row.createdAt,
          targetPublishedAt: row.publishedAt,
          communityId: row.communityId,
          communityName: row.community.name,
        };
      }
      case 'COMMENT': {
        const row = await this.prisma.comment.findUnique({
          where: { id: targetId },
          select: {
            authorId: true,
            body: true,
            createdAt: true,
            testimonial: {
              select: {
                communityId: true,
                community: { select: { name: true } },
              },
            },
            author: {
              select: {
                email: true,
                profile: { select: { pseudonym: true } },
              },
            },
          },
        });
        if (!row) {
          throw new NotFoundException('Contenu introuvable.');
        }
        return {
          targetAuthorId: row.authorId,
          targetAuthorEmail: row.author.email,
          targetAuthorPseudonym: row.author.profile?.pseudonym ?? null,
          targetPreview: this.truncate(row.body),
          targetCreatedAt: row.createdAt,
          targetPublishedAt: null,
          communityId: row.testimonial.communityId,
          communityName: row.testimonial.community.name,
        };
      }
      case 'PROFILE': {
        const row = await this.prisma.profile.findUnique({
          where: { id: targetId },
          select: {
            userId: true,
            pseudonym: true,
            bio: true,
            createdAt: true,
            user: { select: { email: true } },
          },
        });
        if (!row) {
          // Accepter aussi un userId comme targetId profil.
          const byUser = await this.prisma.user.findUnique({
            where: { id: targetId },
            select: {
              id: true,
              email: true,
              createdAt: true,
              profile: { select: { pseudonym: true, bio: true } },
            },
          });
          if (!byUser?.profile) {
            throw new NotFoundException('Profil introuvable.');
          }
          return {
            targetAuthorId: byUser.id,
            targetAuthorEmail: byUser.email,
            targetAuthorPseudonym: byUser.profile.pseudonym,
            targetPreview: this.truncate(byUser.profile.bio),
            targetCreatedAt: byUser.createdAt,
            targetPublishedAt: null,
            communityId: null,
            communityName: null,
          };
        }
        return {
          targetAuthorId: row.userId,
          targetAuthorEmail: row.user.email,
          targetAuthorPseudonym: row.pseudonym,
          targetPreview: this.truncate(row.bio),
          targetCreatedAt: row.createdAt,
          targetPublishedAt: null,
          communityId: null,
          communityName: null,
        };
      }
      default: {
        const _exhaustive: never = targetType;
        throw new BadRequestException(`Type de cible inconnu: ${_exhaustive}`);
      }
    }
  }

  private truncate(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length <= PREVIEW_MAX) {
      return trimmed;
    }
    return `${trimmed.slice(0, PREVIEW_MAX - 1)}…`;
  }

  /** IPs des sessions Redis actives (login) — best-effort, pas une preuve absolue. */
  private async resolveSessionIps(userId: string): Promise<string[]> {
    const sessionIds = await this.redis.lrange(`sessions:${userId}`, 0, -1);
    const ips: string[] = [];
    for (const sessionId of sessionIds) {
      const raw = await this.redis.get(`session:${userId}:${sessionId}`);
      if (!raw) {
        continue;
      }
      try {
        const meta = JSON.parse(raw) as { ip?: string };
        const ip = meta.ip?.trim();
        if (ip && !ips.includes(ip)) {
          ips.push(ip);
        }
      } catch {
        // Session corrompue : ignorer.
      }
    }
    return ips;
  }

  private async applyContentRemoval(
    tx: {
      testimonial: { deleteMany: (args: { where: { id: string } }) => Promise<unknown> };
      comment: {
        updateMany: (args: {
          where: { id: string };
          data: { status: 'REMOVED' };
        }) => Promise<unknown>;
      };
    },
    targetType: CreateReportDto['targetType'],
    targetId: string,
  ) {
    switch (targetType) {
      case 'TESTIMONIAL':
        await tx.testimonial.deleteMany({ where: { id: targetId } });
        break;
      case 'COMMENT':
        await tx.comment.updateMany({
          where: { id: targetId },
          data: { status: 'REMOVED' },
        });
        break;
      case 'PROFILE':
        // Pas de « retrait » de profil : sanction compte uniquement.
        break;
      default: {
        const _exhaustive: never = targetType;
        throw new BadRequestException(`Type de cible inconnu: ${_exhaustive}`);
      }
    }
  }

  private async applyAccountMeasure(
    tx: {
      user: {
        update: (args: {
          where: { id: string };
          data: { status: 'RESTRICTED' | 'SUSPENDED' | 'EXCLUDED' };
        }) => Promise<unknown>;
      };
    },
    subjectUserId: string,
    measure: DecideReportDto['measure'],
  ) {
    switch (measure) {
      case 'WARNING':
      case 'CONTENT_REMOVAL':
        return;
      case 'RESTRICTION':
        await tx.user.update({
          where: { id: subjectUserId },
          data: { status: 'RESTRICTED' },
        });
        return;
      case 'SUSPENSION':
        await tx.user.update({
          where: { id: subjectUserId },
          data: { status: 'SUSPENDED' },
        });
        return;
      case 'EXCLUSION':
        await tx.user.update({
          where: { id: subjectUserId },
          data: { status: 'EXCLUDED' },
        });
        return;
      case undefined:
        return;
      default: {
        const _exhaustive: never = measure;
        throw new BadRequestException(`Mesure inconnue: ${_exhaustive}`);
      }
    }
  }
}
