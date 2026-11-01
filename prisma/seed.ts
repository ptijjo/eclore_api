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

const SHARED_RULES = `Règles de cet espace Éclore :
• Respect et bienveillance — pas de jugement ni d’humiliation.
• Pseudonyme seulement — pas d’identité réelle, email, téléphone ou adresse.
• Tu choisis ce que tu partages ; tu n’es pas obligé·e de répondre.
• Si quelqu’un demande surtout d’être écouté·e, évite les conseils non demandés.
• Éclore n’est pas un service d’urgence ni un suivi médical.
• Tu peux signaler un contenu qui ne respecte pas ces règles.`;

/** Catalogue initial MVP — volontairement court et modérable. */
const STARTER_COMMUNITIES = [
  {
    name: 'Vie quotidienne',
    theme: 'Solitude et charge mentale',
    description:
      'Un espace pour parler du quotidien : fatigue, solitude, charge mentale, impression de tout porter seul·e. Tu peux venir sans « grosse » histoire à raconter.',
    joinPolicy: 'REQUEST' as const,
  },
  {
    name: 'Relations difficiles',
    theme: 'Couple, famille, amitiés',
    description:
      'Pour évoquer les liens qui font mal ou qui se défont : couple, famille, amitiés toxiques, ruptures. À ton rythme, sans devoir tout expliquer.',
    joinPolicy: 'REQUEST' as const,
  },
  {
    name: 'Deuil et absences',
    theme: 'Perte et séparation',
    description:
      'Un espace pour les deuils et les absences — d’une personne, d’une relation, d’un projet. Ici, on peut nommer le vide sans se justifier.',
    joinPolicy: 'REQUEST' as const,
  },
  {
    name: 'Travail et estime de soi',
    theme: 'Burn-out, honte, pression',
    description:
      'Pour parler du travail, de la pression, du burn-out, de la honte ou du rejet. Un endroit pour déposer ce que tu vis sans concours de performance.',
    joinPolicy: 'REQUEST' as const,
  },
  {
    name: 'Se reconstruire',
    theme: 'Après une épreuve',
    description:
      'Pour celles et ceux qui avancent après une épreuve, à petits pas. Partager une reprise de confiance, un doute, ou simplement être présent·e.',
    joinPolicy: 'REQUEST' as const,
  },
  {
    name: 'Juste parler',
    theme: 'Sans étiquette',
    description:
      'Si tu ne sais pas encore où aller : un espace pour parler sans devoir choisir une catégorie. « Je ne sais pas encore ce dont j’ai besoin » est une intention valide.',
    joinPolicy: 'REQUEST' as const,
  },
] as const;

async function ensureAdmin(prisma: PrismaClient): Promise<string> {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const username = requireEnv('ADMIN_USERNAME');
  const termsVersion = process.env.TERMS_VERSION ?? '1.0';
  const anonymityAckVersion = process.env.ANONYMITY_ACK_VERSION ?? '1.0';
  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const now = new Date();
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
    console.log(
      `Admin mis à jour: ${email} (role=ADMIN, pseudonym=${username})`,
    );
    return existing.id;
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

  const created = await prisma.user.create({
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
    select: { id: true },
  });

  console.log(`Admin créé: ${email} (role=ADMIN, pseudonym=${username})`);
  return created.id;
}

async function seedStarterCommunities(
  prisma: PrismaClient,
  ownerUserId: string,
) {
  const now = new Date();

  for (const item of STARTER_COMMUNITIES) {
    const community = await prisma.community.upsert({
      where: { name: item.name },
      create: {
        name: item.name,
        description: item.description,
        theme: item.theme,
        rules: SHARED_RULES,
        joinPolicy: item.joinPolicy,
        status: 'DRAFT',
      },
      update: {
        description: item.description,
        theme: item.theme,
        rules: SHARED_RULES,
        joinPolicy: item.joinPolicy,
      },
      select: { id: true, name: true, status: true },
    });

    const membership = await prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: ownerUserId,
          communityId: community.id,
        },
      },
      select: { id: true },
    });

    if (membership) {
      await prisma.communityMembership.update({
        where: { id: membership.id },
        data: { role: 'OWNER', status: 'ACCEPTED' },
      });
    } else {
      await prisma.communityMembership.create({
        data: {
          userId: ownerUserId,
          communityId: community.id,
          role: 'OWNER',
          status: 'ACCEPTED',
          lastJoinRequestedAt: now,
        },
      });
    }

    if (community.status !== 'ACTIVE') {
      await prisma.community.update({
        where: { id: community.id },
        data: { status: 'ACTIVE' },
      });
    }

    console.log(`Communauté ACTIVE: ${community.name}`);
  }
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: requireEnv('DATABASE_URL'),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const adminId = await ensureAdmin(prisma);
    await seedStarterCommunities(prisma, adminId);
    console.log('Seed terminé (admin + communautés de démarrage).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
