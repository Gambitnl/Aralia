import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  AlchemistDemo,
  ALCHEMIST_RUNTIME_BOUNDARY,
  createAlchemistLevel2,
  createAlchemistLevel3,
  EXPERIMENTAL_ELIXIR_CONTRACT,
  getAlchemistFeatures,
  getAlchemistNativeAudit,
} from './AlchemistDemo';

/**
 * This test proves the Alchemist leaf from canonical subclass data through production
 * character creation, level-up, and player-to-combat conversion. It audits every
 * Experimental Elixir transaction boundary and rejects generic potion/item evidence.
 * Rendered 2D/3D and console proof remain deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Artificer Alchemist canonical progression pipeline', () => {
  it('resolves the exact subclass id, name, and Experimental Elixir feature', () => {
    const alchemist = findSubclass(CLASSES_DATA.artificer.id, 'alchemist');

    expect(alchemist?.id).toBe('alchemist');
    expect(alchemist?.classId).toBe(CLASSES_DATA.artificer.id);
    expect(alchemist?.name).toBe('Alchemist');
    expect(subclassesForClass(CLASSES_DATA.artificer.id)).toContainEqual(alchemist);
    expect(alchemist?.features).toEqual([
      expect.objectContaining({
        id: 'experimental_elixir',
        name: 'Experimental Elixir',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Experimental Elixir only after the explicit level-3 Alchemist choice', () => {
    const level2 = createAlchemistLevel2();
    const level3 = createAlchemistLevel3(level2);
    const level2Features = getAlchemistFeatures(level2).map(feature => feature.id);
    const level3Features = getAlchemistFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('experimental_elixir');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('alchemist');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.artificer, 3, 'alchemist').map(feature => feature.id),
    );
    expect(level3Features).toContain('experimental_elixir');
  });

  it('uses production level-up for the explicit level-3 Alchemist choice', () => {
    const level2 = createAlchemistLevel2();
    const level3 = createAlchemistLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'alchemist' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('alchemist');
  });
});

// ============================================================================
// Native Experimental Elixir boundary
// ============================================================================
describe('Alchemist native Experimental Elixir boundary', () => {
  it('records the complete creation, random, slot, drink, effect, resource, and reset contract', () => {
    expect(EXPERIMENTAL_ELIXIR_CONTRACT).toEqual({
      creation: 'After finishing a Long Rest, create one Experimental Elixir in an empty flask you touch.',
      randomEffect: 'Roll 1d6 when the elixir is created to determine its effect.',
      extraCreation: 'Create each additional elixir by expending one spell slot of 1st level or higher.',
      drink: 'The recorded effect triggers when someone drinks the elixir.',
      effects: [
        '1: Healing — restore 2d4 + Intelligence modifier hit points.',
        '2: Swiftness — gain 10 feet of Speed for 1 hour.',
        '3: Resilience — gain +1 AC for 10 minutes.',
        '4: Boldness — add 1d4 to attack rolls and saving throws for 1 minute.',
        '5: Flight — gain a 10-foot Fly Speed for 10 minutes.',
        '6: Transformation — gain the effect of Alter Self.',
      ],
      resource: 'The free long-rest creation and each extra spell-slot-funded creation must have distinct elixir and slot ownership.',
      reset: 'A Long Rest refreshes the free creation opportunity; each elixir remains a created object until consumed or otherwise removed.',
    });
  });

  it('rejects generic potion/item evidence and confirms no native transaction is bound', () => {
    const level2Audit = getAlchemistNativeAudit(createAlchemistLevel2());
    const level3Audit = getAlchemistNativeAudit(createAlchemistLevel3());

    expect(level2Audit.combatClassId).toBe('artificer');
    expect(level3Audit.combatClassId).toBe('artificer');
    expect(level3Audit.hasExperimentalElixirAbility).toBe(false);
    expect(level3Audit.hasExperimentalElixirResource).toBe(false);
    expect(level3Audit.hasNativeElixirState).toBe(false);
    expect(level3Audit.hasLongRestCreationResolver).toBe(false);
    expect(level3Audit.hasRandomEffectResolver).toBe(false);
    expect(level3Audit.hasSpellSlotCreationResolver).toBe(false);
    expect(level3Audit.hasDrinkEffectResolver).toBe(false);
    expect(level3Audit.hasElixirResetResolver).toBe(false);
    expect(level3Audit.genericPotionOrItemProof).toBe(false);
  });
});

// ============================================================================
// Deterministic controls and registry proof
// ============================================================================
describe('Alchemist Classes-domain registration', () => {
  it('renders canonical facts, the full metadata audit, transition log, and Reset', () => {
    render(<AlchemistDemo />);

    expect(screen.getByTestId('alchemist-level')).toHaveTextContent('2');
    expect(screen.getByTestId('alchemist-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('alchemist-feature-list')).not.toHaveTextContent('experimental_elixir');
    expect(screen.getByTestId('alchemist-creation-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-random-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-slot-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-drink-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-effect-audit')).toHaveTextContent('6 authored outcomes');
    expect(screen.getByTestId('alchemist-resource-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-reset-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('alchemist-generic-audit')).toHaveTextContent('Rejected as proof');
    expect(screen.getByTestId('alchemist-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Alchemist / Level 3' }));
    expect(screen.getByTestId('alchemist-level')).toHaveTextContent('3');
    expect(screen.getByTestId('alchemist-subclass')).toHaveTextContent('Alchemist');
    expect(screen.getByTestId('alchemist-feature-list')).toHaveTextContent('experimental_elixir');
    expect(screen.getByTestId('alchemist-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('alchemist-transition-log')).toHaveTextContent("subclassId: 'alchemist'");

    // No unsupported create, roll, slot, drink, or effect action is exposed by the
    // leaf; metadata and progression are the complete truthful surface for now.
    expect(screen.queryAllByRole('button', { name: /create|roll|slot|drink|effect|elixir/i })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('alchemist-level')).toHaveTextContent('2');
    expect(screen.getByTestId('alchemist-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('alchemist-feature-list')).not.toHaveTextContent('experimental_elixir');
  });

  it('appends Alchemist directly after Abjurer in the cumulative registry', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('artificer', 'alchemist')?.label).toBe('Alchemist');
    expect(getSubclassDemo('artificer', 'alchemist')?.Component).toBe(AlchemistDemo);
  });

  it('shows the exact partial-runtime boundary without fake elixir controls or outcomes', () => {
    render(<AlchemistDemo />);

    expect(screen.getByTestId('alchemist-runtime-boundary')).toHaveTextContent(
      ALCHEMIST_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('alchemist-runtime-boundary')).toHaveTextContent(
      'long-rest creation, d6 effect roll, spell-slot-funded extra creation, drink trigger',
    );
    expect(screen.getByTestId('alchemist-runtime-boundary')).toHaveTextContent(
      'Generic potions, consumable items, healing, buffs, Alter Self, and spell-slot fields are not Experimental Elixir proof.',
    );
    expect(screen.queryAllByRole('button', { name: /create|roll|slot|drink|effect|elixir/i })).toHaveLength(0);
  });
});
