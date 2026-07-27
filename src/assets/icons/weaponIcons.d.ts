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
export interface WeaponIcon {
    id: string;
    name: string;
    src: string;
    source: string;
}
export declare const WEAPON_ICONS: WeaponIcon[];
