import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  HALF_ORC_ENDURANCE_RESOURCE_ID,
  HALF_ORC_TARGET_HP,
  ORC_REDUCER_ENDURANCE_RESOURCE_ID,
  HalfOrcRaceLeaf,
  createHalfOrcScenario,
  getCanonicalHalfOrcDarkvisionRangeFeet,
  getCanonicalHalfOrcRelentlessEnduranceTrait,
  getCanonicalHalfOrcSavageAttacksTrait,
  getCanonicalHalfOrcVisionTrait,
  getHalfOrcSavageAttacksParserTrait,
  hasCanonicalHalfOrcFeatures,
  hasHalfOrcSavageAttacksParserProjection,
  resolveHalfOrcDamage,
  RACE_DOMAIN_LEAF,
} from '../halfOrcRaceLeaf';

/**
 * This file proves the Half-Orc leaf stays linked to ACTIVE_RACES and the
 * canonical racial parser, then exercises native DamageCommand comparisons.
 * It also proves the visible event/reset surface and the exact Relentless
 * Endurance reducer gap without fabricating an HP rescue.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, automatic leaf discovery, production character
 * assembly, DamageCommand, and the Half-Orc leaf's exported proof seams.
 */

// ============================================================================
// Canonical Identity And Parser Linkage
// ============================================================================
// These assertions keep the leaf tied to the active roster and ensure the
// modifier/resource observations come from production parsing rather than a
// duplicate fixture truth.
// ============================================================================

const halfOrc = ACTIVE_RACES.find(race => race.id === 'half_orc');

describe('Half-Orc Race leaf', () => {
  it('exports one automatic registration for the canonical ACTIVE_RACES id', () => {
    expect(halfOrc).toBeDefined();
    expect(RACE_DOMAIN_LEAF.raceId).toBe('half_orc');
    expect(RACE_DOMAIN_LEAF.Component).toBe(HalfOrcRaceLeaf);

    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('half_orc')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('links canonical facts to the parser Savage Attacks modifier and exposes the endurance key mismatch', () => {
    expect(halfOrc).toBeDefined();
    expect(hasCanonicalHalfOrcFeatures(halfOrc!)).toBe(true);
    expect(getCanonicalHalfOrcDarkvisionRangeFeet(halfOrc!)).toBe(60);
    expect(getCanonicalHalfOrcVisionTrait(halfOrc!)).toMatch(/within 60 feet/i);
    expect(getCanonicalHalfOrcRelentlessEnduranceTrait(halfOrc!)).toMatch(/reduced to 0 hit points/i);
    expect(getCanonicalHalfOrcSavageAttacksTrait(halfOrc!)).toMatch(/critical hit with a melee weapon attack/i);
    expect(getHalfOrcSavageAttacksParserTrait(halfOrc!)).not.toBeNull();

    const scenario = createHalfOrcScenario(halfOrc!);
    expect(hasHalfOrcSavageAttacksParserProjection(scenario.parserCharacter)).toBe(true);
    expect(scenario.parserCharacter?.limitedUses?.[HALF_ORC_ENDURANCE_RESOURCE_ID]).toBeDefined();
    expect(scenario.parserCharacter?.limitedUses?.[ORC_REDUCER_ENDURANCE_RESOURCE_ID]).toBeUndefined();
  });
});

// ============================================================================
// Native DamageCommand Comparisons
// ============================================================================
// All three branches start from the same assembled actor/target baseline and
// pin every d6 to 1. This makes the critical doubling and one extra weapon die
// exact while leaving DamageCommand responsible for the actual transaction.
// ============================================================================

describe('Half-Orc Savage Attacks native damage transaction', () => {
  it('adds one extra weapon damage die on a melee critical and logs the HP result', async () => {
    const scenario = createHalfOrcScenario(halfOrc!);
    const resolved = await resolveHalfOrcDamage(scenario, 'melee-critical');
    const result = resolved.results['melee-critical'];

    expect(result?.status).toBe('resolved');
    expect(result?.damage).toBe(3);
    expect(result?.savageAttacksExtraDamage).toBe(1);
    expect(result?.targetHpBefore).toBe(HALF_ORC_TARGET_HP);
    expect(result?.targetHpAfter).toBe(27);
    expect(result?.savageAttacksLog).toContain('Savage Attacks adds +1 (1d6)');
    expect(result?.damageLog).toMatch(/for 3 slashing damage/i);
  });

  it('does not add Savage Attacks to an otherwise identical normal melee hit', async () => {
    const scenario = createHalfOrcScenario(halfOrc!);
    const resolved = await resolveHalfOrcDamage(scenario, 'melee-normal');
    const result = resolved.results['melee-normal'];

    expect(result?.status).toBe('resolved');
    expect(result?.damage).toBe(1);
    expect(result?.savageAttacksExtraDamage).toBe(0);
    expect(result?.targetHpBefore).toBe(HALF_ORC_TARGET_HP);
    expect(result?.targetHpAfter).toBe(29);
    expect(result?.savageAttacksLog).toBeNull();
    expect(result?.damageLog).toMatch(/for 1 slashing damage/i);
  });

  it('does not add Savage Attacks to an otherwise identical ranged critical', async () => {
    const scenario = createHalfOrcScenario(halfOrc!);
    const resolved = await resolveHalfOrcDamage(scenario, 'ranged-critical');
    const result = resolved.results['ranged-critical'];

    expect(result?.status).toBe('resolved');
    expect(result?.damage).toBe(2);
    expect(result?.savageAttacksExtraDamage).toBe(0);
    expect(result?.targetHpBefore).toBe(HALF_ORC_TARGET_HP);
    expect(result?.targetHpAfter).toBe(28);
    expect(result?.savageAttacksLog).toBeNull();
    expect(result?.damageLog).toMatch(/for 2 slashing damage/i);
  });
});

// ============================================================================
// Visible Controls, Event Reporting, Reset, And Boundaries
// ============================================================================
// The rendered check proves the three deterministic controls expose their
// outputs, report the event, retain canonical facts, and reset through the
// parent resetCount key without claiming rendered 2D/3D proof.
// ============================================================================

describe('Half-Orc Race leaf visible proof', () => {
  it('shows facts and exact runtime boundaries, reports events, and resets results', async () => {
    const events: string[] = [];
    const firstState = createRaceDomainScenarioState('half_orc', 0);
    const rendered = render(
      <HalfOrcRaceLeaf race={halfOrc!} state={firstState} onScenarioEvent={message => events.push(message)} />,
    );

    expect(screen.getByTestId('half-orc-canonical-facts')).toHaveTextContent('Darkvision: 60 ft');
    expect(screen.getByTestId('half-orc-canonical-facts')).toHaveTextContent('Relentless Endurance:');
    expect(screen.getByTestId('half-orc-endurance-boundary')).toHaveTextContent(ORC_REDUCER_ENDURANCE_RESOURCE_ID);
    expect(screen.getByTestId('half-orc-endurance-boundary')).toHaveTextContent(HALF_ORC_ENDURANCE_RESOURCE_ID);
    expect(screen.getByTestId('half-orc-result-melee-critical')).toHaveTextContent('not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve melee critical/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve normal melee hit/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve ranged critical/i }));

    await screen.findByText(/Melee critical: 3 damage/);
    expect(screen.getByTestId('half-orc-result-melee-normal')).toHaveTextContent('1 damage');
    expect(screen.getByTestId('half-orc-result-ranged-critical')).toHaveTextContent('2 damage');
    expect(events).toHaveLength(3);
    expect(events[0]).toMatch(/HALF-ORC MELEE-CRITICAL RESOLVED/i);
    expect(screen.getByTestId('half-orc-results')).toHaveTextContent('extra-die log');

    rendered.rerender(
      <HalfOrcRaceLeaf
        race={halfOrc!}
        state={createRaceDomainScenarioState('half_orc', 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('half-orc-result-melee-critical')).toHaveTextContent('not resolved');
    expect(screen.getByTestId('half-orc-result-melee-normal')).toHaveTextContent('not resolved');
    expect(screen.getByTestId('half-orc-result-ranged-critical')).toHaveTextContent('not resolved');
  });
});
