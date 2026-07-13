// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/05/2026, 00:17:36
 * Dependents: components/DesignPreview/steps/PreviewIcons.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface WeaponIcon {
  id: string;
  name: string;
  src: string;
  source: string;
}

/**
 * This file lists every SVG weapon available to the icon registry preview.
 *
 * The weapon folder also contains PNG companions for older image consumers, but
 * this manifest intentionally prefers SVGs because they stay crisp at any review
 * size. PreviewIcons imports this list and turns each entry into a review card.
 */

// ============================================================================
// SVG Weapon Inventory
// ============================================================================
// These identifiers mirror the filenames in public/assets/icons/general/weapons.
// Keeping one compact inventory makes missing or newly added files easy to audit.
// ============================================================================
const WEAPON_ICON_IDS = [
  'amazonensabel',
  'barbaren-axe',
  'barong',
  'baseball-bat',
  'basiliskanzunge',
  'bastardschwert-type-01',
  'bastardschwert-type-02',
  'bastardschwert-type-03',
  'bat',
  'baton',
  'billhook',
  'blowgun',
  'bolo',
  'boronssichel',
  'bowie',
  'brass-knuckles',
  'cane',
  'club-weapon-type-01',
  'club-weapon-type-02',
  'club-weapon-type-03',
  'dart',
  'dolch',
  'doppelkunchomer',
  'elfenbogen',
  'entermesser',
  'flail-weapon',
  'florett-type-01',
  'florett-type-02',
  'golok',
  'grober-sklaventod',
  'hakendolch',
  'hand-crossbow',
  'heavy',
  'heavy-crossbow',
  'hellebarde',
  'katana-type-01',
  'katana-type-02',
  'keule',
  'khunchomer',
  'kompositbogen',
  'kriegsbeil',
  'kukri',
  'langbogen',
  'latin',
  'light-crossbow',
  'mace',
  'morgenstern',
  'nachtwind',
  'nagaika',
  'nunchaku',
  'panga',
  'parang',
  'richtschwert',
  'sabel',
  'schwerer-dolch',
  'sichel',
  'sling',
  'speer',
  'sword',
  'tapanga',
  'trident',
  'war-hammer-type-01',
  'war-hammer-type-02',
  'war-hammer-type-03',
  'war-pick',
  'whip',
  'wolfsmesser',
  'zweihander',
  'zweililien',
] as const;

// Turn filename words into readable card labels while preserving the original
// identifier underneath each card for exact asset lookups.
const toDisplayName = (id: string): string => id
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

// The folder is repository-owned and its individual files do not contain reliable
// per-icon attribution metadata, so the manifest records that boundary honestly.
export const WEAPON_ICONS: WeaponIcon[] = WEAPON_ICON_IDS.map(id => ({
  id,
  name: toDisplayName(id),
  src: `assets/icons/general/weapons/${id}.svg`,
  source: 'repo-owned SVG weapon asset',
}));
