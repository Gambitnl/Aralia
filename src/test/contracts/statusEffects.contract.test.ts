import { describe, it, expectTypeOf } from 'vitest';
import { StatusEffect, ActiveEffect, ActiveCondition } from '@/types/combat';
import { EffectDuration } from '@/types/spells';

describe('contract: status effects', () => {
  it('StatusEffect carries name/type/duration and optional mechanics', () => {
    const status: StatusEffect = {
      id: 'st1',
      name: 'Poisoned',
      type: 'debuff',
      duration: 1,
      effect: { type: 'damage_per_turn', value: 1 },
    };
    expectTypeOf(status).toMatchTypeOf<StatusEffect>();
  });

  it('ActiveEffect tracks caster/source/duration', () => {
    const duration: EffectDuration = { type: 'rounds', value: 1 };
    const active: ActiveEffect = {
      id: 'ae1',
      spellId: 'spell1',
      casterId: 'caster1',
      sourceName: 'Test Spell',
      type: 'buff',
      duration,
      startTime: 0,
    };
    expectTypeOf(active).toMatchTypeOf<ActiveEffect>();
  });

  it('ActiveCondition has appliedTurn/source guards', () => {
    const condition: ActiveCondition = {
      name: 'Prone',
      duration: { type: 'permanent' },
      appliedTurn: 0,
      source: 'trip attack',
    };
    expectTypeOf(condition).toMatchTypeOf<ActiveCondition>();
  });
});
