import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { FOREST_GNOME_DATA } from '../../../../../../data/races/forest_gnome';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  FOREST_GNOME_ACTOR_ID,
  FOREST_GNOME_GNOMISH_CUNNING_RESOURCE_ID,
  ForestGnomeRaceLeaf,
  createForestGnomeGnomishCunningScenario,
  getCanonicalForestGnomeTrait,
  getForestGnomeSpeakWithAnimalsResource,
  hasCanonicalForestGnomeFeatures,
  hasForestGnomeCunningAdvantage,
  resolveForestGnomeGnomishCunning,
  RACE_DOMAIN_LEAF,
} from '../forestGnomeRaceLeaf';

/**
 * This file proves that the Forest Gnome leaf stays linked to canonical race
 * data, automatic discovery, production actor parsing, native save/dice
 * advantage, reset behaviour, visible event logging, and explicit boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Forest Gnome data,
 * and the Forest Gnome leaf's production-backed transaction helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from the
// active race record or automatic leaf discovery contract.
// ============================================================================

describe('Forest Gnome Race domain leaf', () => {
  it('links all displayed facts to canonical Forest Gnome data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'forest_gnome')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('forest_gnome');
    expect(RACE_DOMAIN_LEAF.id).toBe('forest-gnome-gnomish-cunning');
    expect(hasCanonicalForestGnomeFeatures(FOREST_GNOME_DATA)).toBe(true);
    expect(getCanonicalForestGnomeTrait(FOREST_GNOME_DATA, 'Vision')).toContain('60 feet');
    expect(getCanonicalForestGnomeTrait(FOREST_GNOME_DATA, 'Natural Illusionist')).toContain('Minor Illusion');
    expect(getCanonicalForestGnomeTrait(FOREST_GNOME_DATA, 'Speak with Animals')).toContain('Long Rest');
    expect(FOREST_GNOME_GNOMISH_CUNNING_RESOURCE_ID).toBe('racial_feature_forest_gnome__speak_with_animals__resource');
  });

  it('is discovered for forest_gnome by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('forest_gnome')).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Native Assembly, Parser, And Paired Advantage Baseline
  // ========================================================================
  // The representative proof must come from a production PlayerCharacter,
  // combat conversion, rollSavingThrow, and its shared dice path. The ordinary
  // context is the same actor with only the parsed Gnomish Cunning modifier out.
  // ========================================================================

  it('assembles the canonical actor and Speak with Animals PB/Long Rest resource', () => {
    const scenario = createForestGnomeGnomishCunningScenario(FOREST_GNOME_DATA);
    const resource = getForestGnomeSpeakWithAnimalsResource(scenario.actor);

    expect(scenario.actor?.id).toBe(FOREST_GNOME_ACTOR_ID);
    expect(hasForestGnomeCunningAdvantage(scenario.actor)).toBe(true);
    expect(resource).toMatchObject({ current: 3, max: 'proficiency_bonus', resetOn: 'long_rest' });
    expect(scenario.combatActor?.modifiers?.advantage).toEqual(expect.arrayContaining([
      'Intelligence, Wisdom, and Charisma saving throws',
    ]));
  });

  it.each(['Intelligence', 'Wisdom', 'Charisma'] as const)('uses advantage for %s saves but not ordinary context', ability => {
    const scenario = createForestGnomeGnomishCunningScenario(FOREST_GNOME_DATA);
    const resolved = resolveForestGnomeGnomishCunning(scenario, ability, () => 0.05);

    expect(resolved.lastResolution).toMatchObject({
      ability,
      d20Faces: [2, 2],
      advantaged: { roll: 2, total: expect.any(Number) },
      ordinary: { roll: 2, total: expect.any(Number) },
    });
    expect(resolved.lastResolution?.advantaged.total).toBe(resolved.lastResolution?.ordinary.total);

    const higherSecondFace = resolveForestGnomeGnomishCunning(scenario, ability, (() => {
      const values = [0.05, 0.95];
      return () => values.shift() ?? 0.05;
    })());
    expect(higherSecondFace.lastResolution?.d20Faces).toEqual([2, 20]);
    expect(higherSecondFace.lastResolution?.advantaged.roll).toBe(20);
    expect(higherSecondFace.lastResolution?.ordinary.roll).toBe(2);
    expect(higherSecondFace.lastResolution?.advantaged.total).toBeGreaterThan(higherSecondFace.lastResolution?.ordinary.total ?? 0);
  });

  // ========================================================================
  // Visible Reset, Log, Facts, And Boundary
  // ========================================================================
  // This check proves both the local reset control and the host resetCount
  // remount, while preserving a visible statement of unsupported subsystems.
  // ========================================================================

  it('shows faces/results, logs and resets the scenario, and states boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <ForestGnomeRaceLeaf
        race={FOREST_GNOME_DATA}
        state={createRaceDomainScenarioState(FOREST_GNOME_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('forest-gnome-vision-fact')).toHaveTextContent('60 feet');
    expect(screen.getByTestId('forest-gnome-illusionist-fact')).toHaveTextContent('Minor Illusion');
    expect(screen.getByTestId('forest-gnome-animals-fact')).toHaveTextContent('Proficiency Bonus');
    expect(screen.getByTestId('forest-gnome-ability-choice-fact')).toHaveTextContent('Intelligence, Wisdom, or Charisma');
    expect(screen.getByTestId('forest-gnome-actor')).toHaveTextContent('Uses 3/3');

    fireEvent.click(screen.getByRole('button', { name: /resolve gnomish cunning save/i }));
    expect(screen.getByTestId('forest-gnome-save-result')).toHaveTextContent('d20 faces');
    expect(screen.getByTestId('forest-gnome-save-result')).toHaveTextContent('ordinary total');
    expect(screen.getByTestId('forest-gnome-event-log')).toHaveTextContent(/Forest Gnome GNOMISH CUNNING INTELLIGENCE/);
    expect(events.at(-1)).toContain('Forest Gnome GNOMISH CUNNING INTELLIGENCE');

    fireEvent.click(screen.getByRole('button', { name: /reset forest gnome scenario/i }));
    expect(screen.getByTestId('forest-gnome-save-result')).toHaveTextContent('No Gnomish Cunning save resolved yet');
    expect(screen.getByTestId('forest-gnome-event-log')).toHaveTextContent('scenario reset');

    rerender(
      <ForestGnomeRaceLeaf
        race={FOREST_GNOME_DATA}
        state={createRaceDomainScenarioState(FOREST_GNOME_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('forest-gnome-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('forest-gnome-boundary')).toHaveTextContent('Darkvision sensing');
    expect(screen.getByTestId('forest-gnome-boundary')).toHaveTextContent('No 2D/3D render proof');
  });
});
