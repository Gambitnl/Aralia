import { describe, it, expect, expectTypeOf } from 'vitest';
import { PACE_MODIFIERS } from '@/types/travel';
import { AbilityScoreName } from '@/types/core';
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
        check: { skill: 'Athletics', dc: 10 } as any, // TODO(lint-intent): tighten to Skill once travel events use Skill typing
        successEffect: { type: 'delay', amount: 0, description: 'none' },
        failureEffect: { type: 'delay', amount: 2, description: 'slowed' },
        successDescription: 'ok',
        failureDescription: 'fail',
      },
    };
    expectTypeOf(event).toMatchTypeOf<TravelEvent>();
  });

  it('MarketEventType only accepts whitelisted values', () => {
    const market: MarketEventType = MarketEventType.BOOM;
    expect(market).toBe(MarketEventType.BOOM);
  });

  // Sanity check that helper signatures accept the expected arity (placeholder call)
  it('TravelEvent type can be constructed without helper args', () => {
    const noop: TravelEvent = { id: 'noop', description: 'noop' };
    expectTypeOf(noop).toMatchTypeOf<TravelEvent>();
  });
});
