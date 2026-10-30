import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CommunitiesController,
  CommunityProposalsController,
} from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';
import { CommunityProposalsService } from './community-proposals.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { mockAuthenticatedUser } from '../test/mocks/guards.mock.js';
import { mockFn } from '../test/mocks/jest-fn.js';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;
  const service = {
    list: mockFn(),
    listAllForAdmin: mockFn(),
    getById: mockFn(),
    getByIdForAdmin: mockFn(),
    create: mockFn(),
    updateStatus: mockFn(),
    assignResponsible: mockFn(),
  };
  const proposalsService = {
    create: mockFn(),
    listForAdmin: mockFn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CommunitiesController],
      providers: [
        { provide: CommunitiesService, useValue: service },
        { provide: CommunityProposalsService, useValue: proposalsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(
        mockAuthenticatedUser({
          userId: 'u1',
          sessionId: 's1',
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      )
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(CommunitiesController);
  });

  it('délègue list', async () => {
    service.list.mockResolvedValue([]);
    await controller.list();
    expect(service.list).toHaveBeenCalled();
  });

  it('délègue getById', async () => {
    service.getById.mockResolvedValue({ id: 'c1' });
    await controller.getById('c1');
    expect(service.getById).toHaveBeenCalledWith('c1');
  });

  it('délègue create', async () => {
    const dto = {
      name: 'n',
      description: 'd',
      theme: 't',
      rules: 'r',
      joinPolicy: 'OPEN' as const,
    };
    service.create.mockResolvedValue({ id: 'c1' });
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('délègue updateStatus', async () => {
    service.updateStatus.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    await controller.updateStatus('c1', { status: 'ACTIVE' });
    expect(service.updateStatus).toHaveBeenCalledWith('c1', {
      status: 'ACTIVE',
    });
  });

  it('délègue assignResponsible', async () => {
    service.assignResponsible.mockResolvedValue({ role: 'OWNER' });
    await controller.assignResponsible('c1', {
      userId: 'u2',
      role: 'OWNER',
    });
    expect(service.assignResponsible).toHaveBeenCalledWith('c1', {
      userId: 'u2',
      role: 'OWNER',
    });
  });
});

describe('CommunityProposalsController', () => {
  let controller: CommunityProposalsController;
  const proposalsService = {
    create: mockFn(),
    listForAdmin: mockFn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CommunityProposalsController],
      providers: [
        { provide: CommunityProposalsService, useValue: proposalsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(
        mockAuthenticatedUser({
          userId: 'u1',
          sessionId: 's1',
          role: 'USER',
          status: 'ACTIVE',
        }),
      )
      .overrideGuard(ActiveAccountGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(CommunityProposalsController);
  });

  it('délègue create proposition', async () => {
    proposalsService.create.mockResolvedValue({ id: 'p1' });
    await controller.create(
      { userId: 'u1', sessionId: 's1', role: 'USER', status: 'ACTIVE' },
      { name: 'Deuil', rationale: 'Espace pour partager sans jugement.' },
    );
    expect(proposalsService.create).toHaveBeenCalledWith('u1', {
      name: 'Deuil',
      rationale: 'Espace pour partager sans jugement.',
    });
  });
});
