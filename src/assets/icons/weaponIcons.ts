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
 * This manifest is intentionally present even when the shared weapon folder is
 * empty. Preview pages import it directly, so keeping the export stable lets the
 * design surface render while future weapon SVG imports can fill the array.
 */
export const WEAPON_ICONS: WeaponIcon[] = [];
