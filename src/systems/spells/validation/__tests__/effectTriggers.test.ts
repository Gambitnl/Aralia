/**
 * This file tests spell effect trigger validation.
 *
 * Spell JSON uses trigger names to tell the combat engine when an effect should
 * fire. These tests protect the bridge between spell data and runtime area
 * systems, especially zone triggers that are easy to support in code while
 * accidentally rejecting in validation.
 *
 * Called by: the Vitest spell validation test suite.
 * Depends on: SpellValidator for schema behavior and createMockSpell for a
 * complete, valid spell shell.
 */
import { describe, expect, it } from 'vitest';
import { createMockSpell } from '@/utils/factories';
import { SpellValidator } from '../spellValidator';

// ============================================================================
// Area Movement Trigger Validation
// ============================================================================
// This section protects the Spike Growth-style trigger path. The area effect
// runtime already knows how to process movement within a zone; validation must
// allow spell data to name that trigger instead of forcing prose fallback.
// ============================================================================

describe('SpellValidator effect triggers', () => {
  it('accepts on_move_in_area so zone movement effects can validate', () => {
    // Start from the shared spell factory so this test only changes the trigger
    // behavior under investigation. The rest of the spell remains a normal
    // mechanically valid mock spell.
    const spell = createMockSpell({
      id: 'test-on-move-in-area',
      name: 'Test On Move In Area',
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'on_move_in_area', frequency: 'every_time' },
          condition: { type: 'always' },
          description: 'Damage when a creature moves through the area.',
          damage: { dice: '1d4', type: 'piercing' },
        },
      ],
    });

    // The validator should accept the trigger name because AreaEffectTracker
    // already processes it at runtime.
    const result = SpellValidator.safeParse(spell);

    expect(result.success).toBe(true);
  });
});
