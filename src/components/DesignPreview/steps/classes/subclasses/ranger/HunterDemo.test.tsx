import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  createHunterLevel2,
  createHunterLevel3,
  getHunterFeatures,
  HUNTER_RUNTIME_BOUNDARY,
  HunterDemo,
} from './HunterDemo';

/**
 * This test proves Ranger Hunter from canonical subclass data through the production
 * quick-character and level-up helpers, then checks deterministic controls, registry
 * order, and the exact missing-runtime boundary. Rendered 2D/3D and console proof
 * remain deferred until Rules mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Ranger Hunter canonical progression pipeline', () => {
  it("resolves Hunter and its exact Hunter's Prey feature", () => {
    const hunter = findSubclass(CLASSES_DATA.ranger.id, 'hunter');

    expect(hunter?.id).toBe('hunter');
    expect(hunter?.classId).toBe(CLASSES_DATA.ranger.id);
    expect(hunter?.name).toBe('Hunter');
    expect(subclassesForClass(CLASSES_DATA.ranger.id)).toContainEqual(hunter);
    expect(hunter?.features).toEqual([
      expect.objectContaining({
        id: 'hunters_prey',
        name: "Hunter's Prey",
        levelAvailable: 3,
        description: 'Choose Colossus Slayer, Giant Killer, or Horde Breaker to punish your foes.',
      }),
    ]);
  });

  it('shows Hunter’s Prey absent at level 2 and present at level 3', () => {
    const level2 = createHunterLevel2();
    const level3 = createHunterLevel3(level2);
    const level2Features = getHunterFeatures(level2).map(feature => feature.id);
    const level3Features = getHunterFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('hunters_prey');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('hunter');
    expect(level3Features).toEqual(expect.arrayContaining(['hunters_prey']));
    expect(level3Features).toEqual(classFeaturesForLevel(CLASSES_DATA.ranger, 3, 'hunter').map(feature => feature.id));
  });

  it('uses performLevelUp for the explicit level-3 Hunter choice', () => {
    const level2 = createHunterLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'hunter' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('hunter');
    expect(productionLevel3.class.features.map(feature => feature.id)).toContain('hunters_prey');
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Ranger Hunter Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<HunterDemo />);

    expect(screen.getByTestId('hunter-level')).toHaveTextContent('2');
    expect(screen.getByTestId('hunter-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('hunter-feature-list')).not.toHaveTextContent('hunters_prey');
    expect(screen.getByTestId('hunter-grant-status')).toHaveTextContent('hunters_prey');
    expect(screen.getByTestId('hunter-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Hunter / Level 3' }));
    expect(screen.getByTestId('hunter-level')).toHaveTextContent('3');
    expect(screen.getByTestId('hunter-subclass')).toHaveTextContent('Hunter');
    expect(screen.getByTestId('hunter-feature-list')).toHaveTextContent('hunters_prey');
    expect(screen.getByTestId('hunter-feature-list')).toHaveTextContent("Hunter's Prey");
    expect(screen.getByTestId('hunter-grant-status')).toHaveTextContent(
      'Canonical grant present: hunters_prey - Hunter\'s Prey.',
    );
    expect(screen.getByTestId('hunter-transition-log')).toHaveTextContent("subclassId: 'hunter'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('hunter-level')).toHaveTextContent('2');
    expect(screen.getByTestId('hunter-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('hunter-feature-list')).not.toHaveTextContent('hunters_prey');
  });

  it('appends Hunter after Circle of the Moon and resolves it', () => {
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
    expect(getSubclassDemo('ranger', 'hunter')?.label).toBe('Hunter');
    expect(getSubclassDemo('ranger', 'hunter')?.Component).toBe(HunterDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<HunterDemo />);

    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(HUNTER_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'no subclass-aware production path was found',
    );
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'Colossus Slayer once-per-turn extra damage against a target below maximum HP',
    );
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'Giant Killer reaction attack',
    );
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'Horde Breaker multi-target attack transaction',
    );
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'Generic attack riders, once-per-turn limits, target HP fields, and authored Multiattack helpers are not Hunter proof.',
    );
    expect(screen.getByTestId('hunter-runtime-boundary')).toHaveTextContent(
      'does not simulate a Prey choice, damage, attack, reaction, action, target HP change, resource, multi-target result, or combat log outcome',
    );
    expect(screen.queryByRole('button', { name: /prey|damage|attack|reaction|target|combat/i })).not.toBeInTheDocument();
  });
});
