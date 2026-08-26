// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/08/2026, 02:00:00
 * Dependents: None
 * Imports: 3 files
 */
// @dependencies-end

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ABILITY_TW_DND_ICON_MAP,
  getAbilityScoreIconSrc,
} from '../utils/abilityIcons';

/**
 * This test suite validates that all 6 D&D 5e ability scores map to valid TW-D&D SVG assets.
 */

describe('Character Ability Scores Icon Mapping', () => {
  const ABILITIES = [
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma',
  ];

  it('maps all 6 core ability scores to TW-D&D SVGs', () => {
    for (const ability of ABILITIES) {
      const src = getAbilityScoreIconSrc(ability);
      expect(src, `Missing ability icon path for ${ability}`).toBeDefined();
      expect(src).toMatch(/^assets\/icons\/tw-dnd\/ability\/[a-z]+\.svg$/);
    }
  });

  it('supports standard 3-letter abbreviations', () => {
    expect(getAbilityScoreIconSrc('STR')).toBe('assets/icons/tw-dnd/ability/strength.svg');
    expect(getAbilityScoreIconSrc('DEX')).toBe('assets/icons/tw-dnd/ability/dexterity.svg');
    expect(getAbilityScoreIconSrc('CON')).toBe('assets/icons/tw-dnd/ability/constitution.svg');
    expect(getAbilityScoreIconSrc('INT')).toBe('assets/icons/tw-dnd/ability/intelligence.svg');
    expect(getAbilityScoreIconSrc('WIS')).toBe('assets/icons/tw-dnd/ability/wisdom.svg');
    expect(getAbilityScoreIconSrc('CHA')).toBe('assets/icons/tw-dnd/ability/charisma.svg');
  });

  it('verifies all ability SVG assets exist on disk in public/', () => {
    for (const [key, relPath] of Object.entries(ABILITY_TW_DND_ICON_MAP)) {
      const fullPath = path.resolve(process.cwd(), 'public', relPath);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Ability SVG missing for ${key} at ${fullPath}`).toBe(true);
    }
  });
});
