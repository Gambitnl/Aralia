/**
 * This test file verifies weapon proficiency rules and warning indicators across the character system.
 *
 * In D&D 5e / Aralia, characters can equip weapons even if they lack proficiency with them,
 * but attacking with a non-proficient weapon imposes severe penalties: the character cannot
 * add their proficiency bonus to attack rolls and cannot activate weapon mastery properties.
 *
 * Tested modules:
 * - weaponUtils.ts (isWeaponProficient, isWeaponMartial)
 * - defense.ts (canEquipItem weapon warning verification)
 * - Attack ability & penalty mechanics
 */

import { describe, it, expect } from 'vitest';
import { ItemType } from '../../../types';
import { isWeaponProficient, isWeaponMartial } from '../weaponUtils';
import { canEquipItem } from '../defense';
import { createMockPlayerCharacter, createMockItem } from '../../core/factories';
import { PlayerCharacter, Item } from '../../../types';

// ============================================================================
// Core Weapon Proficiency Detection Tests
// ============================================================================
// Verifies that characters with different classes, proficiencies, and training
// are accurately evaluated as proficient or non-proficient with specific weapons.
// ============================================================================

describe('Weapon Proficiency Verification', () => {
  describe('Class-based weapon proficiencies', () => {
    // A wizard only has training with simple weapons or specific wizard weapons.
    // Equipping a martial heavy weapon (Greatsword) must report as not proficient.
    it('detects when a Wizard equips a non-proficient Greatsword', () => {
      const wizard = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
        } as any,
      });

      const greatsword = createMockItem({
        id: 'greatsword',
        name: 'Greatsword',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
        damageDice: '2d6',
      });

      expect(isWeaponProficient(wizard, greatsword)).toBe(false);
    });

    // A wizard equipping a simple dagger they are trained with must report as proficient.
    it('detects when a Wizard equips a proficient Dagger', () => {
      const wizard = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
        } as any,
      });

      const dagger = createMockItem({
        id: 'dagger',
        name: 'Dagger',
        type: ItemType.Weapon,
        category: 'Simple Weapons',
        damageDice: '1d4',
      });

      expect(isWeaponProficient(wizard, dagger)).toBe(true);
    });

    // A fighter is trained in all simple and martial weapons.
    // They should be proficient with both Greatswords and Shortbows.
    it('detects that a Fighter is proficient with both Martial and Simple weapons', () => {
      const fighter = createMockPlayerCharacter({
        class: {
          id: 'fighter',
          name: 'Fighter',
          weaponProficiencies: ['Simple weapons', 'Martial weapons'],
        } as any,
      });

      const greatsword = createMockItem({
        id: 'greatsword',
        name: 'Greatsword',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      const shortbow = createMockItem({
        id: 'shortbow',
        name: 'Shortbow',
        type: ItemType.Weapon,
        category: 'Simple Weapons',
      });

      expect(isWeaponProficient(fighter, greatsword)).toBe(true);
      expect(isWeaponProficient(fighter, shortbow)).toBe(true);
    });

    // A rogue has specific martial proficiencies (like Rapiers and Hand Crossbows),
    // but lacks blanket martial proficiency (so a Greataxe is not proficient).
    it('handles selective martial weapon proficiencies like a Rogue', () => {
      const rogue = createMockPlayerCharacter({
        class: {
          id: 'rogue',
          name: 'Rogue',
          weaponProficiencies: ['Simple weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
        } as any,
      });

      const rapier = createMockItem({
        id: 'rapier',
        name: 'Rapier',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      const greataxe = createMockItem({
        id: 'greataxe',
        name: 'Greataxe',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(rogue, rapier)).toBe(true);
      expect(isWeaponProficient(rogue, greataxe)).toBe(false);
    });
  });

  // ============================================================================
  // Multi-Source Proficiencies (Racial, Feats, Multiclass)
  // ============================================================================
  // Characters can gain weapon training from their heritage (e.g. Elf Weapon Training),
  // feats (Weapon Master), top-level custom proficiencies, or multiclassing.
  // ============================================================================

  describe('Multi-source weapon proficiencies', () => {
    // High Elves gain racial proficiency with Longswords, Shortswords, Shortbows, and Longbows
    // even if their class is a Wizard.
    it('grants weapon proficiency from racial modifiers (Elf Weapon Training)', () => {
      const elfWizard = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Daggers', 'Quarterstaffs'],
        } as any,
        modifiers: {
          weaponProficiencies: ['Longsword', 'Shortsword', 'Shortbow', 'Longbow'],
        } as any,
      });

      const longsword = createMockItem({
        id: 'longsword',
        name: 'Longsword',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      const halberd = createMockItem({
        id: 'halberd',
        name: 'Halberd',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(elfWizard, longsword)).toBe(true);
      expect(isWeaponProficient(elfWizard, halberd)).toBe(false);
    });

    // Top-level character proficiencies granted by feats or story training.
    it('grants weapon proficiency from character top-level proficiencies', () => {
      const wizardWithFeat = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Simple weapons'],
        } as any,
        weaponProficiencies: ['Greatsword', 'Heavy Crossbow'],
      });

      const greatsword = createMockItem({
        id: 'greatsword',
        name: 'Greatsword',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(wizardWithFeat, greatsword)).toBe(true);
    });

    // Multiclass characters inherit proficiencies from secondary classes.
    it('grants weapon proficiency from multiclass list', () => {
      const multiclassChar = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Simple weapons'],
        } as any,
        classes: [
          { id: 'fighter', name: 'Fighter', weaponProficiencies: ['Martial weapons'] } as any,
        ],
      });

      const greatsword = createMockItem({
        id: 'greatsword',
        name: 'Greatsword',
        type: ItemType.Weapon,
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(multiclassChar, greatsword)).toBe(true);
    });
  });

  // ============================================================================
  // Category Aliases and Blanket Training
  // ============================================================================
  // Supports short form aliases like 'Simple', 'Martial', 'All', 'All weapons'.
  // ============================================================================

  describe('Category aliases and blanket proficiencies', () => {
    it('recognizes short-form "Simple" and "Martial" category strings', () => {
      const martialChar = createMockPlayerCharacter({
        class: {
          id: 'warrior',
          weaponProficiencies: ['Simple', 'Martial'],
        } as any,
      });

      const martialWeapon = createMockItem({
        type: ItemType.Weapon,
        category: 'Martial Weapons',
        name: 'Halberd',
      });

      const simpleWeapon = createMockItem({
        type: ItemType.Weapon,
        category: 'Simple Weapons',
        name: 'Spear',
      });

      expect(isWeaponProficient(martialChar, martialWeapon)).toBe(true);
      expect(isWeaponProficient(martialChar, simpleWeapon)).toBe(true);
    });

    it('recognizes blanket "All Weapons" proficiency', () => {
      const avatar = createMockPlayerCharacter({
        class: {
          id: 'deity',
          weaponProficiencies: ['All weapons'],
        } as any,
      });

      const exoticWeapon = createMockItem({
        type: ItemType.Weapon,
        category: 'Martial Weapons',
        name: 'Glaive',
      });

      expect(isWeaponProficient(avatar, exoticWeapon)).toBe(true);
    });
  });

  // ============================================================================
  // Name Matching, Suffixes, and Edge Cases
  // ============================================================================
  // Verifies magical weapon names, singular/plural normalization, and guard clauses.
  // ============================================================================

  describe('Name matching and edge cases', () => {
    it('matches magical weapon variants with suffixes (e.g. Longsword +1)', () => {
      const char = createMockPlayerCharacter({
        class: {
          weaponProficiencies: ['Longsword'],
        } as any,
      });

      const magicLongsword = createMockItem({
        type: ItemType.Weapon,
        name: 'Longsword +1',
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(char, magicLongsword)).toBe(true);
    });

    it('returns false for non-weapon items even if category text matches', () => {
      const fighter = createMockPlayerCharacter({
        class: { weaponProficiencies: ['Martial weapons'] } as any,
      });

      const potion = createMockItem({
        type: ItemType.Consumable,
        name: 'Martial Elixir',
        category: 'Martial Weapons',
      });

      expect(isWeaponProficient(fighter, potion)).toBe(false);
    });

    it('handles null, undefined, or empty characters gracefully', () => {
      const weapon = createMockItem({ type: ItemType.Weapon, name: 'Dagger' });
      expect(isWeaponProficient(null as unknown as PlayerCharacter, weapon)).toBe(false);
      expect(isWeaponProficient(undefined as unknown as PlayerCharacter, weapon)).toBe(false);
      expect(isWeaponProficient(createMockPlayerCharacter(), null as unknown as Item)).toBe(false);
    });
  });

  // ============================================================================
  // canEquipItem Defense & Equipment Validation Integration
  // ============================================================================
  // Verifies that canEquipItem allows equipping non-proficient weapons (per 5e rules)
  // while returning a clear warning reason with "Not Proficient — No Proficiency Bonus to Attacks".
  // ============================================================================

  describe('canEquipItem integration', () => {
    it('allows equipping a non-proficient weapon with a clear penalty warning reason', () => {
      const wizard = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          weaponProficiencies: ['Simple weapons'],
        } as any,
      });

      const greatsword = createMockItem({
        id: 'greatsword-1',
        name: 'Greatsword',
        type: ItemType.Weapon,
        slot: 'MainHand',
        category: 'Martial Weapons',
        damageDice: '2d6',
      });

      const equipCheck = canEquipItem(wizard, greatsword);

      // In 5e, equipping non-proficient weapons is allowed (can: true)
      expect(equipCheck.can).toBe(true);
      // Must provide the clear warning reason
      expect(equipCheck.reason).toBeDefined();
      expect(equipCheck.reason).toContain('Not Proficient — No Proficiency Bonus to Attacks');
      expect(equipCheck.reason).toContain('Martial weapons');
    });

    it('allows equipping a proficient weapon without any warning reason', () => {
      const fighter = createMockPlayerCharacter({
        class: {
          id: 'fighter',
          name: 'Fighter',
          weaponProficiencies: ['Simple weapons', 'Martial weapons'],
        } as any,
      });

      const greatsword = createMockItem({
        id: 'greatsword-1',
        name: 'Greatsword',
        type: ItemType.Weapon,
        slot: 'MainHand',
        category: 'Martial Weapons',
        damageDice: '2d6',
      });

      const equipCheck = canEquipItem(fighter, greatsword);

      expect(equipCheck.can).toBe(true);
      expect(equipCheck.reason).toBeUndefined();
    });

    it('blocks equipping non-proficient armor while allowing non-proficient weapons', () => {
      const wizard = createMockPlayerCharacter({
        class: {
          id: 'wizard',
          name: 'Wizard',
          armorProficiencies: [],
          weaponProficiencies: ['Simple weapons'],
        } as any,
      });

      const plateArmor = createMockItem({
        id: 'plate_armor',
        name: 'Plate Armor',
        type: ItemType.Armor,
        slot: 'Torso',
        armorCategory: 'Heavy',
        baseArmorClass: 18,
      });

      const equipCheck = canEquipItem(wizard, plateArmor);
      // Armor proficiency is strictly enforced and blocks equipping
      expect(equipCheck.can).toBe(false);
      expect(equipCheck.reason).toContain('Not proficient with Heavy armor');
    });
  });
});
