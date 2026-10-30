import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
    });
    super({ adapter });
  }

  // Une URL incorrecte doit échouer au démarrage, pas à la première requête.
  async onModuleInit() {
    await this.$connect();
  }

  // Ferme le pool ouvert par l'adaptateur PostgreSQL.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
