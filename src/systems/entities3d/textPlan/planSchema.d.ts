/**
 * @file planSchema.ts — the body-plan language for text-to-creature.
 *
 * A CreaturePlan is what the LLM writes: a constrained JSON description of a
 * creature's skeleton (spine + free appendage chains + heads + palette +
 * optional known-part garnish). Motion is NOT in the language — animation
 * derives from appendage kind, keeping the LLM out of tuning.
 *
 * Validation is total and loud: every rule produces a named error and the
 * caller gets the full list. There is no clamping and no fallback — a bad
 * plan fails, and the retry prompt carries these errors verbatim.
 *
 * Spec: docs/superpowers/specs/2026-07-15-text-to-creature-design.md.
 */
export interface PlanChainLink {
    /** Link length in feet (feet-canon like the rest of the generator). */
    lenFt: number;
    /** Link radius as a fraction of the frame's base body radius. */
    r: number;
}
export interface PlanAppendage {
    kind: 'leg' | 'arm' | 'tail' | 'tentacle' | 'neck' | 'wing' | 'torso';
    /** 0 (spine front) – 1 (spine rear). */
    attach: number;
    /** Index of a 'torso' appendage to root on (arms/necks/wings/tentacles only) —
     * the tauric seam: a centaur's arms ride its torso, not the horse spine. */
    parent?: number;
    /** 0–1 attachment height on the body; defaults per kind (see PLAN_DEFAULT_HEIGHT_FRAC). */
    heightFrac?: number;
    /** true = mirrored left/right pair. */
    perSide?: boolean;
    /** 1–4 (per side when perSide). */
    count: number;
    /** 1–8 tapered links, root to tip. */
    chain: PlanChainLink[];
    /** Terminator: 'hand' = stylized palm + fingers at the tip (arms/tentacles/wings — legs already get feet). */
    tips?: 'hand';
    /** Floating accent-colored energy rings hovering at each interior joint. */
    jointRings?: boolean;
}
export interface PlanHead {
    /** Index of a 'neck' appendage to ride; omitted = spine front. */
    neckIndex?: number;
    /** 0.4–2 of the frame-derived head radius. */
    sizeScale: number;
    eyes: {
        count: number;
        sizeScale: number;
        pupil?: 'round' | 'slit' | 'goat';
    };
    snout?: {
        lengthScale: number;
        droop: number;
    };
    /** Ring of twitching fleshy lashes around each eye instead of lids. */
    cilia?: boolean;
}
export interface CreaturePlan {
    name: string;
    frame: {
        heightFt: number;
        /** Nose-to-tail body length; required for horizontal/serpentine stances. */
        lengthFt?: number;
        /** 0–1 radius scale. */
        bulk: number;
        stance: 'upright' | 'horizontal' | 'serpentine' | 'floating';
    };
    /** shape 'box' renders the body as rectangular slabs (cubes, chests, golems). */
    spine: {
        segments: number;
        taper: number;
        arch: number;
        shape?: 'round' | 'box';
    };
    appendages: PlanAppendage[];
    heads: PlanHead[];
    /** opacity < 1 = translucent body (ghosts, oozes); eyes stay solid. */
    palette: {
        bodyHex: string;
        accentHex?: string;
        bellyHex?: string;
        eyeHex: string;
        opacity?: number;
    };
    garnish?: Array<{
        partId: string;
        params?: Record<string, number>;
    }>;
}
/** Hard ranges — exported so the CLI prompt can state them exactly. */
export declare const PLAN_LIMITS: {
    readonly nameChars: readonly [1, 40];
    readonly heightFt: readonly [0.5, 30];
    readonly lengthFt: readonly [1, 60];
    readonly bulk: readonly [0, 1];
    readonly spineSegments: readonly [2, 8];
    readonly spineTaper: readonly [0.3, 1];
    readonly spineArch: readonly [-0.5, 0.5];
    readonly appendages: readonly [0, 12];
    readonly attach: readonly [0, 1];
    readonly heightFrac: readonly [0, 1];
    readonly count: readonly [1, 4];
    readonly chainLinks: readonly [1, 8];
    readonly linkLenFt: readonly [0.1, 12];
    readonly linkR: readonly [0.02, 1];
    readonly heads: readonly [1, 12];
    readonly opacity: readonly [0.2, 1];
    readonly headSizeScale: readonly [0.4, 2];
    readonly eyeCount: readonly [0, 8];
    readonly eyeSizeScale: readonly [0.4, 2];
    readonly snoutLengthScale: readonly [0.3, 2.5];
    readonly snoutDroop: readonly [-0.6, 0.8];
    readonly garnish: readonly [0, 8];
};
/** Default attachment height on the body, per appendage kind. */
export declare const PLAN_DEFAULT_HEIGHT_FRAC: Record<PlanAppendage['kind'], number>;
/**
 * Validate a candidate plan. Returns [] when valid; otherwise every named
 * problem found in one pass (the LLM retry prompt includes them all).
 */
export declare function validateCreaturePlan(input: unknown, knownPartIds: ReadonlySet<string>): string[];
