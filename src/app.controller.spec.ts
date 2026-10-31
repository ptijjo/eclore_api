import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /health', () => {
    it('retourne status ok (route publique pour Coolify / Docker)', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
