import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { getSubclassDemo, SUBCLASS_DEMO_REGISTRY } from '../..';
import {
  ARCANE_ARMOR_CONTRACT,
  ARMORER_RUNTIME_BOUNDARY,
  ArmorerDemo,
  createArmorerLevel2,
  createArmorerLevel3,
  getArmorerFeatures,
  getArmorerNativeAudit,
} from './ArmorerDemo';

/**
 * This test proves the Armorer leaf from canonical subclass data through production
 * character creation, level-up, and player-to-combat conversion. It audits both
 * Guardian and Infiltrator contracts and rejects generic equipment as proof.
 * Rendered 2D/3D and console proof remain deferred until the Rules host mounts Classes.
 */

// ============================================================================
// Canonical source and progression proof
// ============================================================================
describe('Artificer Armorer canonical progression pipeline', () => {
  it('resolves the exact subclass id, name, and Arcane Armor feature', () => {
    const armorer = findSubclass(CLASSES_DATA.artificer.id, 'armorer');

    expect(armorer?.id).toBe('armorer');
    expect(armorer?.classId).toBe(CLASSES_DATA.artificer.id);
    expect(armorer?.name).toBe('Armorer');
    expect(subclassesForClass(CLASSES_DATA.artificer.id)).toContainEqual(armorer);
    expect(armorer?.features).toEqual([
      expect.objectContaining({
        id: 'arcane_armor',
        name: 'Arcane Armor',
        levelAvailable: 3,
      }),
    ]);
  });

  it('shows Arcane Armor only after the explicit level-3 Armorer choice', () => {
    const level2 = createArmorerLevel2();
    const level3 = createArmorerLevel3(level2);
    const level2Features = getArmorerFeatures(level2).map(feature => feature.id);
    const level3Features = getArmorerFeatures(level3).map(feature => feature.id);

    expect(level2.level).toBe(2);
    expect(level2.subclassId).toBeUndefined();
    expect(level2Features).not.toContain('arcane_armor');
    expect(level3.level).toBe(3);
    expect(level3.subclassId).toBe('armorer');
    expect(level3Features).toEqual(
      classFeaturesForLevel(CLASSES_DATA.artificer, 3, 'armorer').map(feature => feature.id),
    );
    expect(level3Features).toContain('arcane_armor');
  });

  it('uses production level-up for the explicit level-3 Armorer choice', () => {
    const level2 = createArmorerLevel2();
    const level3 = createArmorerLevel3(level2);
    const productionLevel3 = performLevelUp(
      { ...level2, xp: 900 },
      { subclassId: 'armorer' },
    );

    expect(level3).toEqual(productionLevel3);
    expect(level3.finalAbilityScores).toEqual(level2.finalAbilityScores);
    expect(level3.equippedItems).toEqual(level2.equippedItems);
    expect(level3.subclassId).toBe('armorer');
  });
});

// ============================================================================
// Native Arcane Armor boundary
// ============================================================================
describe('Armorer native Arcane Armor boundary', () => {
  it('records the Arcane Armor, Guardian, Infiltrator, resource, and reset contract', () => {
    expect(ARCANE_ARMOR_CONTRACT).toEqual({
      armor: 'Turn a suit of armor you are wearing into Arcane Armor as an action while holding smiths tools.',
      heavyArmor: 'Gain proficiency with heavy armor at the Armorer level-3 choice.',
      spellcastingFocus: 'Use the Arcane Armor as a spellcasting focus for Artificer spells.',
      donDoff: 'Arcane Armor attaches to you, ignores its Strength requirement, and can be donned or doffed as an action.',
      guardian: {
        name: 'Guardian',
        attack: 'Thunder Gauntlets are melee weapon attacks that deal 1d8 thunder damage and mark a hit creature against attacks on other targets until your next turn.',
        defensiveField: 'Defensive Field is a bonus action that grants temporary hit points equal to your proficiency bonus.',
        resource: 'Defensive Field has a number of uses equal to your proficiency bonus and refreshes on a Long Rest.',
      },
      infiltrator: {
        name: 'Infiltrator',
        attack: 'Lightning Launcher is a ranged weapon attack with 90/300 range, 1d6 lightning damage, and one extra 1d6 hit each turn.',
        stealth: 'Powered Steps increases walking speed by 5 feet and grants advantage on Stealth checks.',
      },
      reset: 'A Long Rest restores the Armorer model resource; the Arcane Armor bond ends when another suit is donned or the Armorer dies.',
    });
  });

  it('rejects generic equipment and confirms no native Guardian or Infiltrator transaction', () => {
    const level2Audit = getArmorerNativeAudit(createArmorerLevel2());
    const guardianAudit = getArmorerNativeAudit(createArmorerLevel3(), 'guardian');
    const infiltratorAudit = getArmorerNativeAudit(createArmorerLevel3(), 'infiltrator');

    expect(level2Audit.combatClassId).toBe('artificer');
    expect(guardianAudit.combatClassId).toBe('artificer');
    expect(infiltratorAudit.combatClassId).toBe('artificer');
    // The production quick-character fixture starts empty. Its absence of generic
    // equipment makes the negative subclass audit stricter, not weaker.
    expect(guardianAudit.hasGenericWornArmor).toBe(false);
    expect(guardianAudit.hasGenericWeaponAttack).toBe(false);
    expect(guardianAudit.maxArmorProficiency).toBe('medium');
    expect(guardianAudit.hasHeavyArmorProficiency).toBe(false);
    expect(guardianAudit.hasArcaneArmorAbility).toBe(false);
    expect(guardianAudit.hasArcaneArmorState).toBe(false);
    expect(guardianAudit.hasGuardianWeaponAttack).toBe(false);
    expect(guardianAudit.hasInfiltratorWeaponAttack).toBe(false);
    expect(guardianAudit.hasDefensiveFieldAbility).toBe(false);
    expect(guardianAudit.hasGuardianTempHpPath).toBe(false);
    expect(infiltratorAudit.hasInfiltratorStealthPath).toBe(false);
    expect(guardianAudit.hasDonDoffResolver).toBe(false);
    expect(guardianAudit.hasModelResource).toBe(false);
    expect(guardianAudit.hasLongRestResetResolver).toBe(false);
    expect(guardianAudit.genericEquipmentOrWeaponProof).toBe(false);
  });
});

// ============================================================================
// Deterministic controls and registry proof
// ============================================================================
describe('Armorer Classes-domain registration', () => {
  it('renders canonical facts, both model contracts, the native audit, and Reset', () => {
    render(<ArmorerDemo />);

    expect(screen.getByTestId('armorer-level')).toHaveTextContent('2');
    expect(screen.getByTestId('armorer-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('armorer-feature-list')).not.toHaveTextContent('arcane_armor');
    expect(screen.getByTestId('armorer-heavy-armor-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('armorer-model-attack-audit')).toHaveTextContent('Thunder Gauntlets not bound');
    expect(screen.getByTestId('armorer-temp-hp-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('armorer-stealth-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('armorer-don-doff-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('armorer-resource-reset-audit')).toHaveTextContent('Not bound');
    expect(screen.getByTestId('armorer-generic-audit')).toHaveTextContent('Rejected as proof');
    expect(screen.getByTestId('armorer-transition-log')).toHaveTextContent('Level 1 -> Level 2');

    fireEvent.click(screen.getByRole('button', { name: 'Choose Armorer / Level 3' }));
    expect(screen.getByTestId('armorer-level')).toHaveTextContent('3');
    expect(screen.getByTestId('armorer-subclass')).toHaveTextContent('Armorer');
    expect(screen.getByTestId('armorer-feature-list')).toHaveTextContent('arcane_armor');
    expect(screen.getByTestId('armorer-grant-status')).toHaveTextContent('Canonical grant present');
    expect(screen.getByTestId('armorer-transition-log')).toHaveTextContent("subclassId: 'armorer'");

    fireEvent.click(screen.getByRole('button', { name: 'Infiltrator model' }));
    expect(screen.getByTestId('armorer-model')).toHaveTextContent('Infiltrator');
    expect(screen.getByTestId('armorer-model-attack-audit')).toHaveTextContent('Lightning Launcher not bound');

    // Model selection is metadata only. No unsupported attack, field, stealth,
    // equip, resource, or reset transaction is exposed by this leaf.
    expect(screen.queryAllByRole('button', { name: /attack|field|stealth|equip|resource|don|doff|grant|cast/i })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('armorer-level')).toHaveTextContent('2');
    expect(screen.getByTestId('armorer-subclass')).toHaveTextContent('None yet');
    expect(screen.getByTestId('armorer-model')).toHaveTextContent('Guardian');
    expect(screen.getByTestId('armorer-feature-list')).not.toHaveTextContent('arcane_armor');
  });

  it('appends Armorer directly after Alchemist in the final registry', () => {
    expect(SUBCLASS_DEMO_REGISTRY).toHaveLength(26);
    expect(SUBCLASS_DEMO_REGISTRY.map(registration => registration.subclassId).slice(-4)).toEqual([
      'evocation',
      'abjuration',
      'alchemist',
      'armorer',
    ]);
    expect(getSubclassDemo('artificer', 'armorer')?.label).toBe('Armorer');
    expect(getSubclassDemo('artificer', 'armorer')?.Component).toBe(ArmorerDemo);
  });

  it('shows the exact partial-runtime boundary without fake Armorer controls', () => {
    render(<ArmorerDemo />);

    expect(screen.getByTestId('armorer-runtime-boundary')).toHaveTextContent(ARMORER_RUNTIME_BOUNDARY);
    expect(screen.getByTestId('armorer-runtime-boundary')).toHaveTextContent(
      'no Arcane Armor ability or bonded state, heavy armor proficiency grant',
    );
    expect(screen.getByTestId('armorer-runtime-boundary')).toHaveTextContent(
      'Thunder Gauntlets attack, Guardian Defensive Field temporary-hit-point path, Infiltrator Lightning Launcher attack',
    );
    expect(screen.getByTestId('armorer-runtime-boundary')).toHaveTextContent(
      'Generic worn armor, generic weapon attacks, base medium armor and simple-weapon proficiency',
    );
    expect(screen.queryAllByRole('button', { name: /attack|field|stealth|equip|resource|don|doff|grant|cast/i })).toHaveLength(0);
  });
});
