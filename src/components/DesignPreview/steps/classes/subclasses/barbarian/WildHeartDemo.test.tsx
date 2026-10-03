import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { applyImmediateAbilityTurnEffects } from '../../../../../../hooks/combat/useActionExecutor';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { ResistanceCalculator } from '../../../../../../utils/combat/resistanceUtils';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import {
  getSubclassDemo,
  SUBCLASS_DEMO_REGISTRY,
} from '../..';
import { WildHeartDemo, createWildHeartCombatCharacter } from './WildHeartDemo';

// Keep the existing canonical transaction test focused on the class leaf. The
// real BattleMap/BattleMap3D bridge has its own focused test and mounted proof.
vi.mock('../../ClassBattlefieldDemo', () => ({
  default: ({ character }: { character: { statusEffects: Array<{ name: string }> } }) => (
    <div data-testid="wild-heart-battlefield-demo-test-double">
      {character.statusEffects.map(status => status.name).join(',') || 'Not raging'}
    </div>
  ),
}));

/**
 * This test proves the Wild Heart leaf from canonical subclass data through the
 * production combat factory, Rage executor, resistance calculator, and rendered
 * controls. Rendered 2D/3D and console proof remain deferred until Rules mounts this
 * domain, as required by the Classes orchestration contract.
 */

// ============================================================================
// Canonical source and native combat transaction proof
// ============================================================================
describe('Wild Heart canonical combat pipeline', () => {
  it('resolves the canonical subclass and feature through both subclass helpers', () => {
    const wildHeart = findSubclass(CLASSES_DATA.barbarian.id, 'wild_heart');

    expect(wildHeart?.id).toBe('wild_heart');
    expect(wildHeart?.classId).toBe(CLASSES_DATA.barbarian.id);
    expect(wildHeart?.name).toBe('Path of the Wild Heart');
    expect(subclassesForClass(CLASSES_DATA.barbarian.id)).toContainEqual(wildHeart);
    expect(wildHeart?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rage_of_the_wilds', name: 'Rage of the Wilds', levelAvailable: 3 }),
      ]),
    );
  });

  it('assembles a canonical level-3 player and converts it through production combat', () => {
    const source = createQuickCharacter({
      classId: CLASSES_DATA.barbarian.id,
      raceId: 'human',
      level: 3,
      name: 'Wild Heart Rage Tester',
      useRecommendedStats: true,
    });
    const wildHeart = findSubclass(CLASSES_DATA.barbarian.id, 'wild_heart');

    expect(source).not.toBeNull();
    expect(wildHeart).toBeDefined();
    const combatCharacter = createPlayerCombatCharacter({
      ...source!,
      class: CLASSES_DATA.barbarian,
      subclassId: wildHeart!.id,
    });

    expect(combatCharacter.class).toBe(CLASSES_DATA.barbarian);
    expect(combatCharacter.level).toBe(3);
    expect(combatCharacter.abilities.find(ability => ability.id === 'rage')?.tags).toContain('wild_heart_bear');
    expect(createWildHeartCombatCharacter()).toMatchObject({ level: 3 });
  });

  it('finds the exact production Rage ability with the Bear Spirit tag', () => {
    const character = createWildHeartCombatCharacter();
    const rage = character.abilities.find(ability => ability.id === 'rage');

    expect(rage).toMatchObject({ id: 'rage', name: 'Rage (Bear Spirit)' });
    expect(rage?.tags).toEqual(['wild_heart_bear']);
  });

  it('runs native Rage activation and native resistance calculations', () => {
    const baseline = createWildHeartCombatCharacter();
    const rage = baseline.abilities.find(ability => ability.id === 'rage');

    expect(rage).toBeDefined();
    const result = applyImmediateAbilityTurnEffects(baseline, rage!, 1);
    const raging = result.character.statusEffects.find(status => status.id === 'raging');

    expect(raging?.name).toBe('Raging (Bear Spirit)');
    expect(raging?.modifiers?.resistance).toContain('fire');
    expect(raging?.modifiers?.resistance).not.toContain('psychic');
    expect(result.followUpLogs).toHaveLength(1);
    expect(result.followUpLogs[0]?.message).toMatch(/flies into a Rage/i);
    expect(ResistanceCalculator.applyResistances(10, 'fire', result.character)).toBe(5);
    expect(ResistanceCalculator.applyResistances(10, 'psychic', result.character)).toBe(10);
  });
});

// ============================================================================
// Deterministic controls, registry, and scope proof
// ============================================================================
describe('Wild Heart Classes-domain registration', () => {
  it('defaults to baseline, activates Bear Rage, shows returned facts, and resets', () => {
    render(<WildHeartDemo />);

    expect(screen.getByTestId('wild-heart-feature')).toHaveTextContent('rage_of_the_wilds');
    expect(screen.getByTestId('wild-heart-feature')).toHaveTextContent('Rage of the Wilds');
    expect(screen.getByTestId('wild-heart-rage-tag')).toHaveTextContent('wild_heart_bear');
    expect(screen.getByTestId('wild-heart-raging-status')).toHaveTextContent('Not raging');
    expect(screen.getByTestId('wild-heart-resistance-list')).toHaveTextContent('None');
    expect(screen.getByTestId('wild-heart-fire-result')).toHaveTextContent('10 → 10');
    expect(screen.getByTestId('wild-heart-psychic-result')).toHaveTextContent('10 → 10');
    expect(screen.getByTestId('wild-heart-production-log')).toHaveTextContent('No production Rage event yet');

    fireEvent.click(screen.getByRole('button', { name: 'Activate Bear Rage' }));
    expect(screen.getByTestId('wild-heart-raging-status')).toHaveTextContent('Raging (Bear Spirit)');
    expect(screen.getByTestId('wild-heart-resistance-list')).toHaveTextContent('fire');
    expect(screen.getByTestId('wild-heart-resistance-list')).toHaveTextContent('radiant');
    expect(screen.getByTestId('wild-heart-resistance-list')).not.toHaveTextContent('psychic');
    expect(screen.getByTestId('wild-heart-fire-result')).toHaveTextContent('10 → 5');
    expect(screen.getByTestId('wild-heart-psychic-result')).toHaveTextContent('10 → 10');
    expect(screen.getByTestId('wild-heart-production-log')).toHaveTextContent('flies into a Rage');

    fireEvent.click(screen.getByRole('button', { name: 'Baseline (not raging)' }));
    expect(screen.getByTestId('wild-heart-raging-status')).toHaveTextContent('Not raging');
    expect(screen.getByTestId('wild-heart-fire-result')).toHaveTextContent('10 → 10');

    fireEvent.click(screen.getByRole('button', { name: 'Activate Bear Rage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('wild-heart-raging-status')).toHaveTextContent('Not raging');
    expect(screen.getByTestId('wild-heart-resistance-list')).toHaveTextContent('None');
  });

  it('appends Wild Heart after Champion, Battle Master, and Berserker in registry order', () => {
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
    expect(getSubclassDemo('barbarian', 'wild_heart')?.label).toBe('Path of the Wild Heart');
  });

  it('exposes the current Bear-only runtime boundary without fake variant controls', () => {
    render(<WildHeartDemo />);

    expect(screen.getByTestId('wild-heart-scope')).toHaveTextContent('Bear Spirit tag and resistance path only');
    expect(screen.getByTestId('wild-heart-scope')).toHaveTextContent('no Eagle or Wolf variant controls');
    expect(screen.queryByRole('button', { name: /eagle|wolf/i })).not.toBeInTheDocument();
  });
});
