// ============================================================================
// 5eTools speed field parsing
// ============================================================================
// 5etools stores a monster's `speed` field in multiple shapes: a plain number
// (feet), or an object with `walk`, `fly`, `swim`, `climb`, and `burrow`.
// Each mode is either a number or an object like `{ number: 60, condition: "..." }`.
//
// Aralia keeps **walking speed** on `CharacterStats.speed` (feet) for backward
// compatibility with movement and Dash math. Optional **other modes** live on
// `extraMovementSpeeds` so future systems (aquatic maps, flight) can read them
// without guessing from walk alone.
//
// Called by: `5eToolsAdapter.ts` (runtime conversion), `scripts/ingestMonsters.ts`
// (build-time generation). Keep this file the single source of truth for speed
// coercion so the two callers cannot drift.
// ============================================================================

import type { ExtraMovementSpeeds } from '../../types/core.js';

const EXTRA_MODES = ['fly', 'swim', 'climb', 'burrow'] as const;

/**
 * Normalizes a 5etools speed entry when it can be a bare number or `{ number, condition }`.
 */
function coerceSpeedFeet(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (raw && typeof raw === 'object' && 'number' in raw) {
    const n = (raw as { number?: unknown }).number;
    if (typeof n === 'number' && Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

/**
 * Walking speed in feet. Handles numeric `speed`, object `.walk`, and 5etools
 * conditional walk objects. Defaults to 30 when nothing usable is present.
 */
export function parseWalkSpeedFeet(speed: unknown): number {
  if (typeof speed === 'number' && Number.isFinite(speed)) {
    return speed;
  }
  if (!speed || typeof speed !== 'object') {
    return 30;
  }
  const w = coerceSpeedFeet((speed as Record<string, unknown>).walk);
  return w !== undefined ? w : 30;
}

/**
 * Extracts fly/swim/climb/burrow speeds in feet. Omits undefined when no extra
 * modes exist so generated JSON stays small.
 */
export function parseExtraMovementSpeedsFeet(speed: unknown): ExtraMovementSpeeds | undefined {
  if (!speed || typeof speed !== 'object' || typeof speed === 'number') {
    return undefined;
  }
  const o = speed as Record<string, unknown>;
  const out: ExtraMovementSpeeds = {};
  for (const mode of EXTRA_MODES) {
    const ft = coerceSpeedFeet(o[mode]);
    if (ft !== undefined) {
      out[mode] = ft;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
