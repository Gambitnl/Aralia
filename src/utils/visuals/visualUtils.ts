// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/05/2026, 15:10:43
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, utils/visualUtils.ts, utils/visuals/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/visualUtils.ts
 * Utility functions for resolving visual assets for game entities.
 * Implements the "Pipeline" part of the Asset Requirement Standards.
 */

import { NPC, Race, Item } from '../../types';
import { NPCVisualSpec, VisualAsset, ItemVisualSpec } from '../../types/visuals';

const GENERAL_ARMOR_ICON_PATH = 'assets/icons/general/armor/';
const GENERAL_WEAPON_ICON_PATH = 'assets/icons/general/weapons/';
const LEGACY_WEAPON_ICON_PATHS = [
  'assets/icons/figma-weapons/512-2-color/',
  'assets/icons/figma-weapons/512-2-color-svg/',
  'assets/icons/figma-weapons/custom-svg/',
];

const ARMOR_ICON_BY_ITEM_ID: Record<string, string> = {
  leather_cap: 'leather_cap.svg',
  chainmail_coif: 'chainmail_coif.svg',
  steel_helmet: 'steel_helmet.svg',
  leather_gloves: 'leather_gloves.svg',
  chainmail_gauntlets: 'chainmail_gauntlets.svg',
  plate_gauntlets: 'plate_gauntlets.svg',
  cloth_pants: 'cloth_pants.svg',
  leather_greaves: 'leather_greaves.svg',
  plate_greaves: 'plate_greaves.svg',
  soft_boots: 'soft_boots.svg',
  studded_boots: 'studded_boots.svg',
  steel_boots: 'steel_boots.svg',
  leather_bracers: 'leather_bracers.svg',
  reinforced_bracers: 'reinforced_bracers.svg',
  padded_armor: 'padded_armor.svg',
  leather_armor: 'leather_armor.svg',
  studded_leather_armor: 'studded_leather_armor.svg',
  hide_armor: 'hide_armor.svg',
  chain_shirt: 'chain_shirt.svg',
  scale_mail: 'scale_mail.svg',
  breastplate: 'breastplate.svg',
  half_plate_armor: 'half_plate_armor.svg',
  ring_mail: 'ring_mail.svg',
  chain_mail: 'chain_mail.svg',
  splint_armor: 'splint_armor.svg',
  plate_armor: 'plate_armor.svg',
  shield_std: 'shield_std.svg',
  shield_plus_one: 'shield_plus_one.svg',
};

// Older saved inventories can hold weapon records that only have an emoji in
// `item.icon`. This table mirrors the current weapon registry so those records
// can still use restored SVG art without rewriting the saved item data.
const WEAPON_ICON_BY_ITEM_ID: Record<string, string> = {
  club: 'club-weapon-type-01.svg',
  dagger: 'dolch.svg',
  greatclub: 'club-weapon-type-03.svg',
  handaxe: 'kriegsbeil.svg',
  javelin: 'speer.svg',
  light_hammer: 'war-hammer-type-01.svg',
  mace: 'mace.svg',
  quarterstaff: 'baton.svg',
  sickle: 'sichel.svg',
  spear: 'speer.svg',
  dart: 'dart.svg',
  light_crossbow: 'light-crossbow.svg',
  shortbow: 'kompositbogen.svg',
  sling: 'sling.svg',
  battleaxe: 'kriegsbeil.svg',
  flail: 'flail-weapon.svg',
  glaive: 'hellebarde.svg',
  greataxe: 'barbaren-axe.svg',
  greatsword: 'bastardschwert-type-03.svg',
  halberd: 'hellebarde.svg',
  lance: 'speer.svg',
  longsword: 'sword.svg',
  maul: 'war-hammer-type-03.svg',
  morningstar: 'morgenstern.svg',
  pike: 'speer.svg',
  rapier: 'florett-type-01.svg',
  scimitar: 'sabel.svg',
  shortsword: 'sword.svg',
  trident: 'trident.svg',
  warhammer: 'war-hammer-type-02.svg',
  war_pick: 'war-pick.svg',
  whip: 'whip.svg',
  blowgun: 'blowgun.svg',
  longbow: 'langbogen.svg',
  hand_crossbow: 'hand-crossbow.svg',
  heavy_crossbow: 'heavy-crossbow.svg',
  rusty_sword: 'sabel.svg',
};

/**
 * Saved games can keep full item objects from older sessions. When those item
 * records still point at an older weapon icon folder, upgrade only that known
 * path family at display time and leave future/custom asset paths untouched.
 */
function normalizeItemIconPath(iconPath: string): string {
  for (const legacyPath of LEGACY_WEAPON_ICON_PATHS) {
    if (iconPath.includes(legacyPath)) {
      return iconPath
        .replace(legacyPath, GENERAL_WEAPON_ICON_PATH)
        .replace(/\.png$/i, '.svg');
    }
  }

  return iconPath;
}

/**
 * Resolves the visual representation for an NPC, handling fallbacks.
 *
 * @param npc - The NPC entity
 * @param visualSpec - Optional specific visual spec (if attached to NPC or separate)
 * @param race - Optional race data for additional context
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export function resolveNPCVisual(
  npc: NPC,
  visualSpec?: NPCVisualSpec,
  _race?: Race
): VisualAsset {
  // Resolve spec: use argument if provided, otherwise check the NPC object
  const spec = visualSpec || npc.visual;

  // 1. Try to use specific portrait path
  if (spec?.portraitPath) {
    return {
      src: spec.portraitPath,
      fallbackContent: spec.fallbackIcon || getRoleEmoji(npc.role),
      primaryColor: spec.themeColor || getRoleColor(npc.role),
      label: spec.description || `${npc.name} the ${npc.role}`
    };
  }

  // 2. Try to use AI-generated portrait URL (if we had one on the spec, but currently mapped to path)
  // (Future expansion: check for base64 data)

  // 3. Fallback to Role/Race based visual
  const emoji = spec?.fallbackIcon || getRoleEmoji(npc.role);
  const color = spec?.themeColor || getRoleColor(npc.role);

  return {
    fallbackContent: emoji,
    primaryColor: color,
    secondaryColor: '#1f2937', // dark gray
    label: `${npc.name} (${npc.role})`
  };
}

/**
 * Resolves the visual representation for an Item, handling legacy icons and fallbacks.
 *
 * @param item - The item entity
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export function resolveItemVisual(item: Item): VisualAsset {
  // 1. Try to use explicit visual spec if present
  if (item.visual?.iconPath) {
    const iconPath = normalizeItemIconPath(item.visual.iconPath);

    return {
      src: iconPath,
      fallbackContent: item.visual.fallbackIcon || item.icon || '📦',
      primaryColor: getItemRarityColor(item.visual.rarity),
      label: item.name
    };
  }

  // 2. Try to use legacy icon if it looks like a path
  if (item.icon && (item.icon.startsWith('/') || item.icon.startsWith('http') || item.icon.startsWith('data:'))) {
    return {
      src: item.icon,
      fallbackContent: '📦',
      primaryColor: '#9ca3af', // gray-400
      label: item.name
    };
  }

  // 3. Already-loaded saves and test-party inventories can contain older
  // emoji-only armor records. If the item id now has a general armor SVG, prefer
  // that image while keeping the original emoji/text as fallback content.
  const armorIconFileName = ARMOR_ICON_BY_ITEM_ID[item.id];
  if (armorIconFileName) {
    return {
      src: `${GENERAL_ARMOR_ICON_PATH}${armorIconFileName}`,
      fallbackContent: item.icon || 'box',
      primaryColor: '#9ca3af',
      label: item.name
    };
  }

  // 4. Already-loaded saves and test-party inventories can also contain older
  // emoji-only weapon records. Prefer the curated weapon image where available.
  const weaponIconFileName = WEAPON_ICON_BY_ITEM_ID[item.id];
  if (weaponIconFileName) {
    return {
      src: `${GENERAL_WEAPON_ICON_PATH}${weaponIconFileName}`,
      fallbackContent: item.icon || 'box',
      primaryColor: '#9ca3af',
      label: item.name
    };
  }

  // 5. Use legacy icon as fallback content (emoji/text) if not a path
  // If no icon at all, default to box
  return {
    fallbackContent: item.icon || '📦',
    primaryColor: '#9ca3af', // gray-400
    label: item.name
  };
}

/**
 * Helper to get border color based on item rarity.
 */
function getItemRarityColor(rarity?: ItemVisualSpec['rarity']): string {
  switch (rarity) {
    case 'common': return '#9ca3af'; // gray-400
    case 'uncommon': return '#10b981'; // emerald-500
    case 'rare': return '#3b82f6'; // blue-500
    case 'very_rare': return '#8b5cf6'; // violet-500
    case 'legendary': return '#f59e0b'; // amber-500
    default: return '#9ca3af';
  }
}

/**
 * Helper to get default emoji based on NPC role.
 */
function getRoleEmoji(role: NPC['role']): string {
  switch (role) {
    case 'merchant': return '💰';
    case 'guard': return '🛡️';
    case 'quest_giver': return '📜';
    case 'unique': return '✨';
    case 'civilian':
    default: return '👤';
  }
}

/**
 * Helper to get default theme color based on NPC role.
 */
function getRoleColor(role: NPC['role']): string {
  switch (role) {
    case 'merchant': return '#f59e0b'; // amber-500
    case 'guard': return '#3b82f6'; // blue-500
    case 'quest_giver': return '#8b5cf6'; // violet-500
    case 'unique': return '#ec4899'; // pink-500
    case 'civilian':
    default: return '#9ca3af'; // gray-400
  }
}
