/**
 * @file combatUiTheme.ts
 * Shared Tailwind class tokens for the combat UI's "Battle Map" visual language.
 *
 * The 2D combat map was reworked to match the ornate fantasy mockup: deep navy
 * panels, thin bronze/gold borders, small letter-spaced gold section labels, and
 * warm amber accents. Centralizing the class strings here keeps every combat
 * panel (party roster, turn order, actions, abilities, log, grid frame) speaking
 * the same visual language instead of each file drifting its own shade of gray.
 *
 * These are plain string constants (not a component library) so existing markup
 * can adopt the look with a className swap and nothing else changes structurally.
 */

/** Outer panel: a framed section such as the party roster or the combat log. */
export const COMBAT_PANEL =
  'rounded-xl border border-amber-900/40 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm';

/** A slightly inset sub-panel / card sitting inside a COMBAT_PANEL. */
export const COMBAT_CARD =
  'rounded-lg border border-slate-700/70 bg-slate-800/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

/** Small letter-spaced gold section label (e.g. "PARTY", "TURN ORDER"). */
export const COMBAT_LABEL =
  'text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400/90';

/** Larger ornate heading in the Cinzel display face. */
export const COMBAT_HEADING = 'font-cinzel tracking-wide text-amber-300';

/** Glow ring applied to the combatant whose turn it currently is. */
export const COMBAT_TURN_RING_PLAYER =
  'border-sky-400/80 ring-2 ring-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.35)]';
export const COMBAT_TURN_RING_ENEMY =
  'border-rose-400/80 ring-2 ring-rose-400/50 shadow-[0_0_18px_rgba(251,113,133,0.35)]';

/** Toolbar / action button variants used across the combat chrome. */
export const COMBAT_BTN_BASE =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';
export const COMBAT_BTN_NEUTRAL =
  'border border-slate-600/70 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80';
export const COMBAT_BTN_GREEN = 'bg-emerald-700 text-emerald-50 hover:bg-emerald-600 border border-emerald-500/60';
export const COMBAT_BTN_ORANGE = 'bg-orange-600 text-orange-50 hover:bg-orange-500 border border-orange-400/60';
export const COMBAT_BTN_INDIGO = 'bg-indigo-600 text-indigo-50 hover:bg-indigo-500 border border-indigo-400/60';
export const COMBAT_BTN_RED = 'bg-rose-700 text-rose-50 hover:bg-rose-600 border border-rose-500/60';

/**
 * Action-economy accent colors, shared by the roster mini-icons, the Actions
 * panel, and the ability-cost badges so "action = red, bonus = gold, reaction =
 * blue, free/movement = green/teal" reads consistently everywhere.
 */
export const COMBAT_COST_COLORS: Record<string, { text: string; badge: string; ring: string }> = {
  action: { text: 'text-rose-300', badge: 'bg-rose-600', ring: 'border-rose-500/70' },
  bonus: { text: 'text-amber-300', badge: 'bg-amber-500', ring: 'border-amber-400/70' },
  reaction: { text: 'text-sky-300', badge: 'bg-sky-600', ring: 'border-sky-400/70' },
  free: { text: 'text-emerald-300', badge: 'bg-emerald-600', ring: 'border-emerald-400/70' },
  'movement-only': { text: 'text-teal-300', badge: 'bg-teal-600', ring: 'border-teal-400/70' },
};
