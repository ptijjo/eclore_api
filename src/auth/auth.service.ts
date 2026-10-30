import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { MailService } from '../mail/mail.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { ResendVerificationDto } from './dto/resend-verification.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type {
  AuthSessionView,
  AuthTokens,
  RegisterResult,
} from './auth.types.js';

type SessionMeta = {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  refreshJti: string;
  userAgent?: string;
  ip?: string;
};

type UserAuthRow = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  birthDate: Date;
  emailVerifiedAt: Date | null;
  createdAt?: Date;
  profile: { pseudonym: string } | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<RegisterResult> {
    if (!dto.confirmIsAdult || !dto.acceptTerms || !dto.acceptAnonymityAck) {
      throw new BadRequestException(
        'Les confirmations obligatoires (majorité, conditions, limites de l’anonymat) sont requises.',
      );
    }

    if (!this.isAtLeast18(dto.birthDate)) {
      throw new BadRequestException(
        'Éclore est réservée aux personnes majeures (18 ans ou plus). Aucun compte n’a été créé.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, createdAt: true },
    });
    if (existing?.emailVerifiedAt) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }
    // Compte non vérifié : dans les 48 h → conflit ; après 48 h → purge puis réinscription.
    if (existing && !existing.emailVerifiedAt) {
      if (!this.isRegistrationExpired(existing.createdAt)) {
        throw new ConflictException(
          'Une inscription est déjà en cours pour cet email. Vérifie ta boîte mail ou renvoie le lien.',
        );
      }
      await this.deleteUnverifiedAccount(existing.id);
    }

    const pseudonymTaken = await this.prisma.profile.findUnique({
      where: { pseudonym: dto.pseudonym },
      select: { id: true },
    });
    if (pseudonymTaken) {
      throw new ConflictException('Ce pseudonyme est déjà utilisé.');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      Number(this.config.getOrThrow('BCRYPT_ROUNDS')),
    );
    const now = new Date();

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        birthDate: dto.birthDate,
        emailVerifiedAt: null,
        termsAcceptedAt: now,
        termsVersion: String(this.config.getOrThrow('TERMS_VERSION')),
        anonymityAckAcceptedAt: now,
        anonymityAckVersion: String(
          this.config.getOrThrow('ANONYMITY_ACK_VERSION'),
        ),
        profile: {
          create: { pseudonym: dto.pseudonym },
        },
      },
      include: { profile: true },
    });

    // Journal sécurité : création de compte (pas dans la réponse API).
    this.logger.log(
      `account_created userId=${user.id} at=${now.toISOString()} ip=${ip ?? 'unknown'}`,
    );

    await this.issueEmailVerification(user.id, email);

    return {
      id: user.id,
      email: user.email,
      pseudonym: user.profile!.pseudonym,
      message:
        'Compte créé. Consulte ta boîte mail pour confirmer ton adresse avant de te connecter.',
    };
  }

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const login = dto.login.trim();
    const emailCandidate = login.toLowerCase();

    const user = (await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailCandidate },
          { profile: { pseudonym: login } },
        ],
      },
      include: { profile: true },
    })) as UserAuthRow | null;

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    // Email non vérifié : jamais de session. Après 48 h, le compte est retiré.
    if (!user.emailVerifiedAt) {
      if (user.createdAt && this.isRegistrationExpired(user.createdAt)) {
        await this.deleteUnverifiedAccount(user.id);
        throw new UnauthorizedException(
          'Inscription expirée. Tu peux te réinscrire.',
        );
      }
      throw new ForbiddenException(
        'Email non vérifié. Consulte ta boîte mail pour confirmer ton adresse.',
      );
    }

    if (user.status === 'SUSPENDED' || user.status === 'EXCLUDED') {
      throw new ForbiddenException('Ce compte n’est plus autorisé à se connecter.');
    }

    if (!this.isAtLeast18(user.birthDate)) {
      throw new ForbiddenException(
        'Éclore est réservée aux personnes majeures (18 ans ou plus).',
      );
    }

    return this.createSessionTokens(user, meta);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const userId = await this.redis.get(`email-verify:${token}`);
    if (!userId) {
      throw new BadRequestException('Lien de vérification invalide ou expiré.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.redis.del(`email-verify:${token}`);

    return {
      message:
        'Email confirmé. Ouvre l’application Éclore pour te connecter.',
    };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, createdAt: true },
    });

    if (user && !user.emailVerifiedAt) {
      if (this.isRegistrationExpired(user.createdAt)) {
        await this.deleteUnverifiedAccount(user.id);
      } else {
        await this.issueEmailVerification(user.id, email);
      }
    }

    return {
      message:
        'Si un compte non vérifié existe pour cet email, un nouveau lien a été envoyé.',
    };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    let payload: { sub: string; sid: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    const stored = await this.redis.get(
      `refresh:${payload.sub}:${payload.jti}`,
    );
    if (!stored || stored !== payload.sub) {
      throw new UnauthorizedException('Refresh token révoqué.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
    if (
      !user ||
      !user.emailVerifiedAt ||
      user.status === 'SUSPENDED' ||
      user.status === 'EXCLUDED'
    ) {
      throw new UnauthorizedException('Session invalide.');
    }

    // Rotation : invalider l’ancien refresh avant d’en émettre un nouveau.
    await this.redis.del(`refresh:${payload.sub}:${payload.jti}`);

    const sessionRaw = await this.redis.get(
      `session:${payload.sub}:${payload.sid}`,
    );
    const sessionMeta: SessionMeta = sessionRaw
      ? (JSON.parse(sessionRaw) as SessionMeta)
      : {
          sessionId: payload.sid,
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          refreshJti: payload.jti,
        };

    return this.issueTokensForSession(user.id, sessionMeta);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    const sessionRaw = await this.redis.get(`session:${userId}:${sessionId}`);
    const refreshJti = sessionRaw
      ? (JSON.parse(sessionRaw) as SessionMeta).refreshJti
      : undefined;

    await this.redis.lrem(`sessions:${userId}`, 0, sessionId);
    await this.redis.del(
      `session:${userId}:${sessionId}`,
      refreshJti ? `refresh:${userId}:${refreshJti}` : `refresh:${userId}:`,
    );
  }

  async listSessions(userId: string): Promise<AuthSessionView[]> {
    const ids = await this.redis.lrange(`sessions:${userId}`, 0, -1);
    const sessions: AuthSessionView[] = [];

    for (const sessionId of ids) {
      const raw = await this.redis.get(`session:${userId}:${sessionId}`);
      if (!raw) {
        continue;
      }
      const meta = JSON.parse(raw) as SessionMeta;
      sessions.push({
        sessionId: meta.sessionId,
        createdAt: meta.createdAt,
        lastSeenAt: meta.lastSeenAt,
        userAgent: meta.userAgent,
      });
    }

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.logout(userId, sessionId);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (user?.emailVerifiedAt) {
      const token = randomUUID();
      const ttlHours = Number(
        this.config.get('PASSWORD_RESET_TTL_HOURS', 1),
      );
      await this.redis.set(
        `password-reset:${token}`,
        user.id,
        ttlHours * 3600,
      );
      const base = this.config.getOrThrow<string>('API_PUBLIC_URL');
      await this.mail.sendPasswordReset(
        email,
        `${base}/auth/reset-password?token=${token}`,
      );
    }

    return {
      message:
        'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.redis.get(`password-reset:${dto.token}`);
    if (!userId) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      Number(this.config.getOrThrow('BCRYPT_ROUNDS')),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.redis.del(`password-reset:${dto.token}`);

    return { message: 'Mot de passe mis à jour. Tu peux te connecter.' };
  }

  async validateAccessUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
    if (
      !user ||
      !user.emailVerifiedAt ||
      user.status === 'SUSPENDED' ||
      user.status === 'EXCLUDED'
    ) {
      throw new UnauthorizedException();
    }
    return user;
  }

  private async issueEmailVerification(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = randomUUID();
    const ttlHours = Number(
      this.config.get('EMAIL_VERIFY_TTL_HOURS', 48),
    );
    await this.redis.set(`email-verify:${token}`, userId, ttlHours * 3600);
    const base = this.config.getOrThrow<string>('API_PUBLIC_URL');
    await this.mail.sendEmailVerification(
      email,
      `${base}/auth/verify-email?token=${token}`,
    );
  }

  private async createSessionTokens(
    user: Pick<UserAuthRow, 'id' | 'role' | 'status'>,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const maxSessions = Number(this.config.get('AUTH_MAX_SESSIONS', 3));
    const existing = await this.redis.lrange(`sessions:${user.id}`, 0, -1);

    // Max 3 appareils : la 4ᵉ connexion révoque la plus ancienne (FIFO).
    while (existing.length >= maxSessions) {
      const oldest = existing.pop();
      if (oldest) {
        await this.logout(user.id, oldest);
      }
    }

    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const sessionMeta: SessionMeta = {
      sessionId,
      createdAt: now,
      lastSeenAt: now,
      refreshJti: '',
      userAgent: meta.userAgent,
      ip: meta.ip,
    };

    return this.issueTokensForSession(user.id, sessionMeta, true);
  }

  private async issueTokensForSession(
    userId: string,
    sessionMeta: SessionMeta,
    isNew = false,
  ): Promise<AuthTokens> {
    const refreshJti = randomUUID();
    sessionMeta.refreshJti = refreshJti;
    sessionMeta.lastSeenAt = new Date().toISOString();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionMeta.sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') as `${number}m`,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionMeta.sessionId, jti: refreshJti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL', '30d') as `${number}d`,
      },
    );

    const refreshTtlSeconds = 30 * 24 * 3600;
    await this.redis.set(
      `refresh:${userId}:${refreshJti}`,
      userId,
      refreshTtlSeconds,
    );
    await this.redis.set(
      `session:${userId}:${sessionMeta.sessionId}`,
      JSON.stringify(sessionMeta),
      refreshTtlSeconds,
    );

    if (isNew) {
      await this.redis.lpush(
        `sessions:${userId}`,
        sessionMeta.sessionId,
      );
      await this.redis.ltrim(
        `sessions:${userId}`,
        0,
        Number(this.config.get('AUTH_MAX_SESSIONS', 3)) - 1,
      );
    }

    return { accessToken, refreshToken };
  }

  private isAtLeast18(birthDate: Date): boolean {
    const today = new Date();
    const eighteenth = new Date(birthDate);
    eighteenth.setFullYear(eighteenth.getFullYear() + 18);
    return eighteenth <= today;
  }

  private isRegistrationExpired(createdAt: Date): boolean {
    const ttlHours = Number(
      this.config.get('EMAIL_VERIFY_TTL_HOURS', 48),
    );
    return Date.now() - createdAt.getTime() > ttlHours * 3600 * 1000;
  }

  /** Purge un compte jamais vérifié (profil en cascade). */
  private async deleteUnverifiedAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`unverified_account_purged userId=${userId}`);
  }
}
