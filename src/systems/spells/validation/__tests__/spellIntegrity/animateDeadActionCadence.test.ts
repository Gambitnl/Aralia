import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator, normalizeGrantedAction } from '../../SpellIntegrityValidator';
import animateDead from '@/data/spells/level-3/animate-dead.json';
import { Spell } from '../../../../../types/spells';

/**
 * This file pins the Animate Dead granted-action cadence to the real spell file.
 *
 * What it proves: the 'Mentally Command Animated Undead' row carries a machine
 * readable cadence, not prose only. Before Agora task agora-db71.4 the row gave
 * its cadence in the description text ("On each of the caster's turns"), so
 * Rule 5 of SpellIntegrityValidator reported the last Action Cost failure in the
 * corpus.
 *
 * Why a data-pinned test: the systematic scan keeps an empty expectation array,
 * which tells you that some spell broke but not which field. This test names the
 * field and the canonical value, so a regression reads as one clear failure.
 *
 * What was preserved: the row keeps its legacy actionType/name/rangeFeet
 * spelling. normalizeGrantedAction resolves the legacy and the modern spelling
 * onto one shape, so only the missing cadence field was added.
 */

describe('Animate Dead granted-action cadence', () => {
  const spell = animateDead as unknown as Spell;

  it('gives the mental-command row a canonical frequency', () => {
    const commandEffect = spell.effects[1] as unknown as {
      grantedActions?: Array<Record<string, unknown>>;
    };
    const commandAction = commandEffect.grantedActions?.[0];

    expect(commandAction).toBeDefined();
    expect(commandAction?.name).toBe('Mentally Command Animated Undead');

    // 'each_turn' is the cadence spelling that the sibling spell create-undead
    // uses for the same mental-command mechanic. Keeping one spelling lets the
    // action economy read both spells through the same path.
    expect(commandAction?.frequency).toBe('each_turn');
  });

  it('normalizes the legacy row onto a bonus action with a cadence and a range cap', () => {
    const commandEffect = spell.effects[1] as unknown as {
      grantedActions?: Array<Record<string, unknown>>;
    };
    const normalized = normalizeGrantedAction(
      commandEffect.grantedActions![0] as Parameters<typeof normalizeGrantedAction>[0]
    );

    expect(normalized.canonicalCost).toBe('bonus_action');
    expect(normalized.label).toBe('Mentally Command Animated Undead');
    expect(normalized.cadence).toBe('each_turn');
    expect(normalized.rangeCap).toBe(60);
  });

  it('reports no action-cost errors for the real spell record', () => {
    const actionCostErrors = SpellIntegrityValidator.validate(spell)
      .filter(error => error.includes('Action Cost'));

    expect(actionCostErrors).toEqual([]);
  });
});
