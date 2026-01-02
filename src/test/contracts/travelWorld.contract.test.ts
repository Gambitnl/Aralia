import { describe, it, expect, expectTypeOf } from 'vitest';
import { PACE_MODIFIERS } from '@/systems/travel/TravelCalculations';
import { AbilityScores, AbilityScoreName } from '@/types/character';
import { MarketEventType } from '@/types/economy';
import { TravelEvent } from '@/types/exploration';

describe('contract: travel and world helpers', () => {
  it('exports pace modifiers and ability score naming is capitalized', () => {
    expectTypeOf(PACE_MODIFIERS).toBeObject();

    const good: AbilityScoreName = 'Strength';
    expect(good).toBe('Strength');

    const bad: any = 'strength';
    expectTypeOf(bad).not.toMatchTypeOf<AbilityScoreName>();
  });

  it('TravelEvent carries effect/skillCheck shapes', () => {
    const event: TravelEvent = {
      id: 'contract-travel',
      description: 'Test',
      effect: { type: 'delay', amount: 1, description: 'one hour' },
      skillCheck: {
        check: { skill: 'athletics', dc: 10 },
        successEffect: { type: 'delay', amount: 0, description: 'none' },
        successDescription: 'ok',
        failureDescription: 'fail',
      },
    };
    expectTypeOf(event).toMatchTypeOf<TravelEvent>();
  });

  it('MarketEventType only accepts whitelisted values', () => {
    const market: MarketEventType = 'economic';
    expect(market).toBe('economic');
  });
});
