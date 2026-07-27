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
  token2d: { transform: string; filter: string };
  /** 3D channel: sustained root-pose targets. + pitch = forward (toward facing). */
  actor3d: { pitch: number; yOffset: number };
}

/** The five authored poses. Values are design-judgment; the eyeball gate rules. */
export const CONTROL_POSES: Record<ControlPoseId, ControlPose> = {
  grovel: {
    id: 'grovel',
    statusName: 'Command: Grovel',
    label: 'Groveling',
    // toppled + flattened disc, dimmed — reads as prone from the top-down view
    token2d: {
      transform: 'rotate(14deg) scale(1, 0.62) translateY(14%)',
      filter: 'brightness(0.8) saturate(0.7)',
    },
    // face-down flat (death falls backward at -π/2; grovel falls FORWARD)
    actor3d: { pitch: 1.35, yOffset: 0 },
  },
  halt: {
    id: 'halt',
    statusName: 'Command: Halt',
    label: 'Halted',
    // frozen at attention: slight shrink, washed-out "stopped clock" tint
    token2d: {
      transform: 'scale(0.97)',
      filter: 'saturate(0.55) brightness(1.05)',
    },
    actor3d: { pitch: -0.08, yOffset: 0 },
  },
  drop: {
    id: 'drop',
    statusName: 'Command: Drop',
    label: 'Dropping held items',
    // a small dip — the token stoops after letting go
    token2d: {
      transform: 'translateY(8%) scale(0.94)',
      filter: 'brightness(0.9)',
    },
    actor3d: { pitch: 0.24, yOffset: -0.05 },
  },
  approach: {
    id: 'approach',
    statusName: 'Command: Approach',
    label: 'Compelled to approach',
    // eager forward lean
    token2d: {
      transform: 'skewX(-7deg) translateY(-3%)',
      filter: 'none',
    },
    actor3d: { pitch: 0.16, yOffset: 0 },
  },
  flee: {
    id: 'flee',
    statusName: 'Command: Flee',
    label: 'Compelled to flee',
    // recoiling backward lean
    token2d: {
      transform: 'skewX(8deg) scale(0.97)',
      filter: 'saturate(0.85)',
    },
    actor3d: { pitch: -0.18, yOffset: 0 },
  },
};

/** Strongest visual wins when several directives are somehow active at once. */
const PRECEDENCE: ControlPoseId[] = ['grovel', 'halt', 'drop', 'flee', 'approach'];

const STATUS_TO_POSE = new Map<string, ControlPose>(
  Object.values(CONTROL_POSES).map((pose) => [pose.statusName, pose]),
);

type StatusLike = ReadonlyArray<{ name: string }>;

// Cache keyed by array identity: combat state replaces statusEffects arrays
// immutably, so the same array always means the same answer. WeakMap keeps
// expired arrays collectable.
const resolveCache = new WeakMap<StatusLike, ControlPose | null>();

/**
 * Resolve the active control pose for a combatant's status effects.
 * Null = no directive (or an unknown one): render the base look.
 */
export function resolveControlPose(statusEffects: StatusLike | undefined): ControlPose | null {
  if (!statusEffects || statusEffects.length === 0) return null;
  const cached = resolveCache.get(statusEffects);
  if (cached !== undefined) return cached;

  let best: ControlPose | null = null;
  let bestRank = PRECEDENCE.length;
  for (const effect of statusEffects) {
    const pose = STATUS_TO_POSE.get(effect.name);
    if (!pose) continue;
    const rank = PRECEDENCE.indexOf(pose.id);
    if (rank < bestRank) {
      best = pose;
      bestRank = rank;
    }
  }
  resolveCache.set(statusEffects, best);
  return best;
}

/** The 3D surface's live (eased) pose values, mutated in place per frame. */
export interface AppliedActorPose {
  pitch: number;
  yOffset: number;
}

/** Exponential ease rate — reaches ~95% of the target in about half a second. */
const EASE_RATE = 6;

/**
 * Advance the applied 3D pose one frame toward the target (or toward zero when
 * the pose ended). Mutates and returns `applied` — callers keep it in a ref so
 * per-frame use allocates nothing. Exponential approach never overshoots.
 */
export function easeActorPose(
  applied: AppliedActorPose,
  target: ControlPose | null,
  delta: number,
): AppliedActorPose {
  const goalPitch = target ? target.actor3d.pitch : 0;
  const goalY = target ? target.actor3d.yOffset : 0;
  const k = 1 - Math.exp(-EASE_RATE * Math.max(0, delta));
  applied.pitch += (goalPitch - applied.pitch) * k;
  applied.yOffset += (goalY - applied.yOffset) * k;
  return applied;
}
