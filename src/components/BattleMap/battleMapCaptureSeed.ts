/** Resolve the dev-only battle-map capture seed without accepting a blank URL value as zero. */
export function resolveBattleMapCaptureSeed(
  override: unknown,
  search: string,
): number | null {
  if (typeof override === "number" && Number.isFinite(override)) {
    return override;
  }

  const value = new URLSearchParams(search).get("seed");
  if (value === null || !/^-?\d+$/.test(value)) return null;

  const seed = Number(value);
  return Number.isSafeInteger(seed) ? seed : null;
}
