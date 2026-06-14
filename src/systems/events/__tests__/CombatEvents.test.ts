import { describe, expect, it } from 'vitest';
import { CombatEventEmitter } from '../CombatEvents';

/**
 * This file protects the combat event bus, which is the shared runtime trace
 * for movement, casting, attacks, and area events.
 *
 * The Spell Phase work uses this bus as the safest bridge between systems that
 * know attack-roll outcomes and systems that need hit/miss facts later, such
 * as Armor of Agathys-style reactive effects. These tests keep that bridge
 * structured instead of forcing consumers to parse combat-log prose.
 */

describe('CombatEventEmitter attack-result bridge', () => {
  it('extracts attackResults from unit_attack events emitted after a snapshot', () => {
    const emitter = new CombatEventEmitter();

    // Capture the event sequence before a command-style attack starts. A
    // consumer can later ask for only the attack facts produced after this
    // point, avoiding older attacks from previous turns or prior commands.
    const beforeAttack = emitter.createReplaySnapshot();

    emitter.emit({
      type: 'unit_cast',
      casterId: 'attacker',
      spellId: 'slash',
      targets: ['target-a']
    });
    emitter.emit({
      type: 'unit_attack',
      attackerId: 'attacker',
      targetId: 'target-a',
      isHit: false,
      isCrit: false,
      attackType: 'weapon',
      weaponType: 'melee'
    });
    emitter.emit({
      type: 'unit_attack',
      attackerId: 'other-attacker',
      targetId: 'target-b',
      isHit: true,
      isCrit: true
    });

    expect(emitter.getAttackResultsSince(beforeAttack.nextSequence, {
      attackerId: 'attacker',
      targetIds: ['target-a', 'target-b']
    })).toEqual([{
      targetId: 'target-a',
      isHit: false,
      isCritical: false,
      attackType: 'weapon',
      weaponType: 'melee'
    }]);
  });
});
