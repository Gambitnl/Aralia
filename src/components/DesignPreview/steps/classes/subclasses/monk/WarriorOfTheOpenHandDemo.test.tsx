import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import {
  getSubclassDemo,
  SUBCLASS_DEMO_REGISTRY,
} from '../..';
import {
  getWarriorOfTheOpenHandFeatures,
  getWarriorOfTheOpenHandFlurry,
  OPEN_HAND_RUNTIME_BOUNDARY,
  WarriorOfTheOpenHandDemo,
  createWarriorOfTheOpenHandLevel2,
  createWarriorOfTheOpenHandLevel3,
} from './WarriorOfTheOpenHandDemo';

/**
 * This test proves Warrior of the Open Hand against canonical source and the
 * production progression/combat assemblers. It also proves Reset, the cumulative
 * registry append, native Flurry metadata, and the exact missing subclass runtime.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Monk Warrior of the Open Hand canonical progression pipeline', () => {
  it('resolves the exact subclass id and Open Hand Technique feature', () => {
    const openHand = findSubclass(CLASSES_DATA.monk.id, 'open_hand');

    expect(openHand?.id).toBe('open_hand');
    expect(openHand?.classId).toBe(CLASSES_DATA.monk.id);
    expect(openHand?.name).toBe('Warrior of the Open Hand');
    expect(subclassesForClass(CLASSES_DATA.monk.id)).toContainEqual(openHand);
    expect(openHand?.features).toEqual([
      expect.objectContaining({
        id: 'open_hand_technique',
        name: 'Open Hand Technique',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Monk Focus at level 2 and Open Hand Technique only after the level-3 choice', () => {
    const level2 = createWarriorOfTheOpenHandLevel2();
    const level3 = createWarriorOfTheOpenHandLevel3(level2);
    const level2Features = getWarriorOfTheOpenHandFeatures(level2).map(feature => feature.id);
    const level3Features = getWarriorOfTheOpenHandFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toEqual(expect.arrayContaining(['monks_focus', 'unarmored_movement']));
    expect(level2Features).not.toContain('open_hand_technique');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('open_hand');
    expect(level3Features).toContain('open_hand_technique');
    expect(level3Features).toContain('deflect_attacks');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.monk, 3, 'open_hand').map(feature => feature.id),
    );
  });

  it('uses production combat assembly for native Flurry metadata without claiming Focus payment', () => {
    const level2 = createWarriorOfTheOpenHandLevel2();
    const level3 = createWarriorOfTheOpenHandLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'open_hand' },
    );
    const flurry = getWarriorOfTheOpenHandFlurry(level3);

    expect(level3).toEqual(productionLevel3);
    expect(flurry).toEqual(expect.objectContaining({
      id: 'flurry_of_blows',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
    }));
    expect(flurry?.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', damageType: 'bludgeoning' }),
    ]));
    expect(flurry?.usesRemaining).toBeUndefined();
    expect(flurry?.maxUses).toBeUndefined();
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary
// ============================================================================
describe('Warrior of the Open Hand Classes-domain registration', () => {
  it('renders level checkpoints, native Flurry facts, exact grant, transition log, and Reset', () => {
    render(<WarriorOfTheOpenHandDemo />);

    expect(screen.getByTestId('open-hand-level')).toHaveTextContent('2');
    expect(screen.getByTestId('open-hand-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('open-hand-feature-list')).toHaveTextContent('monks_focus');
    expect(screen.getByTestId('open-hand-feature-list')).not.toHaveTextContent('open_hand_technique');
    expect(screen.getByTestId('open-hand-native-flurry')).toHaveTextContent('flurry_of_blows');
    expect(screen.getByTestId('open-hand-native-flurry')).toHaveTextContent('bonus');
    expect(screen.getByTestId('open-hand-native-flurry')).toHaveTextContent('single_enemy');
    expect(screen.getByTestId('open-hand-native-flurry')).toHaveTextContent('No subclass resource binding');
    expect(screen.getByTestId('open-hand-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Open Hand / Level 3' }));
    expect(screen.getByTestId('open-hand-level')).toHaveTextContent('3');
    expect(screen.getByTestId('open-hand-subclass')).toHaveTextContent('Warrior of the Open Hand');
    expect(screen.getByTestId('open-hand-feature-list')).toHaveTextContent('open_hand_technique');
    expect(screen.getByTestId('open-hand-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('open-hand-transition-log')).toHaveTextContent("subclassId: 'open_hand'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('open-hand-level')).toHaveTextContent('2');
    expect(screen.getByTestId('open-hand-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('open-hand-feature-list')).not.toHaveTextContent('open_hand_technique');
  });

  it('appends Open Hand after Oath of Vengeance and resolves the cumulative registry', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('monk', 'open_hand')?.label).toBe('Warrior of the Open Hand');
    expect(getSubclassDemo('monk', 'open_hand')?.Component).toBe(WarriorOfTheOpenHandDemo);
  });

  it('shows the exact partial-runtime boundary without fake combat output', () => {
    render(<WarriorOfTheOpenHandDemo />);

    expect(screen.getByTestId('open-hand-runtime-boundary')).toHaveTextContent(OPEN_HAND_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('open-hand-runtime-boundary')).toHaveTextContent('no Focus resource payment');
    expect(screen.getByTestId('open-hand-runtime-boundary')).toHaveTextContent('push, prone, or no reactions');
    expect(screen.getByTestId('open-hand-runtime-boundary')).toHaveTextContent('does not simulate activation');
    expect(screen.queryByRole('button', { name: /activate|attack|roll|damage|target/i })).not.toBeInTheDocument();
  });
});
