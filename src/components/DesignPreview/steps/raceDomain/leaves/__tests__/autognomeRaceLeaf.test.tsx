// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Autognome Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * This test owns only the Autognome leaf contract and its deterministic native
 * Armor Class transaction.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ALL_ITEMS } from '../../../../../../data/items';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { AUTOGNOME_DATA } from '../../../../../../data/races/autognome';
import { getRacialModifierBucketsFromTraitText } from '../../../../../../data/races/racialTraits';
import { getAbilityModifierValue } from '../../../../../../utils/character/statUtils';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  AUTOGNOME_ARMOR_ITEM_ID,
  AUTOGNOME_ACTOR_ID,
  AutognomeRaceLeaf,
  createAutognomeArmorClassScenario,
  getCanonicalArmoredCasingBaseAC,
  getCanonicalArmoredCasingTrait,
  hasCanonicalArmoredCasing,
  resolveAutognomeArmorClass,
  RACE_DOMAIN_LEAF,
} from '../autognomeRaceLeaf';

/**
 * This file proves that the Autognome leaf stays linked to canonical data,
 * automatic discovery, production character assembly, and native AC rules.
 * It also proves visible event/reset behavior and keeps unsupported traits
 * honestly outside the demonstrated transaction.
 *
 * Called by: Vitest focused and cumulative Race-domain checks.
 * Depends on: ACTIVE_RACES, the racial trait parser, the Race registry, and
 * the Autognome leaf's deterministic assembly helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the active race record or automatic leaves/ discovery contract.
// ============================================================================

describe('Autognome Race domain leaf', () => {
  it('links Armored Casing to the canonical race and production parser', () => {
    const trait = getCanonicalArmoredCasingTrait(AUTOGNOME_DATA);
    const parsed = getRacialModifierBucketsFromTraitText(trait ?? '');

    expect(ACTIVE_RACES.some(race => race.id === 'autognome')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('autognome');
    expect(RACE_DOMAIN_LEAF.id).toBe('autognome-armored-casing');
    expect(hasCanonicalArmoredCasing(AUTOGNOME_DATA)).toBe(true);
    expect(trait).toContain('base Armor Class is 13');
    expect(getCanonicalArmoredCasingBaseAC(AUTOGNOME_DATA)).toBe(13);
    expect(parsed.baseArmorClass).toBe(13);
  });

  it('is discovered for autognome by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('autognome');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Assembly, Comparison, And Rejection Guards
  // ========================================================================
  // The representative proof must come from assembled PlayerCharacter data
  // and calculateArmorClass, while a malformed canonical record must reject
  // instead of showing a hardcoded AC result.
  // ========================================================================

  it('assembles the canonical racial modifier and proves 13 + Dexterity unarmored', () => {
    const scenario = createAutognomeArmorClassScenario(AUTOGNOME_DATA);
    const actor = scenario.actor;

    expect(actor?.id).toBe(AUTOGNOME_ACTOR_ID);
    expect(actor?.modifiers?.baseArmorClass).toBe(13);
    const dexterityModifier = getAbilityModifierValue(actor?.finalAbilityScores.Dexterity ?? 10);
    const leatherArmor = ALL_ITEMS[AUTOGNOME_ARMOR_ITEM_ID];
    expect(scenario.unarmoredArmorClass).toBe(13 + dexterityModifier);
    expect(scenario.armoredArmorClass).toBe((leatherArmor.baseArmorClass ?? 10) + dexterityModifier);
    expect(scenario.armorClass).toBe(scenario.unarmoredArmorClass);
  });

  it('uses the real armor item and rejects Armored Casing while armor is worn', () => {
    const scenario = createAutognomeArmorClassScenario(AUTOGNOME_DATA);
    const unarmored = resolveAutognomeArmorClass(scenario, 'unarmored');
    const armored = resolveAutognomeArmorClass(unarmored, 'leather-armor');

    expect(armored.lastResolution).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(armored.actor?.equippedItems.Torso?.id).toBe(AUTOGNOME_ARMOR_ITEM_ID);
    expect(armored.armorClass).toBe(
      (ALL_ITEMS[AUTOGNOME_ARMOR_ITEM_ID].baseArmorClass ?? 10)
        + getAbilityModifierValue(armored.actor?.finalAbilityScores.Dexterity ?? 10),
    );
    expect(armored.outcome).toContain('racial base AC is ignored');
    expect(armored.outcome).toContain('native armor calculation');
  });

  it('rejects a canonical record that cannot prove the demonstrated rule', () => {
    const incompleteRace = {
      ...AUTOGNOME_DATA,
      traits: AUTOGNOME_DATA.traits.filter(trait => !trait.startsWith('Armored Casing:')),
    };
    const rejected = createAutognomeArmorClassScenario(incompleteRace);
    const resolved = resolveAutognomeArmorClass(rejected, 'unarmored');

    expect(rejected.lastResolution).toMatchObject({
      status: 'rejected',
      reason: 'canonical_trait_missing',
    });
    expect(resolved.lastResolution).toMatchObject({
      status: 'rejected',
      reason: 'canonical_trait_missing',
      mode: 'unarmored',
    });
    expect(resolved.armorClass).toBeNull();
    expect(resolved.outcome).toContain('production-assembled Autognome actor is missing');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundary
  // ========================================================================
  // The component publishes the native result through the shell callback and
  // remounts when resetCount changes; no rendered 2D/3D proof is claimed here.
  // ========================================================================

  it('shows actor/equipment facts, emits an event, resets, and labels unsupported traits', () => {
    const events: string[] = [];
    const baseline = createAutognomeArmorClassScenario(AUTOGNOME_DATA);
    const { rerender } = render(
      <AutognomeRaceLeaf
        race={AUTOGNOME_DATA}
        state={createRaceDomainScenarioState(AUTOGNOME_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('autognome-canonical-trait')).toHaveTextContent('base Armor Class is 13');
    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent('Wearing no armor');
    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent(`AC ${baseline.armorClass}`);
    expect(screen.getByTestId('autognome-assembly-boundary')).toHaveTextContent('applyRacialSpellGrantsByLevel');

    fireEvent.change(screen.getByLabelText('Equipment case'), {
      target: { value: 'leather-armor' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resolve autognome ac/i }));

    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent('Wearing Leather Armor');
    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent(`AC ${baseline.armoredArmorClass}`);
    expect(screen.getByTestId('autognome-armor-outcome')).toHaveTextContent('racial base AC is ignored');
    expect(events.at(-1)).toContain('Autognome ARMORED CASING LEATHER-ARMOR');

    rerender(
      <AutognomeRaceLeaf
        race={AUTOGNOME_DATA}
        state={createRaceDomainScenarioState(AUTOGNOME_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByLabelText('Equipment case')).toHaveValue('unarmored');
    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent('Wearing no armor');
    expect(screen.getByTestId('autognome-armor-actor')).toHaveTextContent(`AC ${baseline.armorClass}`);
    expect(screen.getByTestId('autognome-unsupported-boundary')).toHaveTextContent('Built for Success randomness');
    expect(screen.getByTestId('autognome-unsupported-boundary')).toHaveTextContent('2D');
    expect(screen.getByTestId('autognome-unsupported-boundary')).toHaveTextContent('3D');
  });
});
