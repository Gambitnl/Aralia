import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  OathOfDevotionDemo,
  OATH_OF_DEVOTION_RUNTIME_BOUNDARY,
  createOathOfDevotionLevel2,
  createOathOfDevotionLevel3,
  getOathOfDevotionFeatures,
} from './OathOfDevotionDemo';

/**
 * This test proves Oath of Devotion from canonical subclass data through the
 * production quick-character and level-up helpers. It also checks deterministic
 * controls, the sequential registry append, and the exact missing-runtime boundary.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Paladin Oath of Devotion canonical progression pipeline', () => {
  it('resolves Oath of Devotion and its exact subclass feature', () => {
    const oath = findSubclass(CLASSES_DATA.paladin.id, 'oath_of_devotion');

    expect(oath?.id).toBe('oath_of_devotion');
    expect(oath?.classId).toBe(CLASSES_DATA.paladin.id);
    expect(oath?.name).toBe('Oath of Devotion');
    expect(subclassesForClass(CLASSES_DATA.paladin.id)).toContainEqual(oath);
    expect(oath?.features).toEqual([
      expect.objectContaining({
        id: 'sacred_weapon',
        name: 'Sacred Weapon (Channel Divinity)',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Channel Divinity and Sacred Weapon absent at level 2 and present at level 3', () => {
    const level2 = createOathOfDevotionLevel2();
    const level3 = createOathOfDevotionLevel3(level2);
    const level2Features = getOathOfDevotionFeatures(level2).map(feature => feature.id);
    const level3Features = getOathOfDevotionFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toEqual(expect.arrayContaining(['divine_sense', 'divine_smite_feature']));
    expect(level2Features).not.toContain('paladin_channel_divinity');
    expect(level2Features).not.toContain('sacred_weapon');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('oath_of_devotion');
    expect(level3Features).toEqual(
      expect.arrayContaining(['paladin_channel_divinity', 'sacred_weapon']),
    );
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.paladin, 3, 'oath_of_devotion').map(feature => feature.id),
    );
  });

  it('uses performLevelUp for the explicit level-3 Oath of Devotion choice', () => {
    const level2 = createOathOfDevotionLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'oath_of_devotion' },
    );

    expect(createOathOfDevotionLevel3(level2)).toEqual(productionLevel3);
    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('oath_of_devotion');
  });
});

// ============================================================================
// Deterministic demonstration controls
// ============================================================================
describe('Oath of Devotion demonstration controls', () => {
  it('shows the canonical transition, exact log, and Reset result', () => {
    render(<OathOfDevotionDemo />);

    expect(screen.getByTestId('oath-of-devotion-level')).toHaveTextContent('2');
    expect(screen.getByTestId('oath-of-devotion-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).toHaveTextContent('divine_smite_feature');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).not.toHaveTextContent('sacred_weapon');
    expect(screen.getByTestId('oath-of-devotion-grant-status')).toHaveTextContent('sacred_weapon');
    expect(screen.getByTestId('oath-of-devotion-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Oath / Level 3' }));
    expect(screen.getByTestId('oath-of-devotion-level')).toHaveTextContent('3');
    expect(screen.getByTestId('oath-of-devotion-subclass')).toHaveTextContent('Oath of Devotion');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).toHaveTextContent('paladin_channel_divinity');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).toHaveTextContent('Channel Divinity');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).toHaveTextContent('sacred_weapon');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).toHaveTextContent('Sacred Weapon');
    expect(screen.getByTestId('oath-of-devotion-grant-status')).toHaveTextContent(
      'Canonical grants present: paladin_channel_divinity - Channel Divinity; sacred_weapon - Sacred Weapon (Channel Divinity).',
    );
    expect(screen.getByTestId('oath-of-devotion-transition-log')).toHaveTextContent(
      "subclassId: 'oath_of_devotion'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('oath-of-devotion-level')).toHaveTextContent('2');
    expect(screen.getByTestId('oath-of-devotion-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('oath-of-devotion-feature-list')).not.toHaveTextContent('sacred_weapon');
  });
});

// ============================================================================
// Registry and honest runtime boundary
// ============================================================================
describe('Oath of Devotion registry and runtime boundary', () => {
  it('appends Oath of Devotion after Assassin and resolves it', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId)).toEqual([
      'champion',
      'battle_master',
      'berserker',
      'wild_heart',
      'college_of_lore',
      'college_of_valor',
      'life_domain',
      'light_domain',
      'circle_of_the_land',
      'circle_of_the_moon',
      'hunter',
      'beast_master',
      'thief',
      'assassin',
      'oath_of_devotion',
      'oath_of_vengeance',
      'open_hand',
      'shadow',
      'draconic',
      'wild_magic',
      'fiend',
      'archfey',
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('paladin', 'oath_of_devotion')?.label).toBe('Oath of Devotion');
    expect(getSubclassDemo('paladin', 'oath_of_devotion')?.Component).toBe(OathOfDevotionDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<OathOfDevotionDemo />);

    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      OATH_OF_DEVOTION_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      'spends a Channel Divinity use',
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      'targets an equipped weapon',
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      "adds the Paladin's Charisma modifier to that weapon's attack rolls",
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      'makes the weapon shed light',
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      'no subclass-aware oath-spell preparation path was found',
    );
    expect(screen.getByTestId('oath-of-devotion-runtime-boundary')).toHaveTextContent(
      'does not simulate a weapon target, attack roll, Charisma bonus, radiant result, light state, Channel Divinity resource, spell preparation, action payment, or combat log outcome',
    );
    expect(screen.queryByRole('button', { name: /attack|roll|damage|weapon|light|spell|channel/i })).not.toBeInTheDocument();
  });
});
