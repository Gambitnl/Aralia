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
  BerserkerDemo,
  BERSERKER_COMBAT_RUNTIME_BOUNDARY,
  createBerserkerLevel2,
  createBerserkerLevel3,
  getBerserkerFeatures,
} from './BerserkerDemo';

/**
 * This test proves the Berserker leaf against canonical source and production
 * progression, then checks deterministic controls and the honest runtime boundary.
 * Rendered 2D/3D and console proof remain deferred until Rules mounts this domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Berserker canonical progression pipeline', () => {
  it('resolves Path of the Berserker through both canonical subclass helpers', () => {
    const berserker = findSubclass(CLASSES_DATA.barbarian.id, 'berserker');

    expect(berserker?.id).toBe('berserker');
    expect(berserker?.classId).toBe(CLASSES_DATA.barbarian.id);
    expect(berserker?.name).toBe('Path of the Berserker');
    expect(subclassesForClass(CLASSES_DATA.barbarian.id)).toContainEqual(berserker);
    expect(berserker?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'frenzy', name: 'Frenzy', levelAvailable: 3 }),
      ]),
    );
  });

  it('shows frenzy absent at level 2 and canonically granted at level 3', () => {
    const level2 = createBerserkerLevel2();
    const level3 = createBerserkerLevel3(level2);
    const level2Features = getBerserkerFeatures(level2).map(feature => feature.id);
    const level3Features = getBerserkerFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('frenzy');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('berserker');
    expect(level3Features).toContain('frenzy');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.barbarian, 3, 'berserker').map(feature => feature.id),
    );
    expect(level3.class.features).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'frenzy', name: 'Frenzy' })]),
    );
  });

  it('uses performLevelUp for the explicit level-3 Berserker choice', () => {
    const level2 = createBerserkerLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'berserker' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('berserker');
    expect(productionLevel3.class.features.map(feature => feature.id)).toContain('frenzy');
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Berserker Classes-domain registration', () => {
  it('renders level checkpoints, exact feature ids/names, transition log, and Reset', () => {
    render(<BerserkerDemo />);

    expect(screen.getByTestId('berserker-level')).toHaveTextContent('2');
    expect(screen.getByTestId('berserker-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('berserker-feature-list')).toHaveTextContent('rage');
    expect(screen.getByTestId('berserker-feature-list')).toHaveTextContent('danger_sense');
    expect(screen.getByTestId('berserker-feature-list')).not.toHaveTextContent('frenzy');
    expect(screen.getByTestId('berserker-grant-status')).toHaveTextContent('absent');
    expect(screen.getByTestId('berserker-transition-log')).toHaveTextContent('Level 1 → Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Berserker / Level 3' }));
    expect(screen.getByTestId('berserker-level')).toHaveTextContent('3');
    expect(screen.getByTestId('berserker-subclass')).toHaveTextContent('Path of the Berserker');
    expect(screen.getByTestId('berserker-feature-list')).toHaveTextContent('frenzy');
    expect(screen.getByTestId('berserker-feature-list')).toHaveTextContent('Frenzy');
    expect(screen.getByTestId('berserker-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('berserker-transition-log')).toHaveTextContent('berserker');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('berserker-level')).toHaveTextContent('2');
    expect(screen.getByTestId('berserker-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('berserker-feature-list')).not.toHaveTextContent('frenzy');
  });

  it('retains Fighter order and resolves the cumulative three-entry registry', () => {
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
    expect(getSubclassDemo('fighter', 'champion')?.label).toBe('Champion');
    expect(getSubclassDemo('fighter', 'battle_master')?.label).toBe('Battle Master');
    expect(getSubclassDemo('barbarian', 'berserker')?.label).toBe('Path of the Berserker');
  });

  it('shows the exact partial-runtime boundary without fake combat claims', () => {
    render(<BerserkerDemo />);

    expect(screen.getByTestId('berserker-combat-boundary')).toHaveTextContent('partial Rage activation');
    expect(screen.getByTestId('berserker-combat-boundary')).toHaveTextContent('no complete Berserker lifecycle resolver');
    expect(screen.getByTestId('berserker-combat-boundary')).toHaveTextContent('does not simulate');
    expect(BERSERKER_COMBAT_RUNTIME_BOUNDARY).not.toMatch(/resolved damage|combat result|rage toggle/i);
    expect(screen.queryByRole('button', { name: /rage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attack/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/resistance active/i)).not.toBeInTheDocument();
  });
});
