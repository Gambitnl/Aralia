// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/08/2026, 01:25:00
 * Dependents: None
 * Imports: 3 files
 */
// @dependencies-end

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CLASS_TW_DND_ICON_MAP,
  getClassIconSrc,
  CLASS_ICON_MAP,
  getClassIcon,
} from '../utils/classIcons';

/**
 * This test suite validates the TW-D&D class icon mapping and asset existence on disk.
 *
 * It checks that every character class maps to an existing SVG in public/assets/icons/tw-dnd/class/
 * and that case-insensitive lookups resolve correctly.
 */

describe('Character Creator Class Icons', () => {
  const CORE_CLASSES = [
    'Artificer',
    'Barbarian',
    'Bard',
    'Cleric',
    'Druid',
    'Fighter',
    'Monk',
    'Paladin',
    'Ranger',
    'Rogue',
    'Sorcerer',
    'Warlock',
    'Wizard',
  ];

  it('maps all 13 D&D 5e classes to TW-D&D SVG assets', () => {
    for (const className of CORE_CLASSES) {
      const src = getClassIconSrc(className);
      expect(src, `Missing TW-D&D icon path for ${className}`).toBeDefined();
      expect(src).toMatch(/^assets\/icons\/tw-dnd\/class\/[a-z]+\.svg$/);
    }
  });

  it('verifies all TW-D&D class SVG assets exist on disk in public/', () => {
    for (const [key, relPath] of Object.entries(CLASS_TW_DND_ICON_MAP)) {
      const fullPath = path.resolve(process.cwd(), 'public', relPath);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Class SVG asset missing for ${key} at ${fullPath}`).toBe(true);
    }
  });

  it('supports case-insensitive and trimmed class name lookups', () => {
    expect(getClassIconSrc('fighter')).toBe('assets/icons/tw-dnd/class/fighter.svg');
    expect(getClassIconSrc('FIGHTER')).toBe('assets/icons/tw-dnd/class/fighter.svg');
    expect(getClassIconSrc('  Wizard  ')).toBe('assets/icons/tw-dnd/class/wizard.svg');
    expect(getClassIconSrc('')).toBeUndefined();
    expect(getClassIconSrc(undefined)).toBeUndefined();
  });

  it('preserves legacy glossary mapping for backwards compatibility', () => {
    expect(getClassIcon('Fighter')).toBe('sword_cross');
    expect(CLASS_ICON_MAP.Fighter).toBe('sword_cross');
    expect(getClassIcon('Wizard')).toBe('fa_hat_wizard');
  });
});
