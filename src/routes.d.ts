/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:36:33
 * Dependents: App.tsx, hooks/useHistorySync.ts, url-directory-entry.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Single source of truth for the main app's in-app URLs.
 *
 * The Aralia SPA (index.html) does not use real routes — navigation is encoded
 * in the `?phase=<slug>` query param, plus a few standalone boolean flags. This
 * module owns BOTH so there's one place to answer "which URLs are valid?":
 *
 *  - Phase routing: GamePhase <-> URL slug (getPhaseSlug / getPhaseFromSlug).
 *    Most phases serialize as `GamePhase[phase].toLowerCase()`; a handful get
 *    hand-picked "clean" slugs via PHASE_SLUG_OVERRIDES.
 *  - Special flags: query params handled outside the phase system (e.g.
 *    ?worldmap=1), exposed as small predicate helpers.
 *
 * NOTE: standalone *pages* (the separate misc/*.html documents) are a different
 * URL layer entirely — those are registered in vite.config.ts `rollupOptions.input`,
 * not here. This file is only about routes WITHIN the main app.
 *
 * The Worldforge canvas phase now stays only as a stable enum slot for old save
 * numbers. Current URLs fail it closed and point map users to `?worldmap=1`;
 * other phase and legacy-link behavior is intentionally preserved.
 */
import { GamePhase } from './types';
/**
 * Phases that serialize to a hand-picked "clean" slug instead of the default
 * lowercased enum name. Add an entry here to give a phase a custom URL slug.
 * The map is bidirectional by construction (see SLUG_TO_PHASE below).
 */
export declare const PHASE_SLUG_OVERRIDES: Partial<Record<GamePhase, string>>;
/**
 * Enum members kept only so old save-state numbers do not shift. They are not
 * URL surfaces: the duplicate canvas atlas is replaced by `?worldmap=1`, which
 * opens the canonical getBridgeAtlas + AtlasSvgView World Generation path.
 */
export declare const RETIRED_PHASE_ROUTE_NAMES: readonly ["WORLDFORGE_DEMO"];
/** True when a stable enum slot deliberately has no player or developer URL. */
export declare const isPhaseRouteRetired: (phase: GamePhase) => boolean;
/** Convert a GamePhase to its URL slug. */
export declare const getPhaseSlug: (phase: GamePhase) => string;
/**
 * Resolve a URL slug back to a GamePhase, or null if it doesn't map to a valid
 * phase (callers treat null as NOT_FOUND). Accepts clean slugs, lowercased enum
 * names, and bare numeric indexes (legacy links).
 */
export declare const getPhaseFromSlug: (slug: string | null) => GamePhase | null;
/** Product name used as the browser-tab title prefix. */
export declare const APP_TITLE = "Aralia";
/**
 * Human, descriptive browser-tab names per phase. Anything not listed falls back
 * to a prettified enum name (WORLD3D_DEMO -> "World3d Demo"). Add an entry here to
 * give a phase a nicer tab title; getPhaseTitle() is the single source the app and
 * the URL Directory both read.
 */
export declare const PHASE_TITLES: Partial<Record<GamePhase, string>>;
/** The descriptive label for a phase (no app prefix), e.g. 'Worldforge Atlas'. */
export declare const getPhaseLabel: (phase: GamePhase) => string;
/** The full browser-tab title for a phase, e.g. 'Aralia — Worldforge Atlas'. */
export declare const getPhaseTitle: (phase: GamePhase) => string;
/**
 * Standalone "deep-link" flags handled outside the phase system. Keep these
 * listed here so the full set of recognized query flags is discoverable.
 */
export declare const ROUTE_FLAGS: {
    /** Boot straight into the World Map (world-generation) view from the menu. */
    readonly worldGen: {
        readonly params: readonly ["worldmap", "view"];
    };
    /** Dev opt-in: auto-start the legacy dummy party instead of showing the menu. */
    readonly dummyStart: {
        readonly params: readonly ["dummy", "devstart"];
    };
};
/**
 * True when the URL requests the World Map / world-generation deep link, i.e.
 * `?worldmap=1` or `?view=worldgen`.
 */
export declare const isWorldGenDeepLink: (search?: string) => boolean;
/**
 * True when the URL opts into the legacy dummy auto-start, i.e. `?dummy=1` or
 * `?devstart=1`. This is now OPT-IN: a brand-new player (no save) must land on
 * the Main Menu and go through New Game → character creation → start selection,
 * the real first-run experience. Devs who want the fast pre-built party add the
 * flag. (Still additionally gated by `canUseDevTools()` at the call site, so it
 * can never fire in production.)
 */
export declare const isDummyAutoStartDeepLink: (search?: string) => boolean;
