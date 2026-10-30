import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from './prisma.service.js';

const databaseUrl =
  'postgresql://user:password@127.0.0.1:5432/eclore?schema=public';

describe('PrismaService', () => {
  let service: PrismaService | undefined;

  afterEach(async () => {
    await service?.$disconnect();
    service = undefined;
  });

  it('refuse de démarrer sans DATABASE_URL', () => {
    const configService = new ConfigService({});

    expect(() => new PrismaService(configService)).toThrow();
  });

  it('ouvre la connexion au démarrage du module', async () => {
    service = new PrismaService(
      new ConfigService({ DATABASE_URL: databaseUrl }),
    );
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('ferme la connexion à l’arrêt du module', async () => {
    service = new PrismaService(
      new ConfigService({ DATABASE_URL: databaseUrl }),
    );
    const disconnect = jest.spyOn(service, '$disconnect');

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
