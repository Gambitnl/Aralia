import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  AbjurerDemo,
  ABJURER_RUNTIME_BOUNDARY,
  ARCANE_WARD_CONTRACT,
  createAbjurerLevel2,
  createAbjurerLevel3,
  getAbjurerFeatures,
  getAbjurerNativeAudit,
} from './AbjurerDemo';

/**
 * This test proves the Abjurer leaf from canonical subclass data through production
 * character creation, level-up, and player-to-combat conversion. It audits Arcane
 * Ward creation, hit points, Abjuration recharge, damage absorption, and reset as
 * explicit contracts while rejecting generic temporary hit points as proof.
 * Rendered 2D/3D and console proof remain deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Wizard Abjurer canonical progression pipeline', () => {
  it('resolves the exact subclass id, name, and Arcane Ward feature', () => {
    const abjurer = findSubclass(CLASSES_DATA.wizard.id, 'abjuration');

    expect(abjurer?.id).toBe('abjuration');
    expect(abjurer?.classId).toBe(CLASSES_DATA.wizard.id);
    expect(abjurer?.name).toBe('Abjurer (School of Abjuration)');
    expect(subclassesForClass(CLASSES_DATA.wizard.id)).toContainEqual(abjurer);
    expect(abjurer?.features).toEqual([
      expect.objectContaining({
        id: 'arcane_ward',
        name: 'Arcane Ward',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Arcane Ward only after the explicit level-3 Abjurer choice', () => {
    const level2 = createAbjurerLevel2();
    const level3 = createAbjurerLevel3(level2);
    const level2Features = getAbjurerFeatures(level2).map(feature => feature.id);
    const level3Features = getAbjurerFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('arcane_ward');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('abjuration');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.wizard, 3, 'abjuration').map(feature => feature.id),
    );
    expect(level3Features).toContain('arcane_ward');
  });

  it('uses production level-up for the explicit level-3 Abjurer choice', () => {
    const level2 = createAbjurerLevel2();
    const level3 = createAbjurerLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'abjuration' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('abjuration');
  });
});

// ============================================================================
// Native Arcane Ward audit and exact gap proof
// ============================================================================
describe('Abjurer native Arcane Ward boundary', () => {
  it('records the exact creation, hit-point, recharge, absorption, and reset contracts', () => {
    expect(ARCANE_WARD_CONTRACT).toEqual({
      creation: 'Cast an Abjuration spell with a spell slot to create the ward; it lasts until a Long Rest.',
      hitPoints: 'Ward maximum equals twice Wizard level plus Intelligence modifier.',
      recharge: 'Casting an Abjuration spell with a slot restores twice the slot level; a Bonus Action can expend a slot to restore the same amount.',
      damageAbsorption: 'The ward takes damage first after Resistance or Vulnerability; overflow damage reaches the Abjurer.',
      reset: 'After creation, the ward cannot be created again until a Long Rest.',
    });
  });

  it('rejects generic temporary hit points and absent native state as Ward proof', () => {
    const level2Audit = getAbjurerNativeAudit(createAbjurerLevel2());
    const level3Audit = getAbjurerNativeAudit(createAbjurerLevel3());

    expect(level2Audit.combatClassId).toBe('wizard');
    expect(level2Audit.hasArcaneWardAbility).toBe(false);
    expect(level2Audit.hasArcaneWardResource).toBe(false);
    expect(level3Audit.combatClassId).toBe('wizard');
    expect(level3Audit.hasArcaneWardAbility).toBe(false);
    expect(level3Audit.hasArcaneWardResource).toBe(false);
    expect(level3Audit.hasNativeWardState).toBe(false);
    expect(level3Audit.hasAbjurationSpellRecharge).toBe(false);
    expect(level3Audit.hasDamageAbsorptionHook).toBe(false);
    expect(level3Audit.genericTemporaryHitPoints).toBeUndefined();
    expect(ABJURER_RUNTIME_BOUNDARY).toContain('Generic temporary hit points are not Arcane Ward proof');
    expect(ABJURER_RUNTIME_BOUNDARY).toContain('Resistance or Vulnerability');
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary proof
// ============================================================================
describe('Abjurer Classes-domain registration', () => {
  it('renders canonical facts, the exact audit gap, and Reset', () => {
    render(<AbjurerDemo />);

    expect(screen.getByTestId('abjurer-level')).toHaveTextContent('2');
    expect(screen.getByTestId('abjurer-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('abjurer-feature-list')).not.toHaveTextContent('arcane_ward');
    expect(screen.getByTestId('abjurer-creation-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('abjurer-hp-audit')).toHaveTextContent('twice Wizard level');
    expect(screen.getByTestId('abjurer-recharge-audit')).toHaveTextContent('slot level');
    expect(screen.getByTestId('abjurer-absorption-audit')).toHaveTextContent('damage first');
    expect(screen.getByTestId('abjurer-reset-audit')).toHaveTextContent('Long Rest');
    expect(screen.getByTestId('abjurer-ability-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('abjurer-resource-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('abjurer-state-audit')).toHaveTextContent('Not present');
    expect(screen.getByTestId('abjurer-temp-hp-audit')).toHaveTextContent('None; not Arcane Ward proof');
    expect(screen.getByTestId('abjurer-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Abjurer / Level 3' }));
    expect(screen.getByTestId('abjurer-level')).toHaveTextContent('3');
    expect(screen.getByTestId('abjurer-subclass')).toHaveTextContent('Abjurer (School of Abjuration)');
    expect(screen.getByTestId('abjurer-feature-list')).toHaveTextContent('arcane_ward');
    expect(screen.getByTestId('abjurer-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('abjurer-transition-log')).toHaveTextContent("subclassId: 'abjuration'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('abjurer-level')).toHaveTextContent('2');
    expect(screen.getByTestId('abjurer-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('abjurer-feature-list')).not.toHaveTextContent('arcane_ward');
  });

  it('appends Abjurer directly after Evoker and resolves it', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('wizard', 'abjuration')?.label).toBe('Abjurer (School of Abjuration)');
    expect(getSubclassDemo('wizard', 'abjuration')?.Component).toBe(AbjurerDemo);
  });

  it('does not expose fabricated spell, ward, recharge, damage, or reset controls', () => {
    render(<AbjurerDemo />);

    expect(screen.getByTestId('abjurer-runtime-boundary')).toHaveTextContent(ABJURER_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('abjurer-runtime-boundary')).toHaveTextContent('does not simulate spell casting');
    expect(screen.getByTestId('abjurer-runtime-boundary')).toHaveTextContent('damage absorption');
    expect(screen.queryAllByRole('button', { name: /cast|ward|recharge|damage|absorb|spell slot/i })).toHaveLength(0);
  });
});
