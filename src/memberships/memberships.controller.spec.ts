import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('MembershipsController', () => {
  let controller: MembershipsController;
  const service = {
    join: mockFn(),
    leave: mockFn(),
    listAccepted: mockFn(),
    decide: mockFn(),
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
      controllers: [MembershipsController],
      providers: [{ provide: MembershipsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthenticatedUser(user))
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(MembershipsController);
  });

  it('délègue join', async () => {
    service.join.mockResolvedValue({ status: 'ACCEPTED' });
    await controller.join(user as never, 'c1');
    expect(service.join).toHaveBeenCalledWith('u1', 'c1');
  });

  it('délègue leave', async () => {
    service.leave.mockResolvedValue({ status: 'LEFT' });
    await controller.leave(user as never, 'c1');
    expect(service.leave).toHaveBeenCalledWith('u1', 'c1');
  });

  it('délègue list', async () => {
    service.listAccepted.mockResolvedValue([]);
    await controller.list(user as never, 'c1');
    expect(service.listAccepted).toHaveBeenCalledWith('u1', 'c1');
  });

  it('délègue decide', async () => {
    service.decide.mockResolvedValue({ status: 'ACCEPTED' });
    await controller.decide(user as never, 'c1', 'u2', {
      decision: 'ACCEPT',
    });
    expect(service.decide).toHaveBeenCalledWith('u1', 'c1', 'u2', 'ACCEPT');
  });
});
