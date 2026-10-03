import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  CollegeOfValorDemo,
  COLLEGE_OF_VALOR_RUNTIME_BOUNDARY,
  createCollegeOfValorLevel2,
  createCollegeOfValorLevel3,
  getCollegeOfValorFeatures,
} from './CollegeOfValorDemo';

/**
 * This test proves College of Valor from canonical subclass data through the
 * production quick-character and level-up helpers, then checks deterministic controls,
 * registry order, and the explicit unsupported runtime boundary. Rendered 2D/3D and
 * console proof remain deferred until Rules mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('College of Valor canonical progression pipeline', () => {
  it('resolves College of Valor through both canonical subclass helpers', () => {
    const collegeOfValor = findSubclass(CLASSES_DATA.bard.id, 'college_of_valor');

    expect(collegeOfValor?.id).toBe('college_of_valor');
    expect(collegeOfValor?.classId).toBe(CLASSES_DATA.bard.id);
    expect(collegeOfValor?.name).toBe('College of Valor');
    expect(subclassesForClass(CLASSES_DATA.bard.id)).toContainEqual(collegeOfValor);
    expect(collegeOfValor?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'combat_inspiration', name: 'Combat Inspiration', levelAvailable: 3 }),
        expect.objectContaining({ id: 'valor_proficiencies', name: 'Martial Training', levelAvailable: 3 }),
      ]),
    );
  });

  it('proves both level-up checkpoints and the exact canonical feature grant', () => {
    const source = createQuickCharacter({
      classId: CLASSES_DATA.bard.id,
      raceId: 'human',
      level: 1,
      name: 'College of Valor Progression Test Source',
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
    expect(level2FeatureIds).not.toContain('combat_inspiration');
    expect(level2FeatureIds).not.toContain('valor_proficiencies');

    // Apply the explicit canonical choice from the level-2 checkpoint.
    const level3 = performLevelUp({ ...level2, xp: 900 }, { subclassId: 'college_of_valor' });
    const level3FeatureIds = classFeaturesForLevel(CLASSES_DATA.bard, level3.level ?? 1, level3.subclassId).map(
      feature => feature.id,
    );
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('college_of_valor');
    expect(level3FeatureIds).toEqual(expect.arrayContaining(['combat_inspiration', 'valor_proficiencies']));
    expect(getCollegeOfValorFeatures(createCollegeOfValorLevel2()).map(feature => feature.id)).not.toContain(
      'combat_inspiration',
    );
    expect(getCollegeOfValorFeatures(createCollegeOfValorLevel3()).map(feature => feature.id)).toEqual(
      expect.arrayContaining(['combat_inspiration', 'valor_proficiencies']),
    );
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('College of Valor Classes-domain registration', () => {
  it('shows the level-2 default, canonical level-3 features, deterministic log, and reset', () => {
    render(<CollegeOfValorDemo />);

    expect(screen.getByTestId('college-of-valor-level')).toHaveTextContent('2');
    expect(screen.getByTestId('college-of-valor-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('college-of-valor-grant-status')).toHaveTextContent(
      'combat_inspiration and valor_proficiencies',
    );
    expect(screen.getByTestId('college-of-valor-transition-log')).toHaveTextContent(
      'Level 1 -> Level 2 via performLevelUp()',
    );
    expect(screen.getByTestId('college-of-valor-feature-list')).not.toHaveTextContent('combat_inspiration');
    expect(screen.getByTestId('college-of-valor-feature-list')).not.toHaveTextContent('valor_proficiencies');

    fireEvent.click(screen.getByRole('button', { name: 'Choose College of Valor / Level 3' }));
    expect(screen.getByTestId('college-of-valor-level')).toHaveTextContent('3');
    expect(screen.getByTestId('college-of-valor-subclass')).toHaveTextContent('College of Valor');
    expect(screen.getByTestId('college-of-valor-feature-list')).toHaveTextContent(
      'combat_inspiration - Combat Inspiration',
    );
    expect(screen.getByTestId('college-of-valor-feature-list')).toHaveTextContent(
      'valor_proficiencies - Martial Training',
    );
    expect(screen.getByTestId('college-of-valor-grant-status')).toHaveTextContent(
      'Canonical grants present: combat_inspiration - Combat Inspiration; valor_proficiencies - Martial Training.',
    );
    expect(screen.getByTestId('college-of-valor-transition-log')).toHaveTextContent(
      "Level 2 -> Level 3 via performLevelUp({ subclassId: 'college_of_valor' })",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Level 2 baseline' }));
    expect(screen.getByTestId('college-of-valor-level')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Choose College of Valor / Level 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('college-of-valor-level')).toHaveTextContent('2');
    expect(screen.getByTestId('college-of-valor-subclass')).toHaveTextContent('None yet');
  });

    it('keeps College of Valor before the Life Domain registration', () => {
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
    expect(getSubclassDemo('bard', 'college_of_valor')?.label).toBe('College of Valor');
    expect(getSubclassDemo('bard', 'college_of_valor')?.Component).toBe(CollegeOfValorDemo);
  });

  it('shows the unsupported boundary without fake runtime controls or outcomes', () => {
    render(<CollegeOfValorDemo />);

    expect(screen.getByTestId('college-of-valor-runtime-boundary')).toHaveTextContent(
      COLLEGE_OF_VALOR_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('college-of-valor-runtime-boundary')).toHaveTextContent(
      'no executable Combat Inspiration resource spend',
    );
    expect(screen.getByTestId('college-of-valor-runtime-boundary')).toHaveTextContent(
      'no subclass-owned application path for medium armor, shields, or martial weapons',
    );
    expect(screen.getByTestId('college-of-valor-runtime-boundary')).toHaveTextContent(
      'generic Bardic Inspiration',
    );
    expect(screen.queryByRole('button', { name: /Combat Inspiration|damage|AC boost|proficienc|equip/i })).not.toBeInTheDocument();
  });
});
