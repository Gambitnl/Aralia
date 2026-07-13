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
 */

import { GamePhase } from './types';

/**
 * Phases that serialize to a hand-picked "clean" slug instead of the default
 * lowercased enum name. Add an entry here to give a phase a custom URL slug.
 * The map is bidirectional by construction (see SLUG_TO_PHASE below).
 */
export const PHASE_SLUG_OVERRIDES: Partial<Record<GamePhase, string>> = {
  [GamePhase.WORLD3D_DEMO]: 'world3d',
  [GamePhase.WORLDFORGE_DEMO]: 'worldforge',
  [GamePhase.SPAWN_PREVIEW]: 'spawnpreview',
  [GamePhase.AGENTSIM_PREVIEW]: 'agentsim',
  [GamePhase.AGENTSIM_3D_PREVIEW]: 'agentsim3d',
  [GamePhase.START_POINT_SELECTION]: 'startselect',
  [GamePhase.LIVING_WORLD_PREVIEW]: 'livingworld',
  [GamePhase.WEBGPU_PROBE]: 'webgpuprobe',
};

// Reverse lookup: clean slug -> phase. Derived from the overrides so the two
// directions can never drift apart.
const SLUG_TO_PHASE: Record<string, GamePhase> = Object.fromEntries(
  Object.entries(PHASE_SLUG_OVERRIDES).map(([phase, slug]) => [slug, Number(phase) as GamePhase]),
);

/** Convert a GamePhase to its URL slug. */
export const getPhaseSlug = (phase: GamePhase): string =>
  PHASE_SLUG_OVERRIDES[phase] ?? GamePhase[phase]?.toLowerCase() ?? '';

/**
 * Resolve a URL slug back to a GamePhase, or null if it doesn't map to a valid
 * phase (callers treat null as NOT_FOUND). Accepts clean slugs, lowercased enum
 * names, and bare numeric indexes (legacy links).
 */
export const getPhaseFromSlug = (slug: string | null): GamePhase | null => {
  if (!slug) return null;
  const normalizedSlug = slug.toLowerCase();

  // Hand-mapped clean slugs first.
  if (normalizedSlug in SLUG_TO_PHASE) return SLUG_TO_PHASE[normalizedSlug];

  // Retired route: design preview is now a standalone tool at /Aralia/misc/design.html.
  if (normalizedSlug === 'design_preview') {
    console.warn("[Decoupling] 'design_preview' is now a standalone tool. Access it at /Aralia/misc/design.html");
    return null;
  }

  // Default: lowercased enum name -> enum member. Guard against the numeric-string
  // reverse-map keys a TS numeric enum carries (`GamePhase['2']` is the NAME
  // 'PLAYING', not a value) by requiring the lookup to yield a number.
  const byName = GamePhase[slug.toUpperCase() as keyof typeof GamePhase];
  if (typeof byName === 'number') return byName;

  // Legacy: bare numeric phase index (valid only if it reverse-maps to a name).
  const numeric = parseInt(slug, 10);
  return Number.isInteger(numeric) && typeof GamePhase[numeric] === 'string' ? (numeric as GamePhase) : null;
};

/** Product name used as the browser-tab title prefix. */
export const APP_TITLE = 'Aralia';

/**
 * Human, descriptive browser-tab names per phase. Anything not listed falls back
 * to a prettified enum name (WORLD3D_DEMO -> "World3d Demo"). Add an entry here to
 * give a phase a nicer tab title; getPhaseTitle() is the single source the app and
 * the URL Directory both read.
 */
export const PHASE_TITLES: Partial<Record<GamePhase, string>> = {
  [GamePhase.MAIN_MENU]: 'Main Menu',
  [GamePhase.CHARACTER_CREATION]: 'Character Creator',
  [GamePhase.PLAYING]: 'Adventure',
  [GamePhase.GAME_OVER]: 'Game Over',
  [GamePhase.BATTLE_MAP_DEMO]: 'Battle Map',
  [GamePhase.LOAD_TRANSITION]: 'Loading',
  [GamePhase.COMBAT]: 'Combat',
  [GamePhase.NOT_FOUND]: 'Page Not Found',
  [GamePhase.WORLD3D_DEMO]: '3D World',
  [GamePhase.WORLDFORGE_DEMO]: 'Worldforge Atlas',
  [GamePhase.COMBAT_MESSAGING_DEMO]: 'Combat Messaging',
  [GamePhase.SPAWN_PREVIEW]: 'Spawn Preview',
  [GamePhase.AGENTSIM_PREVIEW]: 'Agent Simulation',
  [GamePhase.AGENTSIM_3D_PREVIEW]: 'Agent Simulation (3D)',
  [GamePhase.START_POINT_SELECTION]: 'Choose Start Point',
  [GamePhase.LIVING_WORLD_PREVIEW]: 'Living World',
  [GamePhase.WEBGPU_PROBE]: 'WebGPU Probe',
};

const prettifyPhaseName = (name: string): string =>
  name
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** The descriptive label for a phase (no app prefix), e.g. 'Worldforge Atlas'. */
export const getPhaseLabel = (phase: GamePhase): string =>
  PHASE_TITLES[phase] ?? prettifyPhaseName(GamePhase[phase] ?? '');

/** The full browser-tab title for a phase, e.g. 'Aralia — Worldforge Atlas'. */
export const getPhaseTitle = (phase: GamePhase): string => `${APP_TITLE} — ${getPhaseLabel(phase)}`;

/**
 * Standalone "deep-link" flags handled outside the phase system. Keep these
 * listed here so the full set of recognized query flags is discoverable.
 */
export const ROUTE_FLAGS = {
  /** Boot straight into the World Map (world-generation) view from the menu. */
  worldGen: { params: ['worldmap', 'view'] as const },
  /** Dev opt-in: auto-start the legacy dummy party instead of showing the menu. */
  dummyStart: { params: ['dummy', 'devstart'] as const },
} as const;

/**
 * True when the URL requests the World Map / world-generation deep link, i.e.
 * `?worldmap=1` or `?view=worldgen`.
 */
export const isWorldGenDeepLink = (search: string = window.location.search): boolean => {
  const params = new URLSearchParams(search);
  return params.get('worldmap') === '1' || params.get('view') === 'worldgen';
};

/**
 * True when the URL opts into the legacy dummy auto-start, i.e. `?dummy=1` or
 * `?devstart=1`. This is now OPT-IN: a brand-new player (no save) must land on
 * the Main Menu and go through New Game → character creation → start selection,
 * the real first-run experience. Devs who want the fast pre-built party add the
 * flag. (Still additionally gated by `canUseDevTools()` at the call site, so it
 * can never fire in production.)
 */
export const isDummyAutoStartDeepLink = (search: string = window.location.search): boolean => {
  const params = new URLSearchParams(search);
  return params.get('dummy') === '1' || params.get('devstart') === '1';
};
