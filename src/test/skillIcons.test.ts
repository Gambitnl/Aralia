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
  SKILL_TW_DND_ICON_MAP,
  getSkillIconSrc,
} from '../utils/skillIcons';

/**
 * This test suite validates that all 18 D&D 5e skills map to valid TW-D&D SVG assets.
 */

describe('Character Skills Icon Mapping', () => {
  const ALL_18_SKILLS = [
    'acrobatics',
    'animal_handling',
    'arcana',
    'athletics',
    'deception',
    'history',
    'insight',
    'intimidation',
    'investigation',
    'medicine',
    'nature',
    'perception',
    'performance',
    'persuasion',
    'religion',
    'sleight_of_hand',
    'stealth',
    'survival',
  ];

  it('maps all 18 D&D 5e skills to TW-D&D SVGs', () => {
    for (const skillId of ALL_18_SKILLS) {
      const src = getSkillIconSrc(skillId);
      expect(src, `Missing skill icon path for ${skillId}`).toBeDefined();
      expect(src).toMatch(/^assets\/icons\/tw-dnd\/skill\/[a-z-]+\.svg$/);
    }
  });

  it('verifies all skill SVG assets exist on disk in public/', () => {
    for (const [key, relPath] of Object.entries(SKILL_TW_DND_ICON_MAP)) {
      const fullPath = path.resolve(process.cwd(), 'public', relPath);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Skill SVG missing for ${key} at ${fullPath}`).toBe(true);
    }
  });

  it('supports formatted names and case-insensitive lookups', () => {
    expect(getSkillIconSrc('Animal Handling')).toBe('assets/icons/tw-dnd/skill/animal-handling.svg');
    expect(getSkillIconSrc('Sleight of Hand')).toBe('assets/icons/tw-dnd/skill/sleight-of-hand.svg');
    expect(getSkillIconSrc('STEALTH')).toBe('assets/icons/tw-dnd/skill/stealth.svg');
    expect(getSkillIconSrc('')).toBeUndefined();
    expect(getSkillIconSrc(undefined)).toBeUndefined();
  });
});
