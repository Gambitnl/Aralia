import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { createRaceDomainRegistry, discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  FALLEN_AASIMAR_ACTOR_ID,
  FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID,
  FALLEN_AASIMAR_RAW_DAMAGE,
  FallenAasimarRaceLeaf,
  RACE_DOMAIN_LEAF,
  createFallenAasimarActors,
  createFallenAasimarScenario,
  getCanonicalFallenAasimarHealingHandsTrait,
  getCanonicalFallenAasimarResistanceTrait,
  getCanonicalFallenAasimarDamageResistances,
  hasCanonicalFallenAasimarFeatures,
  resolveFallenAasimarHealing,
} from '../fallenAasimarRaceLeaf';
import { calculateDamage } from '../../../../../../utils/combat/combatUtils';

/**
 * This file proves Fallen Aasimar identity/discovery, production actor and
 * resource assembly, deterministic native Healing Hands, HP capping, Action
 * payment, atomic exhaustion rejection, parent Reset remounting, visible log
 * output, native resistance math, and explicit unsupported boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Fallen Aasimar data,
 * and the leaf's production-backed transaction helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking panel from drifting away from the
// active canonical race or automatic import.meta.glob discovery.
// ============================================================================

describe('Fallen Aasimar Race domain leaf', () => {
  const fallenAasimar = ACTIVE_RACES.find(race => race.id === 'fallen_aasimar')!;

  it('links identity and surfaced facts to canonical data', () => {
    expect(fallenAasimar).toBeDefined();
    expect(RACE_DOMAIN_LEAF.id).toBe('fallen-aasimar-healing-hands');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(fallenAasimar.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Fallen Aasimar');
    expect(RACE_DOMAIN_LEAF.Component).toBe(FallenAasimarRaceLeaf);
    expect(hasCanonicalFallenAasimarFeatures(fallenAasimar)).toBe(true);
    expect(getCanonicalFallenAasimarHealingHandsTrait(fallenAasimar)).toContain('d4s equal to your Proficiency Bonus');
    expect(getCanonicalFallenAasimarResistanceTrait(fallenAasimar)).toContain('necrotic');
  });

  it('is discovered for fallen_aasimar by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('fallen_aasimar')).toContainEqual(RACE_DOMAIN_LEAF);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Production Assembly And Native Resistance
  // ========================================================================
  // The actor must carry the parser-created resource and defenses before the
  // local transaction adapter is allowed to act.
  // ========================================================================

  it('assembles production source/target actors with the parser resource and resistance', () => {
    const assembly = createFallenAasimarActors(fallenAasimar);

    expect(assembly.actor?.id).toBe(FALLEN_AASIMAR_ACTOR_ID);
    expect(assembly.actor?.level).toBe(5);
    expect(assembly.actor?.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]).toMatchObject({
      current: 1,
      max: 1,
      resetOn: 'long_rest',
    });
    expect(assembly.actor?.resistances?.map(type => type.toLowerCase())).toContain('necrotic');
    expect(getCanonicalFallenAasimarDamageResistances(fallenAasimar)).toEqual(['necrotic', 'radiant']);
    expect(assembly.target?.currentHP).toBe((assembly.target?.maxHP ?? 0) - 2);
  });

  it('resolves the canonical resistance packet through native damage math', () => {
    const scenario = createFallenAasimarScenario(fallenAasimar);
    const actor = scenario.assembly.actor;
    if (!actor) throw new Error('Expected production Fallen Aasimar actor.');

    // The leaf uses the same calculateDamage path as combat. The odd packet
    // proves the standard floor behavior rather than a copied half-damage label.
    expect(calculateDamage(FALLEN_AASIMAR_RAW_DAMAGE, null, actor, 'necrotic')).toBe(7);
  });

  // ========================================================================
  // Deterministic Healing Hands And Atomic Rejection
  // ========================================================================
  // A pinned high face makes raw 3d4 healing and the two-point HP cap visible.
  // The second call reads the returned depleted state and cannot partially pay.
  // ========================================================================

  it('rolls PB d4s, caps healing, pays Action/resource, and rejects the second use atomically', () => {
    const baseline = createFallenAasimarScenario(fallenAasimar);
    const first = resolveFallenAasimarHealing(baseline, fallenAasimar, () => 0.999);
    const second = resolveFallenAasimarHealing(first, fallenAasimar, () => 0.999);

    expect(first.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'resolved',
      d4Faces: [4, 4, 4],
      rawHealing: 12,
      actualHealing: 2,
      beforeHP: (baseline.assembly.target?.maxHP ?? 0) - 2,
      afterHP: baseline.assembly.target?.maxHP,
      actionRemaining: 0,
      resourceRemaining: 0,
    });
    expect(first.assembly.actor?.actionEconomy.action.used).toBe(true);
    expect(first.assembly.actor?.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]?.current).toBe(0);
    expect(second.lastResolution).toMatchObject({
      status: 'rejected',
      reason: 'resource_exhausted',
      d4Faces: [],
      rawHealing: 0,
      actualHealing: 0,
      beforeHP: baseline.assembly.target?.maxHP,
      afterHP: baseline.assembly.target?.maxHP,
    });
    expect(second.assembly.actor).toBe(first.assembly.actor);
    expect(second.assembly.target).toBe(first.assembly.target);
    expect(baseline.assembly.target?.currentHP).toBe((baseline.assembly.target?.maxHP ?? 0) - 2);
  });

  // ========================================================================
  // Visible Result, Reset, Log, And Boundary Proof
  // ========================================================================
  // The mounted check proves the event callback and keyed parent-reset seam;
  // it deliberately makes no 2D/3D rendered claim.
  // ========================================================================

  it('shows raw/capped HP, Action/resource state, logs the transaction, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FallenAasimarRaceLeaf
        race={fallenAasimar}
        state={createRaceDomainScenarioState(fallenAasimar.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fallen-aasimar-actor')).toHaveTextContent('Action remaining 1');
    expect(screen.getByTestId('fallen-aasimar-actor')).toHaveTextContent('resource 1 / 1');
    expect(screen.getByTestId('fallen-aasimar-resistance-facts')).toHaveTextContent('15 → 7');
    expect(screen.getByTestId('fallen-aasimar-canonical-facts')).toHaveTextContent('No spell is cast');

    fireEvent.click(screen.getByRole('button', { name: /use healing hands/i }));
    expect(screen.getByTestId('fallen-aasimar-healing-result')).toHaveTextContent('raw 12');
    expect(screen.getByTestId('fallen-aasimar-healing-result')).toHaveTextContent('actual/capped 2');
    expect(screen.getByTestId('fallen-aasimar-healing-result')).toHaveTextContent('Action remaining 0');
    expect(screen.getByTestId('fallen-aasimar-healing-result')).toHaveTextContent('resource remaining 0');
    expect(events.at(-1)).toContain('Fallen Aasimar HEALING HANDS RESOLVED');

    fireEvent.click(screen.getByRole('button', { name: /use healing hands/i }));
    expect(screen.getByTestId('fallen-aasimar-outcome')).toHaveTextContent('rejected atomically');
    expect(events.at(-1)).toContain('Fallen Aasimar HEALING HANDS REJECTED');

    rerender(
      <FallenAasimarRaceLeaf
        race={fallenAasimar}
        state={createRaceDomainScenarioState(fallenAasimar.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fallen-aasimar-actor')).toHaveTextContent('Action remaining 1');
    expect(screen.getByTestId('fallen-aasimar-actor')).toHaveTextContent('resource 1 / 1');
    expect(screen.getByTestId('fallen-aasimar-healing-result')).toHaveTextContent('No Healing Hands transaction resolved yet');
    expect(screen.getByTestId('fallen-aasimar-boundary')).toHaveTextContent('fear saves');
    expect(screen.getByTestId('fallen-aasimar-boundary')).toHaveTextContent('once-per-turn necrotic rider');
    expect(screen.getByTestId('fallen-aasimar-boundary')).toHaveTextContent('Darkvision sensing');
    expect(screen.getByTestId('fallen-aasimar-boundary')).toHaveTextContent('Light spell casting');
  });
});
