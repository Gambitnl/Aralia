/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:55:13
 * Dependents: components/ui/CompanionCard.tsx, components/ui/CompanionReaction.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Returns a portrait URL only when the value can be rendered intentionally.
 * Whitespace and known retired placeholders use the existing initials UI;
 * every other URL is preserved so authored portraits continue to work.
 */
export declare const usableCompanionAvatarUrl: (avatarUrl?: string) => string | undefined;
