import { PrismaService } from '../../prisma/prisma.service.js';
import { mockFn } from './jest-fn.js';

export type MockPrismaService = {
  user: {
    findUnique: ReturnType<typeof mockFn>;
    findFirst: ReturnType<typeof mockFn>;
    findMany: ReturnType<typeof mockFn>;
    create: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
    delete: ReturnType<typeof mockFn>;
  };
  profile: {
    findUnique: ReturnType<typeof mockFn>;
    findFirst: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
  };
  community: {
    findUnique: ReturnType<typeof mockFn>;
    findMany: ReturnType<typeof mockFn>;
    create: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
  };
  communityMembership: {
    findUnique: ReturnType<typeof mockFn>;
    findMany: ReturnType<typeof mockFn>;
    create: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
    count: ReturnType<typeof mockFn>;
  };
  communityProposal: {
    create: ReturnType<typeof mockFn>;
    findMany: ReturnType<typeof mockFn>;
  };
  testimonial: {
    findUnique: ReturnType<typeof mockFn>;
    findMany: ReturnType<typeof mockFn>;
    create: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
    delete: ReturnType<typeof mockFn>;
  };
  mediaAsset: {
    findUnique: ReturnType<typeof mockFn>;
    create: ReturnType<typeof mockFn>;
    update: ReturnType<typeof mockFn>;
  };
  $transaction: ReturnType<typeof mockFn>;
};

export function createMockPrismaService(): MockPrismaService {
  const prisma: MockPrismaService = {
    user: {
      findUnique: mockFn(),
      findFirst: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      delete: mockFn(),
    },
    profile: {
      findUnique: mockFn(),
      findFirst: mockFn(),
      update: mockFn(),
    },
    community: {
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
    },
    communityMembership: {
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      count: mockFn(),
    },
    communityProposal: {
      create: mockFn(),
      findMany: mockFn(),
    },
    testimonial: {
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      delete: mockFn(),
    },
    mediaAsset: {
      findUnique: mockFn(),
      create: mockFn(),
      update: mockFn(),
    },
    $transaction: mockFn(),
  };

  prisma.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') {
      return (ops as (tx: MockPrismaService) => unknown)(prisma);
    }
    return Promise.all(ops as Promise<unknown>[]);
  });

  return prisma;
}

export const mockPrismaServiceProvider = {
  provide: PrismaService,
  useFactory: createMockPrismaService,
};
