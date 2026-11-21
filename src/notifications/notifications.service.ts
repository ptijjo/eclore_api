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

export type MembershipRequestNotifyInput = {
  communityId: string;
  communityName: string;
  requesterUserId: string;
  requesterPseudonym: string;
};

export type MembershipDecisionNotifyInput = {
  communityId: string;
  communityName: string;
  targetUserId: string;
  accepted: boolean;
};

export type SupportReactionNotifyInput = {
  authorUserId: string;
  actorPseudonym: string;
  kindLabel: string;
  testimonialId: string;
  communityId: string;
};

export type ThemeProposalNotifyInput = {
  id: string;
  communityId: string;
  communityName: string;
  label: string;
  rationale: string;
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

  /**
   * Demande d’adhésion REQUEST → notifier OWNER / MODERATOR + ADMIN plateforme.
   */
  async notifyMembershipRequest(input: MembershipRequestNotifyInput) {
    const [responsibles, admins] = await Promise.all([
      this.prisma.communityMembership.findMany({
        where: {
          communityId: input.communityId,
          status: 'ACCEPTED',
          role: { in: ['OWNER', 'MODERATOR'] },
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);

    const recipientIds = [
      ...new Set([
        ...responsibles.map((row) => row.userId),
        ...admins.map((admin) => admin.id),
      ]),
    ].filter((id) => id !== input.requesterUserId);

    if (recipientIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: 'MEMBERSHIP_REQUEST',
        title: 'Demande d’accès',
        body: `@${input.requesterPseudonym} souhaite rejoindre « ${input.communityName} »`,
        data: {
          communityId: input.communityId,
          requesterUserId: input.requesterUserId,
        },
      })),
    });

    await this.pushToUsers(recipientIds, {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type: 'MEMBERSHIP_REQUEST',
        communityId: input.communityId,
      },
    });
  }

  /**
   * Proposition de pastille thème → OWNER / MODERATOR + ADMIN.
   * Pas de rôle spécial pour le demandeur ; décision humaine.
   */
  async notifyThemeProposal(input: ThemeProposalNotifyInput) {
    const [responsibles, admins] = await Promise.all([
      this.prisma.communityMembership.findMany({
        where: {
          communityId: input.communityId,
          status: 'ACCEPTED',
          role: { in: ['OWNER', 'MODERATOR'] },
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);

    const recipientIds = [
      ...new Set([
        ...responsibles.map((row) => row.userId),
        ...admins.map((admin) => admin.id),
      ]),
    ];

    if (recipientIds.length === 0) {
      return;
    }

    const bodyPreview =
      input.rationale.length > 120
        ? `${input.rationale.slice(0, 117)}…`
        : input.rationale;

    await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: 'THEME_PROPOSAL',
        title: 'Proposition de thème',
        body: `« ${input.label} » dans ${input.communityName} — ${bodyPreview}`,
        data: {
          themeProposalId: input.id,
          communityId: input.communityId,
        },
      })),
    });

    await this.pushToUsers(recipientIds, {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type: 'THEME_PROPOSAL',
        communityId: input.communityId,
        themeProposalId: input.id,
      },
    });
  }

  /**
   * Signe de présence sur un témoignage → notifier l’auteur.
   * Push générique (pas de détail sensible sur l’écran verrouillé).
   */
  async notifySupportReaction(input: SupportReactionNotifyInput) {
    await this.prisma.notification.create({
      data: {
        userId: input.authorUserId,
        type: 'SUPPORT_REACTION',
        title: 'Nouveau signe de présence',
        body: `@${input.actorPseudonym} a laissé « ${input.kindLabel} » sur ton témoignage.`,
        data: {
          testimonialId: input.testimonialId,
          communityId: input.communityId,
        },
      },
    });

    await this.pushToUsers([input.authorUserId], {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type: 'SUPPORT_REACTION',
        testimonialId: input.testimonialId,
        communityId: input.communityId,
      },
    });
  }

  /** Décision d’adhésion → notifier la personne concernée. */
  async notifyMembershipDecision(input: MembershipDecisionNotifyInput) {
    const type = input.accepted
      ? 'MEMBERSHIP_ACCEPTED'
      : 'MEMBERSHIP_REJECTED';
    const title = input.accepted
      ? 'Accès accepté'
      : 'Demande non retenue';
    const body = input.accepted
      ? `Tu peux maintenant accéder à « ${input.communityName} ».`
      : `Ta demande pour « ${input.communityName} » n’a pas été acceptée.`;

    await this.prisma.notification.create({
      data: {
        userId: input.targetUserId,
        type,
        title,
        body,
        data: {
          communityId: input.communityId,
          decision: input.accepted ? 'ACCEPT' : 'REJECT',
        },
      },
    });

    await this.pushToUsers([input.targetUserId], {
      title: 'Éclore',
      body: 'Tu as une nouvelle interaction sur Éclore',
      data: {
        type,
        communityId: input.communityId,
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

  /** Marque une notification comme lue — uniquement si elle appartient au user. */
  async markOneRead(userId: string, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: updated.count };
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
