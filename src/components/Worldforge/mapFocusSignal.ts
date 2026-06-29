/**
 * @file mapFocusSignal.ts
 * One-shot, cross-tree signal: "the next time the world-map (MapPane →
 * AtlasSvgView) opens, center it on the player's cell instead of the default
 * fit-to-world view."
 *
 * Why a module singleton rather than game state: the request is transient UI
 * intent with no place in the persisted save, and the map modal MOUNTS FRESH
 * each time it opens (GameModals renders it conditionally), so a
 * consume-on-mount flag is sufficient and avoids threading a nonce through
 * App → GameModals → MapPane → AtlasSvgView (and the factory/reducer churn that
 * a new GameState field would require). ES module singletons are shared across
 * the bundle, so the 3D HUD (which sets it) and AtlasSvgView (which consumes it)
 * see the same flag even though they live in different lazy chunks.
 */

let pendingCenterOnPlayer = false;

/** Ask the next map open to center on the player's cell. */
export function requestMapCenterOnPlayer(): void {
  pendingCenterOnPlayer = true;
}

/** Read-and-clear the request. Returns true at most once per request. */
export function consumeMapCenterOnPlayer(): boolean {
  const wanted = pendingCenterOnPlayer;
  pendingCenterOnPlayer = false;
  return wanted;
}
