import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  BEASTBORN_HUMAN_PRIMAL_CONNECTION_SPELL_CONTROL_ID,
  BEASTBORN_HUMAN_PRIMAL_CONNECTION_TARGET_CONTROL_ID,
  BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID,
  BeastbornHumanRaceLeaf,
  createBeastbornHumanPrimalScenario,
  getCanonicalBeastbornHumanPrimalGrants,
  getCanonicalBeastbornHumanTrait,
  hasCanonicalBeastbornHumanPrimalConnection,
  isBeastbornHumanPrimalTargetLegal,
  resolveBeastbornHumanPrimalConnection,
  RACE_DOMAIN_LEAF,
} from '../beastbornHumanRaceLeaf';
import type { BeastbornHumanPrimalTarget } from '../beastbornHumanRaceLeaf';

/**
 * This file proves that the Beastborn Human leaf remains linked to the active
 * canonical race and that its Primal Connection boundary uses production
 * assembly plus native action/resource payment.
 *
 * It intentionally does not claim rendered 2D/3D proof or a spell-effect
 * result. Those belong to the parent mounted Race-domain verification lane.
 * Called by: focused and cumulative Vitest Race-domain checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical racial trait parsing,
 * production quick-character assembly, and native action-cost helpers.
 */

// ============================================================================
// Canonical Registration And Discovery
// ============================================================================
// These checks protect the stable leaf contract and prevent a copied trait
// paragraph from drifting away from ACTIVE_RACES or the trait library.
// ============================================================================

describe('Beastborn Human Race domain leaf', () => {
  const beastbornHuman = ACTIVE_RACES.find(race => race.id === 'beastborn_human')!;

  it('exports one discoverable registration for the canonical race', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('beastborn_human');

    expect(RACE_DOMAIN_LEAF.id).toBe('beastborn-human-primal-connection');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(beastbornHuman.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(BeastbornHumanRaceLeaf);
    expect(leaves).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links canonical Primal Connection and level-three target facts', () => {
    const primalTrait = getCanonicalBeastbornHumanTrait(beastbornHuman, /^Primal Connection:/i);
    const biggerTrait = getCanonicalBeastbornHumanTrait(beastbornHuman, /^The Bigger They Are:/i);
    const grants = getCanonicalBeastbornHumanPrimalGrants(beastbornHuman);

    expect(hasCanonicalBeastbornHumanPrimalConnection(beastbornHuman)).toBe(true);
    expect(primalTrait).toContain('Animal Friendship');
    expect(primalTrait).toContain('Speak with Animals');
    expect(biggerTrait).toContain('3rd level');
    expect(grants).toEqual(expect.arrayContaining([
      expect.objectContaining({ spellId: 'animal-friendship', castingMethod: 'at_will' }),
      expect.objectContaining({ spellId: 'speak-with-animals', castingMethod: 'at_will' }),
    ]));
  });

  // ========================================================================
  // Native Transaction And Atomic Boundary Proof
  // ========================================================================
  // Successful payment consumes only the selected spell's racial resource and
  // the action. Every invalid target or unavailable action is unchanged.
  // ========================================================================

  it('assembles a level-three actor with the production shared short-rest resource', () => {
    const baseline = createBeastbornHumanPrimalScenario(beastbornHuman);
    expect(baseline.actor).toMatchObject({
      id: 'beastborn-human-primal-connection-actor',
      class: { id: 'wizard' },
      level: 3,
      spellbook: {
        racialSpellGrants: expect.arrayContaining([
          expect.objectContaining({ spellId: 'animal-friendship', castingMethod: 'at_will' }),
          expect.objectContaining({ spellId: 'speak-with-animals', castingMethod: 'at_will' }),
        ]),
      },
    });
    expect(baseline.actor?.limitedUses?.[BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID]).toMatchObject({
      current: 1,
      max: 1,
      resetOn: 'short_rest',
    });
  });

  it('commits the native cast-cost transaction and consumes only the selected spell resource', () => {
    const baseline = createBeastbornHumanPrimalScenario(beastbornHuman);
    const resolved = resolveBeastbornHumanPrimalConnection(
      baseline,
      beastbornHuman,
      'animal-friendship',
      'beast-low-intelligence',
    );

    expect(resolved.lastResolution?.status).toBe('committed');
    expect(resolved.lastResolution?.reason).toBe('committed');
    expect(resolved.actor?.actionEconomy.action.used).toBe(true);
    expect(resolved.actor?.limitedUses?.[BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID]?.current).toBe(0);
    expect(resolved.outcome).toContain('Native cast-cost transaction committed');
    expect(resolved.outcome).toContain('short_rest');
    expect(resolved.outcome).toContain('Spell effect result is not claimed');
  });

  it('keeps target comparison and level-three expansion deterministic', () => {
    const beast: BeastbornHumanPrimalTarget = { id: 'beast-low-intelligence', label: 'Beast', creatureType: 'Beast', intelligence: 2 };
    const highIntBeast = { ...beast, id: 'beast-high-intelligence' as const, intelligence: 4 };
    const monstrosity = { ...beast, id: 'monstrosity-low-intelligence' as const, creatureType: 'Monstrosity' as const };
    const humanoid = { ...beast, id: 'humanoid-low-intelligence' as const, creatureType: 'Humanoid' as const };

    expect(isBeastbornHumanPrimalTargetLegal('animal-friendship', beast, 1)).toBe(true);
    expect(isBeastbornHumanPrimalTargetLegal('animal-friendship', highIntBeast, 3)).toBe(false);
    expect(isBeastbornHumanPrimalTargetLegal('animal-friendship', monstrosity, 2)).toBe(false);
    expect(isBeastbornHumanPrimalTargetLegal('animal-friendship', monstrosity, 3)).toBe(true);
    expect(isBeastbornHumanPrimalTargetLegal('animal-friendship', humanoid, 3)).toBe(false);
    expect(isBeastbornHumanPrimalTargetLegal('speak-with-animals', { ...beast, id: 'self', creatureType: 'self', intelligence: null }, 3)).toBe(true);
  });

  it('rejects invalid targets and a second action atomically', () => {
    const baseline = createBeastbornHumanPrimalScenario(beastbornHuman);
    const invalid = resolveBeastbornHumanPrimalConnection(
      baseline,
      beastbornHuman,
      'animal-friendship',
      'monstrosity-high-intelligence',
    );
    expect(invalid.lastResolution?.reason).toBe('invalid_target');
    expect(invalid.actor).toBe(baseline.actor);

    const committed = resolveBeastbornHumanPrimalConnection(
      baseline,
      beastbornHuman,
      'animal-friendship',
      'beast-low-intelligence',
    );
    const second = resolveBeastbornHumanPrimalConnection(
      committed,
      beastbornHuman,
      'speak-with-animals',
      'self',
    );
    expect(second.lastResolution?.reason).toBe('resource_unavailable');
    expect(second.actor).toBe(committed.actor);
    expect(second.actor?.limitedUses?.[BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID]?.current).toBe(0);
  });

  // ========================================================================
  // Visible Event, Reset, And Unsupported Boundary Proof
  // ========================================================================
  // The component must publish the native result and restore baseline state
  // when resetCount changes, while naming the missing mounted effect surface.
  // ========================================================================

  it('shows canonical actor/spell/resource facts, logs the result, resets, and states the boundary', () => {
    const events: string[] = [];
    const { rerender } = render(
      <BeastbornHumanRaceLeaf
        race={beastbornHuman}
        state={createRaceDomainScenarioState(beastbornHuman.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('beastborn-human-canonical-traits')).toHaveTextContent('Animal Friendship');
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Level 3');
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Selected resource 1/1 (short_rest)');
    expect(screen.getByTestId('beastborn-human-spell-facts')).toHaveTextContent('animal-friendship at_will');
    expect(screen.getByTestId('beastborn-human-target-facts')).toHaveTextContent('expansion active');

    fireEvent.click(screen.getByRole('button', { name: /resolve primal connection cast cost/i }));
    expect(screen.getByTestId('beastborn-human-outcome')).toHaveTextContent('Native cast-cost transaction committed');
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Action used');
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Selected resource 0/1');
    expect(events.at(-1)).toContain('Beastborn Human PRIMAL CONNECTION COMMITTED');

    fireEvent.change(screen.getByLabelText('Primal Connection spell'), { target: { value: 'speak-with-animals' } });
    fireEvent.change(screen.getByLabelText('Target boundary'), { target: { value: 'self' } });
    fireEvent.click(screen.getByRole('button', { name: /resolve primal connection cast cost/i }));
    expect(screen.getByTestId('beastborn-human-outcome')).toHaveTextContent('resource is empty');

    rerender(
      <BeastbornHumanRaceLeaf
        race={beastbornHuman}
        state={createRaceDomainScenarioState(beastbornHuman.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('beastborn-human-actor')).toHaveTextContent('Selected resource 1/1');
    expect(screen.getByTestId('beastborn-human-assembly-boundary')).toHaveTextContent('applyRacialSpellGrantsByLevel');
    expect(screen.getByTestId('beastborn-human-unsupported-boundary')).toHaveTextContent('one shared feature resource and at-will grants');
  });

  it('keeps the deterministic control IDs stable for mounted proof', () => {
    render(
      <BeastbornHumanRaceLeaf
        race={beastbornHuman}
        state={createRaceDomainScenarioState(beastbornHuman.id)}
        onScenarioEvent={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Primal Connection spell')).toHaveAttribute('id', BEASTBORN_HUMAN_PRIMAL_CONNECTION_SPELL_CONTROL_ID);
    expect(screen.getByLabelText('Target boundary')).toHaveAttribute('id', BEASTBORN_HUMAN_PRIMAL_CONNECTION_TARGET_CONTROL_ID);
  });
});
