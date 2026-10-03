import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  BeastMasterDemo,
  BEAST_MASTER_RUNTIME_BOUNDARY,
  createBeastMasterLevel2,
  createBeastMasterLevel3,
  getBeastMasterFeatures,
} from './BeastMasterDemo';

/**
 * This test proves Ranger Beast Master from canonical subclass data through the
 * production quick-character and level-up helpers, then checks deterministic
 * controls, registry order, and the exact missing-runtime boundary. Rendered 2D/3D
 * and console proof remain deferred until Rules mounts the Classes domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Ranger Beast Master canonical progression pipeline', () => {
  it('resolves Beast Master and its exact Primal Companion feature', () => {
    const beastMaster = findSubclass(CLASSES_DATA.ranger.id, 'beast_master');

    expect(beastMaster?.id).toBe('beast_master');
    expect(beastMaster?.classId).toBe(CLASSES_DATA.ranger.id);
    expect(beastMaster?.name).toBe('Beast Master');
    expect(subclassesForClass(CLASSES_DATA.ranger.id)).toContainEqual(beastMaster);
    expect(beastMaster?.features).toEqual([
      expect.objectContaining({
        id: 'primal_companion',
        name: 'Primal Companion',
        levelAvailable: 3,
        description: 'Summon a loyal beast companion that acts on your turn and grows with you.',
      }),
    ]);
  });

  it('shows Primal Companion absent at level 2 and present at level 3', () => {
    const level2 = createBeastMasterLevel2();
    const level3 = createBeastMasterLevel3(level2);
    const level2Features = getBeastMasterFeatures(level2).map(feature => feature.id);
    const level3Features = getBeastMasterFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('primal_companion');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('beast_master');
    expect(level3Features).toEqual(expect.arrayContaining(['primal_companion']));
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.ranger, 3, 'beast_master').map(feature => feature.id),
    );
  });

  it('uses performLevelUp for the explicit level-3 Beast Master choice', () => {
    const level2 = createBeastMasterLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'beast_master' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('beast_master');
    expect(productionLevel3.class.features.map(feature => feature.id)).toContain('primal_companion');
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Ranger Beast Master Classes-domain registration', () => {
  it('renders exact IDs/names, transition log, and Reset across both checkpoints', () => {
    render(<BeastMasterDemo />);

    expect(screen.getByTestId('beast-master-level')).toHaveTextContent('2');
    expect(screen.getByTestId('beast-master-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('beast-master-feature-list')).not.toHaveTextContent('primal_companion');
    expect(screen.getByTestId('beast-master-grant-status')).toHaveTextContent('primal_companion');
    expect(screen.getByTestId('beast-master-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Beast Master / Level 3' }));
    expect(screen.getByTestId('beast-master-level')).toHaveTextContent('3');
    expect(screen.getByTestId('beast-master-subclass')).toHaveTextContent('Beast Master');
    expect(screen.getByTestId('beast-master-feature-list')).toHaveTextContent('primal_companion');
    expect(screen.getByTestId('beast-master-feature-list')).toHaveTextContent('Primal Companion');
    expect(screen.getByTestId('beast-master-grant-status')).toHaveTextContent(
      'Canonical grant present: primal_companion - Primal Companion.',
    );
    expect(screen.getByTestId('beast-master-transition-log')).toHaveTextContent(
      "subclassId: 'beast_master'",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('beast-master-level')).toHaveTextContent('2');
    expect(screen.getByTestId('beast-master-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('beast-master-feature-list')).not.toHaveTextContent('primal_companion');
  });

  it('appends Beast Master after Hunter and resolves it', () => {
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
    expect(getSubclassDemo('ranger', 'beast_master')?.label).toBe('Beast Master');
    expect(getSubclassDemo('ranger', 'beast_master')?.Component).toBe(BeastMasterDemo);
  });

  it('shows the exact partial-runtime boundary without fake output', () => {
    render(<BeastMasterDemo />);

    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      BEAST_MASTER_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      'generic spell-driven summon systems rather than Beast Master runtime',
    );
    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      'bind this Ranger to a Primal Beast, choose Beast of the Land, Sea, or Sky, scale its stat block from the Ranger',
    );
    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      "command its actions and Beast's Strike through the action economy",
    );
    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      'Generic caster ownership and allied team metadata prove only generic summon behavior.',
    );
    expect(screen.getByTestId('beast-master-runtime-boundary')).toHaveTextContent(
      'does not simulate a companion spawn, stat block, scaling, action, bonus action, attack, resource, damage, or combat log outcome',
    );
    expect(screen.queryByRole('button', { name: /summon|command|strike|damage|attack/i })).not.toBeInTheDocument();
  });
});
