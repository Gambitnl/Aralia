import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  ThiefDemo,
  THIEF_RUNTIME_BOUNDARY,
  createThiefLevel2,
  createThiefLevel3,
  getThiefFeatures,
} from './ThiefDemo';

/**
 * This test proves Rogue Thief from canonical subclass data through the production
 * quick-character and level-up helpers, then checks deterministic controls, registry
 * order, and the exact missing-runtime boundary. Rendered 2D/3D proof remains deferred
 * until the Rules host mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Rogue Thief canonical progression pipeline', () => {
  it('resolves Thief and its exact subclass features', () => {
    const thief = findSubclass(CLASSES_DATA.rogue.id, 'thief');

    expect(thief?.id).toBe('thief');
    expect(thief?.classId).toBe(CLASSES_DATA.rogue.id);
    expect(thief?.name).toBe('Thief');
    expect(subclassesForClass(CLASSES_DATA.rogue.id)).toContainEqual(thief);
    expect(thief?.features).toEqual([
      expect.objectContaining({
        id: 'fast_hands',
        name: 'Fast Hands',
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'second_story_work',
        name: 'Second-Story Work',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Thief features absent at level 2 and present at level 3', () => {
    const level2 = createThiefLevel2();
    const level3 = createThiefLevel3(level2);
    const level2Features = getThiefFeatures(level2).map(feature => feature.id);
    const level3Features = getThiefFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).toContain('cunning_action');
    expect(level2Features).not.toContain('fast_hands');
    expect(level2Features).not.toContain('second_story_work');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('thief');
    expect(level3Features).toEqual(expect.arrayContaining(['fast_hands', 'second_story_work']));
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.rogue, 3, 'thief').map(feature => feature.id),
    );
  });

  it('uses performLevelUp for the explicit level-3 Thief choice', () => {
    const level2 = createThiefLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'thief' },
    );

    expect(createThiefLevel3(level2)).toEqual(productionLevel3);
    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('thief');
  });
});

// ============================================================================
// Deterministic demonstration controls
// ============================================================================
describe('Thief demonstration controls', () => {
  it('shows the canonical transition, exact log, and Reset result', () => {
    render(<ThiefDemo />);

    expect(screen.getByTestId('thief-level')).toHaveTextContent('2');
    expect(screen.getByTestId('thief-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('thief-feature-list')).toHaveTextContent('cunning_action');
    expect(screen.getByTestId('thief-feature-list')).not.toHaveTextContent('fast_hands');
    expect(screen.getByTestId('thief-grant-status')).toHaveTextContent('fast_hands');
    expect(screen.getByTestId('thief-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Thief / Level 3' }));
    expect(screen.getByTestId('thief-level')).toHaveTextContent('3');
    expect(screen.getByTestId('thief-subclass')).toHaveTextContent('Thief');
    expect(screen.getByTestId('thief-feature-list')).toHaveTextContent('fast_hands');
    expect(screen.getByTestId('thief-feature-list')).toHaveTextContent('Fast Hands');
    expect(screen.getByTestId('thief-feature-list')).toHaveTextContent('second_story_work');
    expect(screen.getByTestId('thief-feature-list')).toHaveTextContent('Second-Story Work');
    expect(screen.getByTestId('thief-grant-status')).toHaveTextContent(
      'Canonical grants present: fast_hands - Fast Hands; second_story_work - Second-Story Work.',
    );
    expect(screen.getByTestId('thief-transition-log')).toHaveTextContent(
      "subclassId: 'thief'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('thief-level')).toHaveTextContent('2');
    expect(screen.getByTestId('thief-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('thief-feature-list')).not.toHaveTextContent('fast_hands');
  });
});

// ============================================================================
// Registry and honest runtime boundary
// ============================================================================
describe('Thief registry and runtime boundary', () => {
  it('appends Thief after Beast Master and resolves it', () => {
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
    expect(getSubclassDemo('rogue', 'thief')?.label).toBe('Thief');
    expect(getSubclassDemo('rogue', 'thief')?.Component).toBe(ThiefDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<ThiefDemo />);

    expect(screen.getByTestId('thief-runtime-boundary')).toHaveTextContent(THIEF_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('thief-runtime-boundary')).toHaveTextContent(
      "no subclass-aware production path was found to use a Cunning Action bonus action for Sleight of Hand, thieves' tools, or Use an Object",
    );
    expect(screen.getByTestId('thief-runtime-boundary')).toHaveTextContent(
      "make climbing cost no extra movement or extend the Thief's jump distance",
    );
    expect(screen.getByTestId('thief-runtime-boundary')).toHaveTextContent(
      'Generic Rogue Cunning Dash, free-action economy, and physics jump/climbing helpers prove only generic runtime behavior.',
    );
    expect(screen.getByTestId('thief-runtime-boundary')).toHaveTextContent(
      'does not simulate an object target, tool result, Sleight of Hand check, climbing route, jump distance, movement payment, resource, or combat log outcome',
    );
    expect(screen.queryByRole('button', { name: /object|tool|sleight|climb|jump|movement|combat/i })).not.toBeInTheDocument();
  });
});
