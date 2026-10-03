/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/clampCheckDc.ts
 *
 * The model proposes a difficulty; the game decides it.
 *
 * A language model asked for a DC drifts: it invents 30s for a bar trick and 8s
 * for a jailbreak, and it drifts differently run to run. So the model only names
 * the STAKES and suggests a number, and this pure module clamps that number into
 * the band the stakes allow. The result is scene-sensitive but never illegal.
 *
 * The 5..25 outer range matches the authored `SituationThreat.deEscalationDC`
 * band in systems/gameEntry/types.ts, so an unauthored check and an authored one
 * can never sit on different scales.
 */
import type { IntentStakes } from './types';

/** Legal DC window per stakes tier. Inclusive on both ends. */
export const STAKES_DC_BANDS: Record<IntentStakes, readonly [number, number]> = {
    trivial: [5, 10],
    moderate: [10, 17],
    serious: [15, 25],
};

/** Used when the model proposes no usable number at all. */
export const DEFAULT_DC_BY_STAKES: Record<IntentStakes, number> = {
    trivial: 8,
    moderate: 13,
    serious: 18,
};

const STAKES_VALUES: readonly IntentStakes[] = ['trivial', 'moderate', 'serious'];

/**
 * Read the model's stakes word. Anything unrecognized becomes `moderate` — the
 * middle band — so a garbled field never silently makes an attempt free or
 * impossible.
 */
export function normalizeStakes(raw: unknown): IntentStakes {
    if (typeof raw !== 'string') return 'moderate';
    const lowered = raw.trim().toLowerCase();
    return STAKES_VALUES.find((s) => s === lowered) ?? 'moderate';
}

/**
 * Clamp a proposed DC into its stakes band.
 *
 * @param proposed - The model's suggestion. Accepts a number or a numeric
 *   string; anything else falls to the band's default.
 * @param stakes - The normalized stakes tier.
 */
export function clampCheckDc(proposed: unknown, stakes: IntentStakes): number {
    const [min, max] = STAKES_DC_BANDS[stakes];
    const value = typeof proposed === 'string' ? Number(proposed.trim()) : proposed;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return DEFAULT_DC_BY_STAKES[stakes];
    }
    return Math.max(min, Math.min(max, Math.round(value)));
}
