import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  MediaService,
  type UploadedAudioFile,
} from './media.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedRequestUser } from '../auth/auth.types.js';

class UploadAudioMetaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180_000)
  durationMs!: number;
}

@Controller('media')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15_000_000 },
    }),
  )
  uploadAudio(
    @CurrentUser() user: AuthenticatedRequestUser,
    @UploadedFile() file: UploadedAudioFile | undefined,
    @Body() meta: UploadAudioMetaDto,
  ) {
    if (!file) {
      throw new BadRequestException('Fichier audio manquant.');
    }
    return this.mediaService.uploadAudio(user.userId, file, meta.durationMs);
  }

  @Get(':id/url')
  getSignedUrl(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.mediaService.getSignedUrl(user.userId, id);
  }
}
