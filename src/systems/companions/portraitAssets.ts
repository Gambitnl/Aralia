// @dependencies-start
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
// @dependencies-end

/**
 * Companion portrait compatibility helpers.
 *
 * Early saves copied two placeholder portrait paths that were never backed by
 * public assets. Keep the compatibility rule here so every portrait surface
 * can fall back to initials without erasing valid authored URLs from newer
 * companions or future saves.
 */

const RETIRED_PLACEHOLDER_PORTRAITS = new Set([
  '/avatars/kaelen.png',
  '/avatars/elara.png',
]);

/**
 * Returns a portrait URL only when the value can be rendered intentionally.
 * Whitespace and known retired placeholders use the existing initials UI;
 * every other URL is preserved so authored portraits continue to work.
 */
export const usableCompanionAvatarUrl = (avatarUrl?: string): string | undefined => {
  const normalizedUrl = avatarUrl?.trim();
  if (!normalizedUrl || RETIRED_PLACEHOLDER_PORTRAITS.has(normalizedUrl)) return undefined;
  return normalizedUrl;
};
