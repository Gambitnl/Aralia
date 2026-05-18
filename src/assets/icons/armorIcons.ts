// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/05/2026, 00:13:14
 * Dependents: components/DesignPreview/steps/PreviewIcons.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface ArmorIcon {
  id: string;
  name: string;
  src: string;
  source: string;
}

/**
 * This file lists armor and shield SVGs available to item renderers and preview pages.
 *
 * Runtime files live together in public/assets/icons/general/armor. The source
 * field is kept for attribution because these icons come from Game Icons under
 * CC BY 3.0, while gameplay code only needs the source-neutral src path.
 */

// ============================================================================
// Armor Icon Manifest
// ============================================================================
// This section is intentionally data-only. Item definitions use the same folder
// paths directly, and preview surfaces can import this list to show the full
// armor set without scanning the filesystem.
// ============================================================================

export const ARMOR_ICONS: ArmorIcon[] = [
  {
    id: 'leather_cap',
    name: 'Leather Cap',
    src: 'assets/icons/general/armor/leather_cap.svg',
    source: 'game-icons:billed-cap'
  },
  {
    id: 'chainmail_coif',
    name: 'Chainmail Coif',
    src: 'assets/icons/general/armor/chainmail_coif.svg',
    source: 'game-icons:chain-mail'
  },
  {
    id: 'steel_helmet',
    name: 'Steel Helmet',
    src: 'assets/icons/general/armor/steel_helmet.svg',
    source: 'game-icons:visored-helm'
  },
  {
    id: 'leather_gloves',
    name: 'Leather Gloves',
    src: 'assets/icons/general/armor/leather_gloves.svg',
    source: 'game-icons:gloves'
  },
  {
    id: 'chainmail_gauntlets',
    name: 'Chainmail Gauntlets',
    src: 'assets/icons/general/armor/chainmail_gauntlets.svg',
    source: 'game-icons:gauntlet'
  },
  {
    id: 'plate_gauntlets',
    name: 'Plate Gauntlets',
    src: 'assets/icons/general/armor/plate_gauntlets.svg',
    source: 'game-icons:mailed-fist'
  },
  {
    id: 'cloth_pants',
    name: 'Cloth Pants',
    src: 'assets/icons/general/armor/cloth_pants.svg',
    source: 'game-icons:trousers'
  },
  {
    id: 'leather_greaves',
    name: 'Leather Greaves',
    src: 'assets/icons/general/armor/leather_greaves.svg',
    source: 'game-icons:greaves'
  },
  {
    id: 'plate_greaves',
    name: 'Plate Greaves',
    src: 'assets/icons/general/armor/plate_greaves.svg',
    source: 'game-icons:leg-armor'
  },
  {
    id: 'soft_boots',
    name: 'Soft Boots',
    src: 'assets/icons/general/armor/soft_boots.svg',
    source: 'game-icons:leather-boot'
  },
  {
    id: 'studded_boots',
    name: 'Studded Boots',
    src: 'assets/icons/general/armor/studded_boots.svg',
    source: 'game-icons:walking-boot'
  },
  {
    id: 'steel_boots',
    name: 'Steel Boots',
    src: 'assets/icons/general/armor/steel_boots.svg',
    source: 'game-icons:steeltoe-boots'
  },
  {
    id: 'leather_bracers',
    name: 'Leather Bracers',
    src: 'assets/icons/general/armor/leather_bracers.svg',
    source: 'game-icons:bracer'
  },
  {
    id: 'reinforced_bracers',
    name: 'Reinforced Bracers',
    src: 'assets/icons/general/armor/reinforced_bracers.svg',
    source: 'game-icons:bracers'
  },
  {
    id: 'padded_armor',
    name: 'Padded Armor',
    src: 'assets/icons/general/armor/padded_armor.svg',
    source: 'game-icons:armor-vest'
  },
  {
    id: 'leather_armor',
    name: 'Leather Armor',
    src: 'assets/icons/general/armor/leather_armor.svg',
    source: 'game-icons:leather-armor'
  },
  {
    id: 'studded_leather_armor',
    name: 'Studded Leather Armor',
    src: 'assets/icons/general/armor/studded_leather_armor.svg',
    source: 'game-icons:spiked-armor'
  },
  {
    id: 'hide_armor',
    name: 'Hide Armor',
    src: 'assets/icons/general/armor/hide_armor.svg',
    source: 'game-icons:fur-shirt'
  },
  {
    id: 'chain_shirt',
    name: 'Chain Shirt',
    src: 'assets/icons/general/armor/chain_shirt.svg',
    source: 'game-icons:mail-shirt'
  },
  {
    id: 'scale_mail',
    name: 'Scale Mail',
    src: 'assets/icons/general/armor/scale_mail.svg',
    source: 'game-icons:scale-mail'
  },
  {
    id: 'breastplate',
    name: 'Breastplate',
    src: 'assets/icons/general/armor/breastplate.svg',
    source: 'game-icons:breastplate'
  },
  {
    id: 'half_plate_armor',
    name: 'Half Plate Armor',
    src: 'assets/icons/general/armor/half_plate_armor.svg',
    source: 'game-icons:layered-armor'
  },
  {
    id: 'ring_mail',
    name: 'Ring Mail',
    src: 'assets/icons/general/armor/ring_mail.svg',
    source: 'game-icons:chain-mail'
  },
  {
    id: 'chain_mail',
    name: 'Chain Mail',
    src: 'assets/icons/general/armor/chain_mail.svg',
    source: 'game-icons:mail-shirt'
  },
  {
    id: 'splint_armor',
    name: 'Splint Armor',
    src: 'assets/icons/general/armor/splint_armor.svg',
    source: 'game-icons:shoulder-armor'
  },
  {
    id: 'plate_armor',
    name: 'Plate Armor',
    src: 'assets/icons/general/armor/plate_armor.svg',
    source: 'game-icons:chest-armor'
  },
  {
    id: 'shield_std',
    name: 'Shield',
    src: 'assets/icons/general/armor/shield_std.svg',
    source: 'game-icons:shield'
  },
  {
    id: 'shield_plus_one',
    name: '+1 Shield',
    src: 'assets/icons/general/armor/shield_plus_one.svg',
    source: 'game-icons:magic-shield'
  }
];
