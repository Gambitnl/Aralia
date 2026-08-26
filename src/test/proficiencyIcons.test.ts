// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/08/2026, 15:30:00
 * Dependents: None
 * Imports: 3 files
 */
// @dependencies-end

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  PROFICIENCY_TW_DND_ICON_MAP,
  getProficiencyIconSrc,
} from '../utils/proficiencyIcons';

/**
 * This test suite validates that all proficiency levels (unskilled, half, proficient, expertise)
 * map to valid TW-D&D SVG assets.
 */

describe('Character Proficiency Icons Mapping', () => {
  it('maps all standard proficiency tiers to TW-D&D SVGs', () => {
    expect(getProficiencyIconSrc('unskilled')).toBe('assets/icons/tw-dnd/proficiency/unskilled.svg');
    expect(getProficiencyIconSrc('half')).toBe('assets/icons/tw-dnd/proficiency/half.svg');
    expect(getProficiencyIconSrc('proficient')).toBe('assets/icons/tw-dnd/proficiency/proficient.svg');
    expect(getProficiencyIconSrc('expertise')).toBe('assets/icons/tw-dnd/proficiency/expertise.svg');
  });

  it('supports numerical and boolean shorthand values', () => {
    expect(getProficiencyIconSrc(0)).toBe('assets/icons/tw-dnd/proficiency/unskilled.svg');
    expect(getProficiencyIconSrc(0.5)).toBe('assets/icons/tw-dnd/proficiency/half.svg');
    expect(getProficiencyIconSrc(1)).toBe('assets/icons/tw-dnd/proficiency/proficient.svg');
    expect(getProficiencyIconSrc(2)).toBe('assets/icons/tw-dnd/proficiency/expertise.svg');
    expect(getProficiencyIconSrc(true)).toBe('assets/icons/tw-dnd/proficiency/proficient.svg');
    expect(getProficiencyIconSrc(false)).toBe('assets/icons/tw-dnd/proficiency/unskilled.svg');
  });

  it('verifies all proficiency SVG assets exist on disk in public/', () => {
    for (const [key, relPath] of Object.entries(PROFICIENCY_TW_DND_ICON_MAP)) {
      const fullPath = path.resolve(process.cwd(), 'public', relPath);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Proficiency SVG missing for ${key} at ${fullPath}`).toBe(true);
    }
  });
});
