import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { OBJECT_STORAGE } from './object-storage.service.js';
import { R2ObjectStorageService } from './r2-object-storage.service.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, MembershipsModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: OBJECT_STORAGE,
      useClass: R2ObjectStorageService,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
