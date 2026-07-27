/**
 * @file controlOptionPose.ts — G7: the shared control-option pose contract.
 *
 * When a Command-style control option lands (approach / flee / drop / grovel /
 * halt), UtilityCommand writes a 1-turn status effect named "Command: <Word>".
 * That status name is the ONE signal both combat surfaces read; this module
 * turns it into a visual pose with two channels:
 *
 *   - `token2d`: a CSS transform + filter the 2D CharacterToken composes onto
 *     its disc (CSS transitions make apply/restore smooth for free).
 *   - `actor3d`: sustained whole-body targets (pitch radians, yOffset meters)
 *     the 3D CharacterActor eases onto the generated entity's root, layered
 *     under the transient combat overlays (lunge / recoil / cast / death).
 *
 * Contract properties (the G7 gap named them):
 *   - non-blocking: resolution is pure synchronous data — no asset loads, no
 *     await, nothing on the command execution path.
 *   - cache: resolution is memoized per statusEffects array identity (combat
 *     state replaces the array immutably on every change, so identity is a
 *     correct cache key).
 *   - fallback: unknown or absent directives resolve to null and the surfaces
 *     render their base look — a bad directive can never break a token.
 *   - restore: when the status expires the resolver returns null; the 2D CSS
 *     transition and the 3D `easeActorPose` both return to the base pose.
 */
export type ControlPoseId = 'approach' | 'flee' | 'drop' | 'grovel' | 'halt';
export interface ControlPose {
    id: ControlPoseId;
    /** The exact status-effect name UtilityCommand writes for this directive. */
    statusName: string;
    /** Short human label for tooltips/debug attributes. */
    label: string;
    /** 2D channel: composed onto the token disc's own transform. */
    token2d: {
        transform: string;
        filter: string;
    };
    /** 3D channel: sustained root-pose targets. + pitch = forward (toward facing). */
    actor3d: {
        pitch: number;
        yOffset: number;
    };
}
/** The five authored poses. Values are design-judgment; the eyeball gate rules. */
export declare const CONTROL_POSES: Record<ControlPoseId, ControlPose>;
type StatusLike = ReadonlyArray<{
    name: string;
}>;
/**
 * Resolve the active control pose for a combatant's status effects.
 * Null = no directive (or an unknown one): render the base look.
 */
export declare function resolveControlPose(statusEffects: StatusLike | undefined): ControlPose | null;
/** The 3D surface's live (eased) pose values, mutated in place per frame. */
export interface AppliedActorPose {
    pitch: number;
    yOffset: number;
}
/**
 * Advance the applied 3D pose one frame toward the target (or toward zero when
 * the pose ended). Mutates and returns `applied` — callers keep it in a ref so
 * per-frame use allocates nothing. Exponential approach never overshoots.
 */
export declare function easeActorPose(applied: AppliedActorPose, target: ControlPose | null, delta: number): AppliedActorPose;
export {};
