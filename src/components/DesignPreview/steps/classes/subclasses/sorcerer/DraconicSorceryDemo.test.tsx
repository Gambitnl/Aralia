import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { getAbilityModifierValue } from '../../../../../../utils/character/statUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  createDraconicSorceryLevel2,
  createDraconicSorceryLevel3,
  DraconicSorceryDemo,
  DRACONIC_SORCERY_RUNTIME_BOUNDARY,
  getDraconicSorceryFeatures,
  getDraconicSorceryNativeAudit,
} from './DraconicSorceryDemo';

/**
 * This test proves Draconic Sorcery from canonical subclass data through the
 * production quick-character, level-up, and persistent-player-to-combat helpers.
 * It also checks the deterministic AC/HP transaction, stale cumulative registry
 * order, Reset, and the exact remaining ancestry/affinity/spell-list boundary.
 * Rendered 2D/3D proof remains deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Sorcerer Draconic Sorcery canonical progression pipeline', () => {
  it('resolves the exact subclass id and canonical features', () => {
    const draconic = findSubclass(CLASSES_DATA.sorcerer.id, 'draconic');

    expect(draconic?.id).toBe('draconic');
    expect(draconic?.classId).toBe(CLASSES_DATA.sorcerer.id);
    expect(draconic?.name).toBe('Draconic Sorcery');
    expect(subclassesForClass(CLASSES_DATA.sorcerer.id)).toContainEqual(draconic);
    expect(draconic?.features).toEqual([
      expect.objectContaining({
        id: 'draconic_resilience',
        name: 'Draconic Resilience',
        levelAvailable: 3,
      }),
      expect.objectContaining({
        id: 'draconic_spells',
        name: 'Draconic Spells',
        levelAvailable: 3,
      }),
    ]);
    expect(draconic?.features[0]?.description).toContain('10 + Dex + Cha');
  });

  it('shows Draconic Sorcery features absent at level 2 and present after the explicit level-3 choice', () => {
    const level2 = createDraconicSorceryLevel2();
    const level3 = createDraconicSorceryLevel3(level2);
    const level2Features = getDraconicSorceryFeatures(level2).map(feature => feature.id);
    const level3Features = getDraconicSorceryFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('draconic_resilience');
    expect(level2Features).not.toContain('draconic_spells');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('draconic');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.sorcerer, 3, 'draconic').map(feature => feature.id),
    );
  });

  it('uses production level-up and preserves the same fixture for the explicit choice', () => {
    const level2 = createDraconicSorceryLevel2();
    const level3 = createDraconicSorceryLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'draconic' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('draconic');
  });
});

// ============================================================================
// Native Draconic Resilience transaction proof
// ============================================================================
describe('Draconic Sorcery native AC and HP transaction', () => {
  it('derives AC and HP only after the level-3 subclass binding', () => {
    const level2 = createDraconicSorceryLevel2();
    const level3 = createDraconicSorceryLevel3(level2);
    const level2Audit = getDraconicSorceryNativeAudit(level2);
    const level3Audit = getDraconicSorceryNativeAudit(level3);
    const dexterityModifier = getAbilityModifierValue(level2.finalAbilityScores.Dexterity);
    const charismaModifier = getAbilityModifierValue(level2.finalAbilityScores.Charisma);

    expect(level2Audit.combatArmorClass).toBe(10 + dexterityModifier);
    expect(level2Audit.draconicResilienceApplied).toBe(false);
    expect(level3Audit.combatArmorClass).toBe(10 + dexterityModifier + charismaModifier);
    expect(level3Audit.combatBaseArmorClass).toBe(level3Audit.combatArmorClass);
    expect(level3Audit.draconicResilienceApplied).toBe(true);
    // Level-up itself adds the Sorcerer's normal hit-die HP. The native subclass
    // conversion must add exactly one more character level on top of that growth.
    expect(level2Audit.combatMaxHpBonus).toBe(0);
    expect(level2Audit.combatCurrentHpBonus).toBe(0);
    expect(level3Audit.combatMaxHpBonus).toBe(3);
    expect(level3Audit.combatCurrentHpBonus).toBe(3);
    expect(level3Audit.combatMaxHp - level2Audit.combatMaxHp).toBe(
      level3.maxHp - level2.maxHp + 3,
    );
    expect(level3Audit.combatCurrentHp - level2Audit.combatCurrentHp).toBe(
      level3.hp - level2.hp + 3,
    );
  });

  it('does not invent ancestry, elemental affinity, resistance, or Draconic Spells entries', () => {
    const audit = getDraconicSorceryNativeAudit(createDraconicSorceryLevel3());

    expect(audit.ancestrySelection).toBeUndefined();
    expect(audit.elementalAffinity).toBeUndefined();
    expect(audit.resistances).toEqual([]);
    expect(audit.spellbookIds).toEqual(expect.any(Array));
    expect(audit.spellbookIds).not.toContain('draconic_spells');
  });
});

// ============================================================================
// Deterministic controls, cumulative registry, and honest boundary
// ============================================================================
describe('Draconic Sorcery Classes-domain registration', () => {
  it('renders canonical facts, native audit output, transition log, and Reset', () => {
    render(<DraconicSorceryDemo />);

    expect(screen.getByTestId('draconic-level')).toHaveTextContent('2');
    expect(screen.getByTestId('draconic-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('draconic-feature-list')).not.toHaveTextContent('draconic_resilience');
    expect(screen.getByTestId('draconic-resilience-audit')).toHaveTextContent('Not applied');
    expect(screen.getByTestId('draconic-ancestry-audit')).toHaveTextContent('No Sorcerer ancestry selection');
    expect(screen.getByTestId('draconic-affinity-audit')).toHaveTextContent('No subclass-bound affinity');
    expect(screen.getByTestId('draconic-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Draconic / Level 3' }));
    expect(screen.getByTestId('draconic-level')).toHaveTextContent('3');
    expect(screen.getByTestId('draconic-subclass')).toHaveTextContent('Draconic Sorcery');
    expect(screen.getByTestId('draconic-feature-list')).toHaveTextContent('draconic_resilience');
    expect(screen.getByTestId('draconic-feature-list')).toHaveTextContent('draconic_spells');
    expect(screen.getByTestId('draconic-resilience-audit')).toHaveTextContent('Applied: 10 + Dex + Cha');
    expect(screen.getByTestId('draconic-hp-audit')).toHaveTextContent('(current');
    expect(screen.getByTestId('draconic-transition-log')).toHaveTextContent("subclassId: 'draconic'");

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('draconic-level')).toHaveTextContent('2');
    expect(screen.getByTestId('draconic-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('draconic-feature-list')).not.toHaveTextContent('draconic_resilience');
  });

  it('appends Draconic Sorcery after the existing Shadow registration', () => {
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
    expect(getSubclassDemo('sorcerer', 'draconic')?.label).toBe('Draconic Sorcery');
    expect(getSubclassDemo('sorcerer', 'draconic')?.Component).toBe(DraconicSorceryDemo);
  });

  it('shows only the proven remaining runtime boundary', () => {
    render(<DraconicSorceryDemo />);

    expect(screen.getByTestId('draconic-runtime-boundary')).toHaveTextContent(
      DRACONIC_SORCERY_RUNTIME_BOUNDARY,
    );
    expect(screen.getByTestId('draconic-runtime-boundary')).toHaveTextContent(
      'does not currently define an ancestry choice, elemental affinity, damage type, or concrete Draconic Spells list',
    );
    expect(screen.getByTestId('draconic-runtime-boundary')).toHaveTextContent(
      'does not simulate an elemental damage roll, ancestry selection, resistance, or bonus-spell preparation',
    );
    expect(screen.queryByRole('button', { name: /damage|ancestry|affinity|resistance|spell/i })).not.toBeInTheDocument();
  });
});
