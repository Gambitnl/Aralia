import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import shieldData from '@/data/spells/level-1/shield.json';
import ShieldScenario, { executeShieldScenario } from '../shieldScenario';
import { SPELL_SCENARIO_REGISTRY } from '../spellRegistry';
import type { Spell } from '@/types/spells';

/**
 * This file proves the Shield starter through the production reaction
 * arbitration and defensive command path.
 *
 * The focused cases cover cancellation/payment, decline/no-payment, Reset,
 * registry availability, and the precise Magic Missile boundary left by the
 * current factory contract. They deliberately avoid mocking Math.random or
 * asserting a UI-only AC calculation.
 *
 * Called by: the focused Spells Vitest suite.
 * Depends on: shieldScenario.tsx, spellRegistry.ts, and canonical Shield JSON.
 */

// ============================================================================
// Registry Wiring
// ============================================================================
// Shield must join the executable cumulative starter set without changing the
// identities or availability of Fire Bolt, Thunderwave, or Cure Wounds.
// ============================================================================

describe('Shield registry wiring', () => {
  it('registers Shield as an available executable starter', () => {
    const shieldEntry = SPELL_SCENARIO_REGISTRY.find(spell => spell.id === 'shield');

    expect(shieldEntry).toMatchObject({
      id: 'shield',
      name: 'Shield',
      availability: 'available',
      kind: 'reaction-defense',
      scenarioComponent: ShieldScenario,
    });
    expect(SPELL_SCENARIO_REGISTRY.map(spell => spell.availability)).toEqual([
      'available',
      'available',
      'available',
      'available',
    ]);
  });
});

// ============================================================================
// Returned Production Outcomes
// ============================================================================
// Both controls use the same fixed d20 12 against base AC 12. Only the
// reaction answer changes, so the assertions expose the actual arbitration and
// resource differences rather than comparing two unrelated fixtures.
// ============================================================================

describe('Shield production reaction outcomes', () => {
  it('cancels the initial hit, pays the reaction and slot, and records the effect', async () => {
    const result = await executeShieldScenario('choose-shield');

    // The attack initially hits at AC 12, then the production reaction raises
    // the returned target AC to 17 before the damage command can apply damage.
    expect(result.rawRoll).toBe(12);
    expect(result.modifier).toBe(0);
    expect(result.attackTotal).toBe(12);
    expect(result.initialHit).toBe(true);
    expect(result.finalHit).toBe(false);
    expect(result.initialAC).toBe(12);
    expect(result.finalAC).toBe(17);
    expect(result.targetHpBefore).toBe(20);
    expect(result.targetHpAfter).toBe(20);

    // Payment comes from consumeActionCost inside AbilityCommandFactory, not
    // from the scenario adapter.
    expect(result.reactionBefore).toBe(false);
    expect(result.reactionAfter).toBe(true);
    expect(result.slotBefore).toBe(1);
    expect(result.slotAfter).toBe(0);
    expect(result.activeEffectDuration).toMatch(/start of the next turn/);
    expect(result.receipt.join('\n')).toMatch(/DefensiveCommand \/ AbilityCommandFactory/);
    expect(result.receipt.join('\n')).toMatch(/Damage is outside this arbitration receipt/);
  });

  it('preserves the hit and resources when Shield is declined', async () => {
    const result = await executeShieldScenario('decline-shield');

    // Declining returns the original hit path, so DamageCommand applies the
    // authored four slashing damage and no defensive effect is recorded.
    expect(result.initialHit).toBe(true);
    expect(result.finalHit).toBe(true);
    expect(result.finalAC).toBe(12);
    expect(result.targetHpBefore).toBe(20);
    expect(result.targetHpAfter).toBe(16);
    expect(result.reactionBefore).toBe(false);
    expect(result.reactionAfter).toBe(false);
    expect(result.slotBefore).toBe(1);
    expect(result.slotAfter).toBe(1);
    expect(result.activeEffectDuration).toBe('not applied');
    expect(result.receipt.join('\n')).toMatch(/DamageCommand applied the attack damage/);
  });
});

// ============================================================================
// Reset And Magic Missile Boundary
// ============================================================================
// Reset must clear the returned transaction instead of manufacturing an inverse
// resource change. Magic Missile is checked as canonical data plus an honest
// boundary statement because the current arbitration does not expose it.
// ============================================================================

describe('Shield preview boundaries', () => {
  it('resets the rendered receipt to the exact baseline', async () => {
    const shieldEntry = SPELL_SCENARIO_REGISTRY.find(spell => spell.id === 'shield');
    expect(shieldEntry?.scenarioComponent).toBeDefined();

    render(<ShieldScenario spell={shieldEntry!} />);
    fireEvent.click(screen.getByRole('button', { name: /Choose Shield/i }));
    await waitFor(() => expect(screen.getByTestId('shield-hit-result')).toHaveTextContent('Final hit: MISS'));

    // Reset removes the transaction snapshot. The baseline does not claim a
    // resource payment or a hit result before a control is executed.
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));
    expect(screen.getByTestId('shield-roll')).toHaveTextContent('not cast');
    expect(screen.getByTestId('shield-payment')).toHaveTextContent('false -> not cast');
    expect(screen.getByTestId('shield-hp')).toHaveTextContent('20 -> not cast');
  });

  it('keeps Magic Missile as a precise unproven boundary', () => {
    const shield = shieldData as Spell;
    const magicMissileRow = shield.effects.find(effect =>
      effect.type === 'DEFENSIVE' &&
      effect.defenseType === 'immunity' &&
      effect.reactionTrigger?.event === 'when_targeted' &&
      effect.reactionTrigger.includesSpells?.includes('magic-missile'),
    );

    // The data and DefensiveCommand force-immunity seam exist, but this leaf
    // does not imply that the attack arbitration currently executes that row.
    expect(magicMissileRow).toBeDefined();
    expect(magicMissileRow?.damageType).toContain('force');
    expect(magicMissileRow?.reactionTrigger?.event).toBe('when_targeted');
    expect(screen.queryByTestId('shield-magic-missile-boundary')).not.toBeInTheDocument();

    render(<ShieldScenario spell={SPELL_SCENARIO_REGISTRY[3]} />);
    expect(screen.getByTestId('shield-magic-missile-boundary')).toHaveTextContent(/does not claim Magic Missile execution/i);
  });
});
