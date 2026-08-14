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
  CircleOfTheMoonDemo,
  CIRCLE_OF_THE_MOON_RUNTIME_BOUNDARY,
  createCircleOfTheMoonLevel2,
  createCircleOfTheMoonLevel3,
  getCircleOfTheMoonFeatures,
} from './CircleOfTheMoonDemo';

/**
 * This test proves Circle of the Moon from canonical source through production
 * progression, then checks deterministic controls, registry order, and the honest
 * missing-runtime boundary. Rendered 2D/3D and console proof remain deferred until
 * Rules mounts this domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Circle of the Moon canonical progression pipeline', () => {
  it('resolves Circle of the Moon through both canonical subclass helpers', () => {
    const circleOfTheMoon = findSubclass(CLASSES_DATA.druid.id, 'circle_of_the_moon');

    expect(circleOfTheMoon?.id).toBe('circle_of_the_moon');
    expect(circleOfTheMoon?.classId).toBe(CLASSES_DATA.druid.id);
    expect(circleOfTheMoon?.name).toBe('Circle of the Moon');
    expect(subclassesForClass(CLASSES_DATA.druid.id)).toContainEqual(circleOfTheMoon);
    expect(circleOfTheMoon?.features).toEqual([
      expect.objectContaining({
        id: 'circle_forms',
        name: 'Circle Forms',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Circle Forms absent at level 2 and present at level 3', () => {
    const level2 = createCircleOfTheMoonLevel2();
    const level3 = createCircleOfTheMoonLevel3(level2);
    const level2Features = getCircleOfTheMoonFeatures(level2).map(feature => feature.id);
    const level3Features = getCircleOfTheMoonFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('circle_forms');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('circle_of_the_moon');
    expect(level3Features).toEqual(expect.arrayContaining(['circle_forms']));
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.druid, 3, 'circle_of_the_moon').map(feature => feature.id),
    );
    expect(level3.class.features).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'circle_forms', name: 'Circle Forms' })]),
    );
  });

  it('uses performLevelUp for the explicit level-3 Circle of the Moon choice', () => {
    const level2 = createCircleOfTheMoonLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'circle_of_the_moon' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('circle_of_the_moon');
    expect(productionLevel3.class.features.map(feature => feature.id)).toContain('circle_forms');
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Circle of the Moon Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<CircleOfTheMoonDemo />);

    expect(screen.getByTestId('circle-of-the-moon-level')).toHaveTextContent('2');
    expect(screen.getByTestId('circle-of-the-moon-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('circle-of-the-moon-feature-list')).not.toHaveTextContent('circle_forms');
    expect(screen.getByTestId('circle-of-the-moon-grant-status')).toHaveTextContent('circle_forms');
    expect(screen.getByTestId('circle-of-the-moon-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Circle of the Moon / Level 3' }));
    expect(screen.getByTestId('circle-of-the-moon-level')).toHaveTextContent('3');
    expect(screen.getByTestId('circle-of-the-moon-subclass')).toHaveTextContent('Circle of the Moon');
    expect(screen.getByTestId('circle-of-the-moon-feature-list')).toHaveTextContent('circle_forms');
    expect(screen.getByTestId('circle-of-the-moon-feature-list')).toHaveTextContent('Circle Forms');
    expect(screen.getByTestId('circle-of-the-moon-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('circle-of-the-moon-transition-log')).toHaveTextContent('circle_of_the_moon');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('circle-of-the-moon-level')).toHaveTextContent('2');
    expect(screen.getByTestId('circle-of-the-moon-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('circle-of-the-moon-feature-list')).not.toHaveTextContent('circle_forms');
  });

  it('appends Circle of the Moon after Circle of the Land and resolves it', () => {
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
    expect(getSubclassDemo('druid', 'circle_of_the_moon')?.label).toBe('Circle of the Moon');
    expect(getSubclassDemo('druid', 'circle_of_the_moon')?.Component).toBe(CircleOfTheMoonDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<CircleOfTheMoonDemo />);

    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'no executable subclass-aware Wild Shape transaction',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Challenge Rating limit, AC floor, three-times-level temporary hit points',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Bonus Action transform, form lifecycle, or Moon-specific spellcasting',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Improved Circle Forms (Lunar Radiance or Increased Toughness)',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Moonlight Step resource/teleport/rest transaction',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Lunar Form transaction',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'Generic Wild Shape, generic transformation, action-economy, spell-preparation, spell-slot, temporary-hit-point, teleport, and rest paths are not subclass proof',
    );
    expect(screen.getByTestId('circle-of-the-moon-runtime-boundary')).toHaveTextContent(
      'does not simulate a beast form, CR, AC, temporary HP, Wild Shape use, Bonus Action, prepared spell, radiant damage, saving throw, teleport, resource, or combat result',
    );
    // The boundary may name unsupported outcomes, but it must not claim a fabricated
    // form, resource, temporary-hit-point, teleport, damage, or combat result.
    expect(CIRCLE_OF_THE_MOON_RUNTIME_BOUNDARY).not.toMatch(
      /form active:|uses remaining:|temporary hp granted:|damage dealt:|teleported to:|combat result:/i,
    );
    expect(screen.queryByRole('button', { name: /shape|transform|form|wild|cast|teleport|moonlight/i })).not.toBeInTheDocument();
  });
});
