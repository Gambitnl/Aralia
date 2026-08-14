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
  BattleMasterDemo,
  createBattleMasterLevel2,
  createBattleMasterLevel3,
  getBattleMasterFeatures,
} from './BattleMasterDemo';

/**
 * This test proves the Battle Master leaf against canonical source and production
 * progression, then checks its deterministic controls and honest runtime boundary.
 * Rendered 2D/3D and console proof remain deferred until Rules mounts this domain.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Battle Master canonical progression pipeline', () => {
  it('resolves Battle Master through both canonical subclass helpers', () => {
    const battleMaster = findSubclass(CLASSES_DATA.fighter.id, 'battle_master');

    expect(battleMaster?.id).toBe('battle_master');
    expect(battleMaster?.classId).toBe(CLASSES_DATA.fighter.id);
    expect(battleMaster?.name).toBe('Battle Master');
    expect(subclassesForClass(CLASSES_DATA.fighter.id)).toContainEqual(battleMaster);
    expect(battleMaster?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'combat_superiority', name: 'Combat Superiority', levelAvailable: 3 }),
      ]),
    );
  });

  it('shows combat_superiority absent at level 2 and canonically granted at level 3', () => {
    const level2 = createBattleMasterLevel2();
    const level3 = createBattleMasterLevel3(level2);
    const level2Features = getBattleMasterFeatures(level2).map(feature => feature.id);
    const level3Features = getBattleMasterFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('combat_superiority');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('battle_master');
    expect(level3Features).toContain('combat_superiority');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.fighter, 3, 'battle_master').map(feature => feature.id),
    );
  });

  it('uses performLevelUp for the explicit level-3 choice rather than UI-only state', () => {
    const level2 = createBattleMasterLevel2();
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'battle_master' },
    );

    expect(productionLevel3.level).toBe(3);
    expect(productionLevel3.subclassId).toBe('battle_master');
    expect(productionLevel3.class.features.map(feature => feature.id)).toContain('combat_superiority');
  });
});

// ============================================================================
// Deterministic controls, registry, and boundary proof
// ============================================================================
describe('Battle Master Classes-domain registration', () => {
  it('renders the level checkpoints, exact feature ids/names, transition log, and reset', () => {
    render(<BattleMasterDemo />);

    expect(screen.getByTestId('battle-master-level')).toHaveTextContent('2');
    expect(screen.getByTestId('battle-master-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('battle-master-feature-list')).toHaveTextContent('second_wind');
    expect(screen.getByTestId('battle-master-feature-list')).not.toHaveTextContent('combat_superiority');
    expect(screen.getByTestId('battle-master-grant-status')).toHaveTextContent('absent');
    expect(screen.getByTestId('battle-master-transition-log')).toHaveTextContent('Level 1 → Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Battle Master / Level 3' }));
    expect(screen.getByTestId('battle-master-level')).toHaveTextContent('3');
    expect(screen.getByTestId('battle-master-subclass')).toHaveTextContent('Battle Master');
    expect(screen.getByTestId('battle-master-feature-list')).toHaveTextContent('combat_superiority');
    expect(screen.getByTestId('battle-master-feature-list')).toHaveTextContent('Combat Superiority');
    expect(screen.getByTestId('battle-master-grant-status')).toHaveTextContent('present');
    expect(screen.getByTestId('battle-master-transition-log')).toHaveTextContent('battle_master');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('battle-master-level')).toHaveTextContent('2');
    expect(screen.getByTestId('battle-master-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('battle-master-feature-list')).not.toHaveTextContent('combat_superiority');
  });

  it('keeps Champion and Battle Master registrations together without fake runtime output', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(getSubclassDemo('fighter', 'champion')?.label).toBe('Champion');
    expect(getSubclassDemo('fighter', 'battle_master')?.label).toBe('Battle Master');
    expect(getSubclassDemo('fighter', 'battle_master')?.description).toContain('canonical level-3 progression');

    render(<BattleMasterDemo />);
    expect(screen.getByTestId('battle-master-combat-boundary')).toHaveTextContent('no character-combat maneuver');
    expect(screen.getByTestId('battle-master-combat-boundary')).toHaveTextContent('does not simulate dice');
    expect(screen.queryByText(/superiority dice available/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /maneuver/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/attack outcome/i)).not.toBeInTheDocument();
  });
});
