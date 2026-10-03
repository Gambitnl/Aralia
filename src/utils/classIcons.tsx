// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/08/2026, 01:25:12
 * Dependents: components/CharacterCreator/Class/ClassDetailPane.tsx, components/CharacterCreator/Class/ClassSelection.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/SpellSourceSelector.tsx, components/DesignPreview/steps/PreviewIcons.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { assetUrl } from '../config/env';
import { GlossaryIconName } from '../components/Glossary/IconRegistry';

/**
 * This file provides the canonical class icon mapping and rendering for character classes.
 *
 * It connects all Character Creator interfaces (the class selection list, the class detail
 * pane, the name and review screen, and spell source pickers) to high-quality vector SVGs
 * from the TW-D&D vendor collection (intrinsical/tw-dnd).
 *
 * Icons are rendered via the <ClassIcon /> component, which uses CSS masking so that
 * any text color (e.g. text-amber-400, text-sky-300, text-emerald-400) automatically tints
 * the vector silhouette.
 *
 * Called by: ClassSelection.tsx, ClassDetailPane.tsx, NameAndReview.tsx, SpellSourceSelector.tsx
 * Depends on: public/assets/icons/tw-dnd/class/*.svg
 */

// ============================================================================
// TW-D&D Class Icon Paths
// ============================================================================
// Canonical mapping from character class names to public TW-D&D SVG asset paths.
// Keys are lowercased to allow case-insensitive lookup regardless of source formatting.
// ============================================================================

export const CLASS_TW_DND_ICON_MAP: Record<string, string> = {
  artificer: 'assets/icons/tw-dnd/class/artificer.svg',
  barbarian: 'assets/icons/tw-dnd/class/barbarian.svg',
  bard:      'assets/icons/tw-dnd/class/bard.svg',
  cleric:    'assets/icons/tw-dnd/class/cleric.svg',
  druid:     'assets/icons/tw-dnd/class/druid.svg',
  fighter:   'assets/icons/tw-dnd/class/fighter.svg',
  monk:      'assets/icons/tw-dnd/class/monk.svg',
  paladin:   'assets/icons/tw-dnd/class/paladin.svg',
  ranger:    'assets/icons/tw-dnd/class/ranger.svg',
  rogue:     'assets/icons/tw-dnd/class/rogue.svg',
  sorcerer:  'assets/icons/tw-dnd/class/sorcerer.svg',
  warlock:   'assets/icons/tw-dnd/class/warlock.svg',
  wizard:    'assets/icons/tw-dnd/class/wizard.svg',
};

// ============================================================================
// Path Lookup Utilities
// ============================================================================

/**
 * Returns the relative public asset path for a class icon (e.g. 'assets/icons/tw-dnd/class/fighter.svg'),
 * or undefined if the class is not mapped.
 */
export function getClassIconSrc(className?: string): string | undefined {
  if (!className) return undefined;
  const key = className.trim().toLowerCase();
  return CLASS_TW_DND_ICON_MAP[key];
}

// ============================================================================
// ClassIcon Component
// ============================================================================
// Renders a vector TW-D&D class icon with dynamic color tinting using CSS masks.
// ============================================================================

export interface ClassIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The class name to render (e.g. 'Fighter', 'wizard', 'Bard') */
  name?: string;
  /** Sizing and color classes (defaults to 'w-4 h-4') */
  className?: string;
  /** Accessible title and label */
  title?: string;
}

/**
 * Renders a crisp vector class icon from the TW-D&D collection.
 * Uses CSS mask so any Tailwind text color class (e.g. text-amber-400) fills the silhouette.
 */
export const ClassIcon: React.FC<ClassIconProps> = ({
  name,
  className = 'w-4 h-4',
  title,
  style,
  ...rest
}) => {
  if (!name) return null;
  const src = getClassIconSrc(name);
  if (!src) return null;

  // Masking technique: The SVG supplies the shape silhouette, while the CSS
  // backgroundColor: 'currentColor' fills that shape with the active text color.
  return (
    <span
      role="img"
      aria-label={title || `${name} icon`}
      title={title || name}
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url("${assetUrl(src)}")`,
        maskImage: `url("${assetUrl(src)}")`,
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
      {...rest}
    />
  );
};

// ============================================================================
// Legacy Glossary Icon Mapping (Preserved for backwards compatibility)
// ============================================================================

export const CLASS_ICON_MAP: Record<string, GlossaryIconName> = {
  Artificer: 'build',
  Barbarian: 'axe_battle',
  Bard:      'music',
  Cleric:    'fa_hands_praying',
  Druid:     'leaf',
  Fighter:   'sword_cross',
  Monk:      'martial_arts',
  Paladin:   'shield_cross',
  Ranger:    'bow_arrow',
  Rogue:     'mask',
  Sorcerer:  'magic_staff',
  Warlock:   'fa_skull',
  Wizard:    'fa_hat_wizard',
};

/**
 * Returns the legacy GlossaryIconName for a class name, or undefined if not mapped.
 */
export function getClassIcon(className: string): GlossaryIconName | undefined {
  return CLASS_ICON_MAP[className];
}
