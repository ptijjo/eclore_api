import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable d’environnement manquante: ${name}`);
  }
  return value;
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const username = requireEnv('ADMIN_USERNAME');
  const termsVersion = process.env.TERMS_VERSION ?? '1.0';
  const anonymityAckVersion = process.env.ANONYMITY_ACK_VERSION ?? '1.0';
  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  const adapter = new PrismaPg({
    connectionString: requireEnv('DATABASE_URL'),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    const now = new Date();
    // Compte ops : majeur déclaré, email déjà vérifié, rôle plateforme ADMIN.
    const birthDate = new Date('1990-01-01');

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: existing.emailVerifiedAt ?? now,
          birthDate,
          termsAcceptedAt: existing.termsAcceptedAt ?? now,
          termsVersion,
          anonymityAckAcceptedAt: existing.anonymityAckAcceptedAt ?? now,
          anonymityAckVersion,
          profile: existing.profile
            ? { update: { pseudonym: username } }
            : { create: { pseudonym: username } },
        },
      });
      console.log(`Admin mis à jour: ${email} (role=ADMIN, pseudonym=${username})`);
      return;
    }

    const pseudonymTaken = await prisma.profile.findUnique({
      where: { pseudonym: username },
      select: { id: true },
    });
    if (pseudonymTaken) {
      throw new Error(
        `Le pseudonyme ADMIN_USERNAME="${username}" est déjà pris par un autre compte.`,
      );
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        birthDate,
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion,
        anonymityAckAcceptedAt: now,
        anonymityAckVersion,
        profile: {
          create: { pseudonym: username },
        },
      },
    });

    console.log(`Admin créé: ${email} (role=ADMIN, pseudonym=${username})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
