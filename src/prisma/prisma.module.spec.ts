import { Test } from '@nestjs/testing';
import { describe, expect, it } from '@jest/globals';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaModule', () => {
  it('expose PrismaService', async () => {
    const prisma = {
      onModuleInit: () => Promise.resolve(),
      onModuleDestroy: () => Promise.resolve(),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    expect(moduleRef.get(PrismaService)).toBe(prisma);
  });
});
