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
/** Ask the next map open to center on the player's cell. */
export declare function requestMapCenterOnPlayer(): void;
/** Read-and-clear the request. Returns true at most once per request. */
export declare function consumeMapCenterOnPlayer(): boolean;
/**
 * Ask the next map open to drill straight to a town plan (World ▸ Region ▸
 * Town), rather than the default fit-to-world atlas. Same one-shot
 * module-singleton rationale as {@link requestMapCenterOnPlayer}: the 3D HUD
 * sets it, MapPane consumes it on its fresh mount.
 *
 * `burgId` is the FMG burg the player's 3D world is showing — the town to drill
 * to. It must be passed explicitly because the player often stands in an atlas
 * cell ADJACENT to the town's own cell (the ground-world window spans several
 * cells), so the town can't be re-derived from the player's cell alone.
 */
export declare function requestMapDrillToPlayerTown(burgId?: number | null): void;
/** Read-and-clear the drill-to-town request. `wanted` is true at most once per request. */
export declare function consumeMapDrillToPlayerTown(): {
    wanted: boolean;
    burgId: number | null;
};
