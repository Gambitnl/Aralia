import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  OathOfVengeanceDemo,
  VOW_OF_ENMITY_RUNTIME_BOUNDARY,
  createOathOfVengeanceLevel2,
  createOathOfVengeanceLevel3,
  getOathOfVengeanceAbility,
  getOathOfVengeanceFeatures,
} from './OathOfVengeanceDemo';

/**
 * This test proves Oath of Vengeance from canonical subclass data through the
 * production quick-character, level-up, and combat-character helpers. It also
 * checks deterministic controls, the sequential registry append, and the exact
 * missing chosen-foe boundary without inventing an attack result.
 *
 * Rendered 2D/3D proof remains deferred until the Rules host mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Paladin Oath of Vengeance canonical progression pipeline', () => {
  it('resolves Oath of Vengeance and its exact subclass feature', () => {
    const oath = findSubclass(CLASSES_DATA.paladin.id, 'oath_of_vengeance');

    expect(oath?.id).toBe('oath_of_vengeance');
    expect(oath?.classId).toBe(CLASSES_DATA.paladin.id);
    expect(oath?.name).toBe('Oath of Vengeance');
    expect(subclassesForClass(CLASSES_DATA.paladin.id)).toContainEqual(oath);
    expect(oath?.features).toEqual([
      expect.objectContaining({
        id: 'vow_of_enmity',
        name: 'Vow of Enmity (Channel Divinity)',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows the Vow feature absent at level 2 and present at level 3', () => {
    const level2 = createOathOfVengeanceLevel2();
    const level3 = createOathOfVengeanceLevel3(level2);
    const level2Features = getOathOfVengeanceFeatures(level2).map(feature => feature.id);
    const level3Features = getOathOfVengeanceFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toEqual(expect.arrayContaining(['divine_sense', 'divine_smite_feature']));
    expect(level2Features).not.toContain('vow_of_enmity');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('oath_of_vengeance');
    expect(level3Features).toContain('vow_of_enmity');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.paladin, 3, 'oath_of_vengeance').map(feature => feature.id),
    );
  });

  it('uses production combat-character assembly for the native Vow ability metadata', () => {
    const level2 = createOathOfVengeanceLevel2();
    const level3 = createOathOfVengeanceLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'oath_of_vengeance' },
    );
    const vow = getOathOfVengeanceAbility(level3);

    expect(level3).toEqual(productionLevel3);
    expect(vow).toEqual(expect.objectContaining({
      id: 'vow_of_enmity',
      cost: { type: 'bonus' },
      targeting: 'self',
      maxUses: 1,
      usesRemaining: 1,
      effects: [],
    }));
  });
});

// ============================================================================
// Deterministic demonstration controls
// ============================================================================
describe('Oath of Vengeance demonstration controls', () => {
  it('shows native ability creation facts, the exact log, and Reset result', () => {
    render(<OathOfVengeanceDemo />);

    expect(screen.getByTestId('oath-of-vengeance-level')).toHaveTextContent('2');
    expect(screen.getByTestId('oath-of-vengeance-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('oath-of-vengeance-feature-list')).not.toHaveTextContent('vow_of_enmity');
    expect(screen.getByTestId('oath-of-vengeance-native-ability')).toHaveTextContent(
      'No native Vow ability exists before the level-3 subclass choice.',
    );
    expect(screen.getByTestId('oath-of-vengeance-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Oath / Level 3' }));
    expect(screen.getByTestId('oath-of-vengeance-level')).toHaveTextContent('3');
    expect(screen.getByTestId('oath-of-vengeance-subclass')).toHaveTextContent('Oath of Vengeance');
    expect(screen.getByTestId('oath-of-vengeance-feature-list')).toHaveTextContent('vow_of_enmity');
    expect(screen.getByTestId('oath-of-vengeance-native-ability')).toHaveTextContent('vow_of_enmity');
    expect(screen.getByTestId('oath-of-vengeance-native-ability')).toHaveTextContent('bonus');
    expect(screen.getByTestId('oath-of-vengeance-native-ability')).toHaveTextContent('self');
    expect(screen.getByTestId('oath-of-vengeance-native-ability')).toHaveTextContent('1/1');
    expect(screen.getByTestId('oath-of-vengeance-transition-log')).toHaveTextContent(
      "subclassId: 'oath_of_vengeance'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('oath-of-vengeance-level')).toHaveTextContent('2');
    expect(screen.getByTestId('oath-of-vengeance-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('oath-of-vengeance-feature-list')).not.toHaveTextContent('vow_of_enmity');
  });
});

// ============================================================================
// Registry and honest runtime boundary
// ============================================================================
describe('Oath of Vengeance registry and runtime boundary', () => {
  it('appends Oath of Vengeance after Oath of Devotion and resolves it', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('paladin', 'oath_of_vengeance')?.label).toBe('Oath of Vengeance');
    expect(getSubclassDemo('paladin', 'oath_of_vengeance')?.Component).toBe(OathOfVengeanceDemo);
  });

  it('shows the exact partial-runtime boundary without fake activation or attack output', () => {
    render(<OathOfVengeanceDemo />);

    expect(screen.getByTestId('oath-of-vengeance-runtime-boundary')).toHaveTextContent(
      VOW_OF_ENMITY_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('oath-of-vengeance-runtime-boundary')).toHaveTextContent(
      'does not preserve one chosen foe',
    );
    expect(screen.getByTestId('oath-of-vengeance-runtime-boundary')).toHaveTextContent(
      'does not simulate activation, target selection, target-specific advantage, damage, combat-log outcome, or reset',
    );
    expect(screen.queryByRole('button', { name: /activate|attack|roll|damage|target/i })).not.toBeInTheDocument();
  });
});
