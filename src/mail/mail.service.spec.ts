import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn, mockSyncFn } from '../test/mocks/jest-fn.js';

const request = mockFn().mockResolvedValue({});
const post = mockSyncFn().mockReturnValue({ request });
const apiConnect = mockSyncFn().mockReturnValue({ post });

jest.unstable_mockModule('node-mailjet', () => ({
  default: { Client: { apiConnect } },
}));

const { MailService } = await import('./mail.service.js');
const { createMockConfigService } = await import(
  '../test/mocks/config.mock.js'
);

describe('MailService', () => {
  let service: InstanceType<typeof MailService>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiConnect.mockReturnValue({ post });
    post.mockReturnValue({ request });
    request.mockResolvedValue({});
    service = new MailService(createMockConfigService());
  });

  it('envoie la vérification email', async () => {
    await service.sendEmailVerification(
      'a@b.c',
      'http://localhost/auth/verify-email?token=x',
    );
    expect(post).toHaveBeenCalledWith('send', { version: 'v3.1' });
    expect(request).toHaveBeenCalled();
  });

  it('envoie le reset password', async () => {
    await service.sendPasswordReset(
      'a@b.c',
      'http://localhost/auth/reset-password?token=x',
    );
    expect(request).toHaveBeenCalled();
  });

  it('masque les détails Mailjet en cas d’échec', async () => {
    request.mockRejectedValue(new Error('secret body'));
    await expect(
      service.sendEmailVerification('a@b.c', 'http://x'),
    ).rejects.toThrow('MAIL_SEND_FAILED');
  });
});
