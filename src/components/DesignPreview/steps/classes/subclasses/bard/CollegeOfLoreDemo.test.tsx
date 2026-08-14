import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  CollegeOfLoreDemo,
  COLLEGE_OF_LORE_RUNTIME_BOUNDARY,
  createCollegeOfLoreLevel2,
  createCollegeOfLoreLevel3,
  getCollegeOfLoreFeatures,
} from './CollegeOfLoreDemo';

/**
 * This test proves College of Lore from canonical subclass data through the
 * production quick-character and level-up helpers, then checks deterministic controls,
 * registry order, and the explicit unsupported runtime boundary. Rendered 2D/3D and
 * console proof remain deferred until Rules mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('College of Lore canonical progression pipeline', () => {
  it('resolves College of Lore through both canonical subclass helpers', () => {
    const collegeOfLore = findSubclass(CLASSES_DATA.bard.id, 'college_of_lore');

    expect(collegeOfLore?.id).toBe('college_of_lore');
    expect(collegeOfLore?.classId).toBe(CLASSES_DATA.bard.id);
    expect(collegeOfLore?.name).toBe('College of Lore');
    expect(subclassesForClass(CLASSES_DATA.bard.id)).toContainEqual(collegeOfLore);
    expect(collegeOfLore?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'cutting_words', name: 'Cutting Words', levelAvailable: 3 }),
        expect.objectContaining({ id: 'bonus_proficiencies_lore', name: 'Bonus Proficiencies', levelAvailable: 3 }),
      ]),
    );
  });

  it('proves both level-up checkpoints and the exact canonical feature grant', () => {
    const source = createQuickCharacter({
      classId: CLASSES_DATA.bard.id,
      raceId: 'human',
      level: 1,
      name: 'College of Lore Progression Test Source',
      useRecommendedStats: true,
    });

    expect(source).not.toBeNull();

    // Build the same level-2 checkpoint directly through the production function.
    const level2 = performLevelUp({ ...source!, xp: 900 }, {});
    const level2FeatureIds = classFeaturesForLevel(CLASSES_DATA.bard, level2.level ?? 1, level2.subclassId).map(
      feature => feature.id,
    );
    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2FeatureIds).not.toContain('cutting_words');
    expect(level2FeatureIds).not.toContain('bonus_proficiencies_lore');

    // Apply the explicit canonical choice from the level-2 checkpoint.
    const level3 = performLevelUp({ ...level2, xp: 900 }, { subclassId: 'college_of_lore' });
    const level3FeatureIds = classFeaturesForLevel(CLASSES_DATA.bard, level3.level ?? 1, level3.subclassId).map(
      feature => feature.id,
    );
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('college_of_lore');
    expect(level3FeatureIds).toEqual(expect.arrayContaining(['cutting_words', 'bonus_proficiencies_lore']));
    expect(getCollegeOfLoreFeatures(createCollegeOfLoreLevel2()).map(feature => feature.id)).not.toContain(
      'cutting_words',
    );
    expect(getCollegeOfLoreFeatures(createCollegeOfLoreLevel3()).map(feature => feature.id)).toEqual(
      expect.arrayContaining(['cutting_words', 'bonus_proficiencies_lore']),
    );
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('College of Lore Classes-domain registration', () => {
  it('shows the level-2 default, canonical level-3 features, deterministic log, and reset', () => {
    render(<CollegeOfLoreDemo />);

    expect(screen.getByTestId('college-of-lore-level')).toHaveTextContent('2');
    expect(screen.getByTestId('college-of-lore-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('college-of-lore-grant-status')).toHaveTextContent(
      'cutting_words and bonus_proficiencies_lore',
    );
    expect(screen.getByTestId('college-of-lore-transition-log')).toHaveTextContent(
      'Level 1 → Level 2 via performLevelUp()',
    );
    expect(screen.getByTestId('college-of-lore-feature-list')).not.toHaveTextContent('cutting_words');
    expect(screen.getByTestId('college-of-lore-feature-list')).not.toHaveTextContent('bonus_proficiencies_lore');

    fireEvent.click(screen.getByRole('button', { name: 'Choose College of Lore / Level 3' }));
    expect(screen.getByTestId('college-of-lore-level')).toHaveTextContent('3');
    expect(screen.getByTestId('college-of-lore-subclass')).toHaveTextContent('College of Lore');
    expect(screen.getByTestId('college-of-lore-feature-list')).toHaveTextContent('cutting_words — Cutting Words');
    expect(screen.getByTestId('college-of-lore-feature-list')).toHaveTextContent(
      'bonus_proficiencies_lore — Bonus Proficiencies',
    );
    expect(screen.getByTestId('college-of-lore-grant-status')).toHaveTextContent(
      'Canonical grants present: cutting_words — Cutting Words; bonus_proficiencies_lore — Bonus Proficiencies.',
    );
    expect(screen.getByTestId('college-of-lore-transition-log')).toHaveTextContent(
      "Level 2 → Level 3 via performLevelUp({ subclassId: 'college_of_lore' })",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Level 2 baseline' }));
    expect(screen.getByTestId('college-of-lore-level')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Choose College of Lore / Level 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('college-of-lore-level')).toHaveTextContent('2');
    expect(screen.getByTestId('college-of-lore-subclass')).toHaveTextContent('None yet');
  });

  it('appends College of Lore after the four existing registrations', () => {
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
    expect(getSubclassDemo('bard', 'college_of_lore')?.label).toBe('College of Lore');
    expect(getSubclassDemo('bard', 'college_of_lore')?.Component).toBe(CollegeOfLoreDemo);
  });

  it('shows the unsupported boundary without fake runtime controls or outcomes', () => {
    render(<CollegeOfLoreDemo />);

    expect(screen.getByTestId('college-of-lore-runtime-boundary')).toHaveTextContent(
      COLLEGE_OF_LORE_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('college-of-lore-runtime-boundary')).toHaveTextContent(
      'no complete character-combat path',
    );
    expect(screen.getByTestId('college-of-lore-runtime-boundary')).toHaveTextContent(
      'No subclass-driven state path was found for choosing and granting three skills',
    );
    expect(screen.queryByRole('button', { name: /Cutting Words|reaction|subtract|skill/i })).not.toBeInTheDocument();
  });
});
