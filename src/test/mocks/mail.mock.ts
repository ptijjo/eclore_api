import { MailService } from '../../mail/mail.service.js';
import { mockFn } from './jest-fn.js';

export type MockMailService = {
  sendEmailVerification: ReturnType<typeof mockFn>;
  sendPasswordReset: ReturnType<typeof mockFn>;
};

export function createMockMailService(): MockMailService {
  return {
    sendEmailVerification: mockFn().mockResolvedValue(undefined),
    sendPasswordReset: mockFn().mockResolvedValue(undefined),
  };
}

export const mockMailServiceProvider = {
  provide: MailService,
  useFactory: createMockMailService,
};
