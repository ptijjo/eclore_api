import { Module } from '@nestjs/common';
import { ExpoPushClient } from './expo-push.client.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushClient],
  exports: [NotificationsService],
})
export class NotificationsModule {}
