import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  AssassinDemo,
  ASSASSIN_RUNTIME_BOUNDARY,
  createAssassinLevel2,
  createAssassinLevel3,
  getAssassinFeatures,
} from './AssassinDemo';

/**
 * This test proves Rogue Assassin from canonical subclass data through the production
 * quick-character and level-up helpers. It also checks deterministic controls, the
 * sequential registry append, and the exact missing-runtime boundary. Rendered 2D/3D
 * proof remains deferred until the Rules host mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Rogue Assassin canonical progression pipeline', () => {
  it('resolves Assassin and its exact subclass features', () => {
    const assassin = findSubclass(CLASSES_DATA.rogue.id, 'assassin');

    expect(assassin?.id).toBe('assassin');
    expect(assassin?.classId).toBe(CLASSES_DATA.rogue.id);
    expect(assassin?.name).toBe('Assassin');
    expect(subclassesForClass(CLASSES_DATA.rogue.id)).toContainEqual(assassin);
    expect(assassin?.features).toEqual([
      expect.objectContaining({
        id: 'assassinate',
        name: 'Assassinate',
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'assassins_tools',
        name: "Assassin's Tools",
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Assassin features absent at level 2 and present at level 3', () => {
    const level2 = createAssassinLevel2();
    const level3 = createAssassinLevel3(level2);
    const level2Features = getAssassinFeatures(level2).map(feature => feature.id);
    const level3Features = getAssassinFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toContain('cunning_action');
    expect(level2Features).not.toContain('assassinate');
    expect(level2Features).not.toContain('assassins_tools');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('assassin');
    expect(level3Features).toEqual(expect.arrayContaining(['assassinate', 'assassins_tools']));
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.rogue, 3, 'assassin').map(feature => feature.id),
    );
  });

  it('uses performLevelUp for the explicit level-3 Assassin choice', () => {
    const level2 = createAssassinLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'assassin' },
    );

    expect(createAssassinLevel3(level2)).toEqual(productionLevel3);
    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('assassin');
  });
});

// ============================================================================
// Deterministic demonstration controls
// ============================================================================
describe('Assassin demonstration controls', () => {
  it('shows the canonical transition, exact log, and Reset result', () => {
    render(<AssassinDemo />);

    expect(screen.getByTestId('assassin-level')).toHaveTextContent('2');
    expect(screen.getByTestId('assassin-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('assassin-feature-list')).toHaveTextContent('cunning_action');
    expect(screen.getByTestId('assassin-feature-list')).not.toHaveTextContent('assassinate');
    expect(screen.getByTestId('assassin-grant-status')).toHaveTextContent('assassinate');
    expect(screen.getByTestId('assassin-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Assassin / Level 3' }));
    expect(screen.getByTestId('assassin-level')).toHaveTextContent('3');
    expect(screen.getByTestId('assassin-subclass')).toHaveTextContent('Assassin');
    expect(screen.getByTestId('assassin-feature-list')).toHaveTextContent('assassinate');
    expect(screen.getByTestId('assassin-feature-list')).toHaveTextContent('Assassinate');
    expect(screen.getByTestId('assassin-feature-list')).toHaveTextContent('assassins_tools');
    expect(screen.getByTestId('assassin-feature-list')).toHaveTextContent("Assassin's Tools");
    expect(screen.getByTestId('assassin-grant-status')).toHaveTextContent(
      "Canonical grants present: assassinate - Assassinate; assassins_tools - Assassin's Tools.",
    );
    expect(screen.getByTestId('assassin-transition-log')).toHaveTextContent(
      "subclassId: 'assassin'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('assassin-level')).toHaveTextContent('2');
    expect(screen.getByTestId('assassin-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('assassin-feature-list')).not.toHaveTextContent('assassinate');
  });
});

// ============================================================================
// Registry and honest runtime boundary
// ============================================================================
describe('Assassin registry and runtime boundary', () => {
  it('appends Assassin after Thief and resolves it', () => {
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
    expect(getSubclassDemo('rogue', 'assassin')?.label).toBe('Assassin');
    expect(getSubclassDemo('rogue', 'assassin')?.Component).toBe(AssassinDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<AssassinDemo />);

    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      ASSASSIN_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      'grants advantage against a foe who has not acted',
    );
    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      'makes a hit against a surprised creature an automatic critical',
    );
    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      "grants and validates the disguise-kit and poisoner's-kit proficiencies",
    );
    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      'Generic stealth, advantage, critical-hit, initiative, poison, puzzle, and crafting helpers prove only separate behavior.',
    );
    expect(screen.getByTestId('assassin-runtime-boundary')).toHaveTextContent(
      'does not simulate a roll, damage, initiative state, surprise flag, target result, tool check, proficiency result, resource, or combat log outcome',
    );
    expect(screen.queryByRole('button', { name: /attack|roll|damage|initiative|surprise|tool|poison/i })).not.toBeInTheDocument();
  });
});
