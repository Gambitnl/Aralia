// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/08/2026, 01:00:00
 * Dependents: None
 * Imports: 2 files
 */
// @dependencies-end

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  TW_DND_ICONS,
  TW_DND_CATEGORIES,
  TW_DND_CATEGORY_METADATA,
} from '../assets/icons/twDndIcons';

/**
 * This test suite validates the integrity of the TW-D&D vendor icon collection.
 *
 * It checks that every registered icon maps to a real SVG or PNG asset on disk,
 * that every category is documented with metadata, and that all IDs are strictly unique.
 */

describe('TW-D&D Vendor Icon Inventory', () => {
  it('contains exactly 318 curated icons across 24 categories', () => {
    expect(TW_DND_ICONS.length).toBe(318);
    expect(Object.keys(TW_DND_CATEGORIES).length).toBe(24);
    expect(TW_DND_CATEGORY_METADATA.length).toBe(24);
  });

  it('guarantees unique IDs for all icons', () => {
    const idSet = new Set<string>();
    for (const icon of TW_DND_ICONS) {
      expect(idSet.has(icon.id)).toBe(false);
      idSet.add(icon.id);
    }
    expect(idSet.size).toBe(318);
  });

  it('verifies every icon file exists on disk in public/assets/icons/tw-dnd/', () => {
    for (const icon of TW_DND_ICONS) {
      const diskPath = path.resolve(process.cwd(), 'public', icon.src);
      const exists = fs.existsSync(diskPath);
      expect(exists, `Missing asset for ${icon.id} at ${diskPath}`).toBe(true);
    }
  });

  it('verifies category metadata count matches actual icon lists', () => {
    for (const meta of TW_DND_CATEGORY_METADATA) {
      const list = TW_DND_CATEGORIES[meta.label];
      expect(list, `Missing category list for ${meta.label}`).toBeDefined();
      expect(list.length).toBe(meta.count);
    }
  });
});
