import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('TestimonialsController', () => {
  let controller: TestimonialsController;
  const service = {
    create: mockFn(),
    listPublished: mockFn(),
    getById: mockFn(),
    update: mockFn(),
    publish: mockFn(),
    delete: mockFn(),
  };
  const user = {
    userId: 'u1',
    sessionId: 's1',
    role: 'USER',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TestimonialsController],
      providers: [{ provide: TestimonialsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthenticatedUser(user))
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(TestimonialsController);
  });

  it('délègue create', async () => {
    const dto = { format: 'TEXT' as const, body: 'x' };
    service.create.mockResolvedValue({ id: 't1' });
    await controller.create(user as never, 'c1', dto);
    expect(service.create).toHaveBeenCalledWith('u1', 'c1', dto);
  });

  it('délègue list', async () => {
    service.listPublished.mockResolvedValue({ items: [], nextCursor: null });
    await controller.list(user as never, 'c1', { limit: 20 });
    expect(service.listPublished).toHaveBeenCalledWith('u1', 'c1', {
      limit: 20,
    });
  });

  it('délègue getById / update / publish / delete', async () => {
    service.getById.mockResolvedValue({ id: 't1' });
    service.update.mockResolvedValue({ id: 't1' });
    service.publish.mockResolvedValue({ id: 't1' });
    service.delete.mockResolvedValue({ message: 'ok' });

    await controller.getById(user as never, 't1');
    await controller.update(user as never, 't1', { body: 'y' });
    await controller.publish(user as never, 't1');
    await controller.delete(user as never, 't1');

    expect(service.getById).toHaveBeenCalledWith('u1', 't1');
    expect(service.update).toHaveBeenCalledWith('u1', 't1', { body: 'y' });
    expect(service.publish).toHaveBeenCalledWith('u1', 't1');
    expect(service.delete).toHaveBeenCalledWith('u1', 't1');
  });
});
