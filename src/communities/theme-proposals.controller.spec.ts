import { Test } from '@nestjs/testing';
import {
  CommunityThemeProposalsController,
  ThemeProposalsController,
} from './theme-proposals.controller.js';
import { ThemeProposalsService } from './theme-proposals.service.js';
import { mockFn } from '../test/mocks/jest-fn.js';
import { allowAllGuard } from '../test/mocks/guards.mock.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActiveAccountGuard } from '../common/guards/active-account.guard.js';

describe('CommunityThemeProposalsController', () => {
  const themeProposals = {
    create: mockFn(),
    listForCommunity: mockFn(),
    decide: mockFn(),
  };

  let controller: CommunityThemeProposalsController;

  beforeEach(async () => {
    themeProposals.create.mockReset();
    themeProposals.listForCommunity.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [CommunityThemeProposalsController],
      providers: [{ provide: ThemeProposalsService, useValue: themeProposals }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(ActiveAccountGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = moduleRef.get(CommunityThemeProposalsController);
  });

  it('délègue create au service', async () => {
    themeProposals.create.mockResolvedValue({ id: 'p1' });
    const result = await controller.create(
      { userId: 'u1' } as never,
      'com-1',
      { label: 'Fatigue', rationale: 'Beaucoup de messages sur ce sujet.' },
    );
    expect(themeProposals.create).toHaveBeenCalledWith('u1', 'com-1', {
      label: 'Fatigue',
      rationale: 'Beaucoup de messages sur ce sujet.',
    });
    expect(result).toEqual({ id: 'p1' });
  });
});

describe('ThemeProposalsController', () => {
  const themeProposals = {
    decide: mockFn(),
  };

  let controller: ThemeProposalsController;

  beforeEach(async () => {
    themeProposals.decide.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [ThemeProposalsController],
      providers: [{ provide: ThemeProposalsService, useValue: themeProposals }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(ActiveAccountGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = moduleRef.get(ThemeProposalsController);
  });

  it('délègue decide au service', async () => {
    themeProposals.decide.mockResolvedValue({ id: 'p1', status: 'ACCEPTED' });
    const result = await controller.decide(
      { userId: 'mod-1' } as never,
      'p1',
      { decision: 'ACCEPTED' },
    );
    expect(themeProposals.decide).toHaveBeenCalledWith('mod-1', 'p1', {
      decision: 'ACCEPTED',
    });
    expect(result).toEqual({ id: 'p1', status: 'ACCEPTED' });
  });
});
