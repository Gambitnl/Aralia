// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/08/2026, 15:37:46
 * Dependents: components/CharacterCreator/SkillSelection.tsx, components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Skills/SkillsTab.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { assetUrl } from '../config/env';

/**
 * This file provides the canonical proficiency level icon mapping and rendering.
 *
 * It connects character skills, tool proficiencies, saving throws, and skill tables
 * to the standardized proficiency tier vector SVGs from the TW-D&D vendor collection.
 *
 * Proficiency levels supported:
 * - 'unskilled' / 0: Untrained (empty circle)
 * - 'half' / 0.5: Half-Proficiency (half-filled circle, e.g. Jack of All Trades)
 * - 'proficient' / 1: Full Proficiency (solid circle)
 * - 'expertise' / 2: Expertise (double / star circle, 2x proficiency)
 *
 * Icons are rendered via the <ProficiencyIcon /> component, using CSS mask so any
 * Tailwind text color (e.g. text-green-400, text-sky-400, text-amber-400) fills the shape.
 *
 * Called by: SkillsTab.tsx, SkillDetailDisplay.tsx, SkillSelection.tsx, PreviewIcons.tsx
 * Depends on: public/assets/icons/tw-dnd/proficiency/*.svg
 */

// ============================================================================
// Types
// ============================================================================

export type ProficiencyLevel =
  | 'unskilled'
  | 'untrained'
  | 'none'
  | 'half'
  | 'half_proficient'
  | 'half-proficient'
  | 'proficient'
  | 'proficiency'
  | 'expertise'
  | 'expert';

// ============================================================================
// TW-D&D Proficiency Icon Paths
// ============================================================================

export const PROFICIENCY_TW_DND_ICON_MAP: Record<string, string> = {
  unskilled:        'assets/icons/tw-dnd/proficiency/unskilled.svg',
  untrained:        'assets/icons/tw-dnd/proficiency/unskilled.svg',
  none:             'assets/icons/tw-dnd/proficiency/unskilled.svg',
  '0':              'assets/icons/tw-dnd/proficiency/unskilled.svg',
  half:             'assets/icons/tw-dnd/proficiency/half.svg',
  half_proficient:  'assets/icons/tw-dnd/proficiency/half.svg',
  'half-proficient':'assets/icons/tw-dnd/proficiency/half.svg',
  half_proficiency: 'assets/icons/tw-dnd/proficiency/half.svg',
  '0.5':            'assets/icons/tw-dnd/proficiency/half.svg',
  proficient:       'assets/icons/tw-dnd/proficiency/proficient.svg',
  proficiency:      'assets/icons/tw-dnd/proficiency/proficient.svg',
  '1':              'assets/icons/tw-dnd/proficiency/proficient.svg',
  expertise:        'assets/icons/tw-dnd/proficiency/expertise.svg',
  expert:           'assets/icons/tw-dnd/proficiency/expertise.svg',
  '2':              'assets/icons/tw-dnd/proficiency/expertise.svg',
};

// ============================================================================
// Path Lookup Utilities
// ============================================================================

/**
 * Returns the relative public asset path for a proficiency level,
 * or undefined if not mapped.
 */
export function getProficiencyIconSrc(level?: ProficiencyLevel | number | boolean): string | undefined {
  if (level === undefined || level === null) return undefined;
  if (typeof level === 'boolean') {
    return level ? PROFICIENCY_TW_DND_ICON_MAP['proficient'] : PROFICIENCY_TW_DND_ICON_MAP['unskilled'];
  }
  const key = String(level).trim().toLowerCase();
  return PROFICIENCY_TW_DND_ICON_MAP[key] || PROFICIENCY_TW_DND_ICON_MAP['unskilled'];
}

// ============================================================================
// ProficiencyIcon Component
// ============================================================================

export interface ProficiencyIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The proficiency level ('unskilled', 'half', 'proficient', 'expertise', 0, 0.5, 1, 2, or boolean) */
  level?: ProficiencyLevel | number | boolean;
  /** Sizing and color classes (defaults to 'w-4 h-4') */
  className?: string;
  /** Accessible title and label */
  title?: string;
}

/**
 * Renders a crisp vector proficiency tier icon (unskilled, half, proficient, expertise).
 * Uses CSS mask so any Tailwind text color class (e.g. text-green-400) fills the shape.
 */
export const ProficiencyIcon: React.FC<ProficiencyIconProps> = ({
  level = 'proficient',
  className = 'w-4 h-4',
  title,
  style,
  ...rest
}) => {
  const src = getProficiencyIconSrc(level);
  if (!src) return null;

  const levelStr = String(level);
  const ariaLabel = title || `Proficiency level: ${levelStr}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={title || `Proficiency: ${levelStr}`}
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
