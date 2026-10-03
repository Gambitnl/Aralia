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
  CircleOfTheLandDemo,
  CIRCLE_OF_THE_LAND_RUNTIME_BOUNDARY,
  createCircleOfTheLandLevel2,
  createCircleOfTheLandLevel3,
  getCircleOfTheLandFeatures,
} from './CircleOfTheLandDemo';

/**
 * This test proves Circle of the Land from canonical source through production
 * progression, then checks deterministic controls, registry order, and the honest
 * missing-runtime boundary. Rendered 2D/3D and console proof remain deferred until
 * Rules mounts this domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Circle of the Land canonical progression pipeline', () => {
  it('resolves Circle of the Land through both canonical subclass helpers', () => {
    const circleOfTheLand = findSubclass(CLASSES_DATA.druid.id, 'circle_of_the_land');

    expect(circleOfTheLand?.id).toBe('circle_of_the_land');
    expect(circleOfTheLand?.classId).toBe(CLASSES_DATA.druid.id);
    expect(circleOfTheLand?.name).toBe('Circle of the Land');
    expect(subclassesForClass(CLASSES_DATA.druid.id)).toContainEqual(circleOfTheLand);
    expect(circleOfTheLand?.features).toEqual([
      expect.objectContaining({
        id: 'lands_aid',
        name: "Land's Aid",
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'circle_spells_land',
        name: 'Circle Spells',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows both Circle of the Land feature IDs absent at level 2 and present at level 3', () => {
    const level2 = createCircleOfTheLandLevel2();
    const level3 = createCircleOfTheLandLevel3(level2);
    const level2Features = getCircleOfTheLandFeatures(level2).map(feature => feature.id);
    const level3Features = getCircleOfTheLandFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('lands_aid');
    expect(level2Features).not.toContain('circle_spells_land');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('circle_of_the_land');
    expect(level3Features).toEqual(
      expect.arrayContaining(['lands_aid', 'circle_spells_land']),
    );
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.druid, 3, 'circle_of_the_land').map(feature => feature.id),
    );
    expect(level3.class.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'lands_aid', name: "Land's Aid" }),
        expect.objectContaining({ id: 'circle_spells_land', name: 'Circle Spells' }),
      ]),
    );
  });

  it('uses performLevelUp for the explicit level-3 Circle of the Land choice', () => {
    const level2 = createCircleOfTheLandLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'circle_of_the_land' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('circle_of_the_land');
    expect(productionLevel3.class.features.map(feature => feature.id)).toEqual(
      expect.arrayContaining(['lands_aid', 'circle_spells_land']),
    );
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Circle of the Land Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<CircleOfTheLandDemo />);

    expect(screen.getByTestId('circle-of-the-land-level')).toHaveTextContent('2');
    expect(screen.getByTestId('circle-of-the-land-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).not.toHaveTextContent('lands_aid');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).not.toHaveTextContent('circle_spells_land');
    expect(screen.getByTestId('circle-of-the-land-grant-status')).toHaveTextContent(
      'lands_aid and circle_spells_land',
    );
    expect(screen.getByTestId('circle-of-the-land-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Circle of the Land / Level 3' }));
    expect(screen.getByTestId('circle-of-the-land-level')).toHaveTextContent('3');
    expect(screen.getByTestId('circle-of-the-land-subclass')).toHaveTextContent('Circle of the Land');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).toHaveTextContent('lands_aid');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).toHaveTextContent("Land's Aid");
    expect(screen.getByTestId('circle-of-the-land-feature-list')).toHaveTextContent('circle_spells_land');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).toHaveTextContent('Circle Spells');
    expect(screen.getByTestId('circle-of-the-land-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('circle-of-the-land-transition-log')).toHaveTextContent('circle_of_the_land');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('circle-of-the-land-level')).toHaveTextContent('2');
    expect(screen.getByTestId('circle-of-the-land-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).not.toHaveTextContent('lands_aid');
    expect(screen.getByTestId('circle-of-the-land-feature-list')).not.toHaveTextContent('circle_spells_land');
  });

  it('appends Circle of the Land after the eight prior class leaves and resolves it', () => {
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
    expect(getSubclassDemo('druid', 'circle_of_the_land')?.label).toBe('Circle of the Land');
    expect(getSubclassDemo('druid', 'circle_of_the_land')?.Component).toBe(CircleOfTheLandDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<CircleOfTheLandDemo />);

    expect(screen.getByTestId('circle-of-the-land-runtime-boundary')).toHaveTextContent(
      "no executable subclass-aware Land's Aid damage/healing transaction",
    );
    expect(screen.getByTestId('circle-of-the-land-runtime-boundary')).toHaveTextContent(
      'land-choice/prepared-circle-spell transaction',
    );
    expect(screen.getByTestId('circle-of-the-land-runtime-boundary')).toHaveTextContent(
      'Natural Recovery slot restoration',
    );
    expect(screen.getByTestId('circle-of-the-land-runtime-boundary')).toHaveTextContent(
      'Generic Wild Shape, spell preparation, spell-slot, healing, damage, and rest paths are not subclass proof',
    );
    expect(screen.getByTestId('circle-of-the-land-runtime-boundary')).toHaveTextContent(
      'does not simulate land selection, prepared spells, free casts, slot recovery, Wild Shape spend, damage, healing, resistance, or combat results',
    );
    // The boundary may name unsupported outcomes, but it must not claim a fabricated
    // spell, slot, resource, damage, healing, resistance, or combat result.
    expect(CIRCLE_OF_THE_LAND_RUNTIME_BOUNDARY).not.toMatch(
      /prepared spells:|free casts:|slots recovered:|damage dealt:|healing restored:|resistance active:|combat result:/i,
    );
    expect(screen.queryByRole('button', { name: /spell|cast|recovery|shape|damage|heal|resistance|zone/i })).not.toBeInTheDocument();
  });
});
