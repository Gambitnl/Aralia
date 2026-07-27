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
export declare const ARMOR_ICONS: ArmorIcon[];
