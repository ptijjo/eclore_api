import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterPushTokenDto } from './dto/register-push-token.dto.js';
import {
  ExpoPushClient,
  type ExpoPushMessage,
} from './expo-push.client.js';

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const;

export type CommunityProposalNotifyInput = {
  id: string;
  name: string;
  rationale: string;
};

export type ContentReportNotifyInput = {
  id: string;
  reason: string;
  targetType: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushClient,
  ) {}

  /**
   * 1. Lister les comptes ADMIN ACTIVE (pas JWT).
   * 2. Créer une notif in-app par admin.
   * 3. Push Expo hors app — libellé générique (pas de contenu sensible lock-screen).
   */
  async notifyAdminsOfCommunityProposal(proposal: CommunityProposalNotifyInput) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    if (admins.length === 0) {
      return;
    }

    const bodyPreview =
      proposal.rationale.length > 160
        ? `${proposal.rationale.slice(0, 157)}…`
        : proposal.rationale;

    const adminIds = admins.map((admin) => admin.id);

    await this.prisma.notification.createMany({
      data: adminIds.map((userId) => ({
        userId,
        type: 'COMMUNITY_PROPOSAL',
        title: 'Nouvelle proposition de communauté',
        body: `« ${proposal.name} » — ${bodyPreview}`,
        data: { proposalId: proposal.id },
      })),
    });

    await this.pushToUsers(adminIds, {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type: 'COMMUNITY_PROPOSAL',
        proposalId: proposal.id,
      },
    });
  }

  /**
   * Alerte ADMIN : nouveau signalement (détails dans la file, pas sur le lock-screen).
   */
  async notifyAdminsOfContentReport(report: ContentReportNotifyInput) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    if (admins.length === 0) {
      return;
    }

    const adminIds = admins.map((admin) => admin.id);

    await this.prisma.notification.createMany({
      data: adminIds.map((userId) => ({
        userId,
        type: 'CONTENT_REPORT',
        title: 'Nouveau signalement',
        body: `${report.targetType} — motif ${report.reason}`,
        data: { reportId: report.id },
      })),
    });

    await this.pushToUsers(adminIds, {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type: 'CONTENT_REPORT',
        reportId: report.id,
      },
    });
  }

  listForUser(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      select: notificationSelect,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Enregistre / rattache un token Expo Push à l’utilisateur courant.
   * Si le token existait pour un autre compte, on le bascule (un appareil = un user).
   */
  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    const token = dto.token.trim();
    return this.prisma.devicePushToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
      },
      select: {
        id: true,
        userId: true,
        token: true,
        platform: true,
        updatedAt: true,
      },
    });
  }

  private async pushToUsers(
    userIds: string[],
    payload: {
      title: string;
      body: string;
      data: Record<string, string>;
    },
  ) {
    const tokens = await this.prisma.devicePushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (tokens.length === 0) {
      return;
    }

    const messages: ExpoPushMessage[] = tokens.map((row) => ({
      to: row.token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      channelId: 'eclore-default',
      priority: 'high',
    }));

    try {
      await this.expoPush.send(messages);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'erreur push inconnue';
      this.logger.warn(`Envoi Expo Push échoué: ${message}`);
    }
  }
}
