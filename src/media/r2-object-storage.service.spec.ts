import { describe, expect, it } from '@jest/globals';
import { R2ObjectStorageService } from './r2-object-storage.service.js';
import { createMockConfigService } from '../test/mocks/config.mock.js';

describe('R2ObjectStorageService (Cloudflare R2)', () => {
  const service = new R2ObjectStorageService(
    createMockConfigService({
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'AKIA_TEST',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret_test',
      CLOUDFLARE_R2_BUCKET_NAME: 'eclore',
      CLOUDFLARE_R2_ENDPOINT:
        'https://e6ba12d93ad9307dcca07b8966556484.r2.cloudflarestorage.com',
    }),
  );

  it('génère une URL signée vers l’endpoint Cloudflare R2', async () => {
    const url = await service.getSignedGetUrl('audio/u1/file.m4a', 60);
    expect(url).toContain(
      'https://e6ba12d93ad9307dcca07b8966556484.r2.cloudflarestorage.com/eclore/audio/u1/file.m4a',
    );
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=60');
    // Pas d’URL publique permanente pour l’audio privé.
    expect(url).not.toContain('r2.dev');
  });
});
