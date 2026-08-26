/**
 * @file CameraFocusEventEmitter.ts — the turn → camera focus channel.
 *
 * Fight-in-place slice 1, sub-feature 9A ("per-turn orbit auto-refocus").
 *
 * The turn manager knows WHEN a combatant's turn begins and WHO it belongs to.
 * The 3D camera knows HOW to move. They are deliberately far apart in the tree
 * (`useTurnManager` is a headless hook owned by `CombatView`; `CameraController`
 * lives inside the R3F canvas, several component layers down, and in the GPU
 * scene is not even a sibling of the hook's owner). Threading a prop through
 * every intermediate surface would couple the whole battle-map stack to a camera
 * concern, so the turn boundary is published on a tiny event channel instead —
 * the same pattern `CombatEventEmitter` already uses for combat events that
 * cross ownership boundaries.
 *
 * What was preserved: `CameraController` still accepts `activeCharacter` and
 * still auto-pans from it. This channel is ADDITIVE — it upgrades the pan to a
 * true orbit with a fixed duration, and it works for surfaces that never passed
 * the prop. Nothing regresses when no listener is attached.
 *
 * Called by: hooks/combat/useTurnManager.ts (emit), CameraController.tsx (listen).
 */
import type { Position } from '../../types/combat';

/**
 * How long a turn-start refocus takes, in seconds. The design bar for 9A is a
 * ~0.5s move: long enough to read as a deliberate camera decision, short enough
 * that it never delays the player's first input of the turn.
 *
 * Exported from the channel, not from the controller, because it is part of the
 * contract between the two — a caller can honestly say "the camera will be on
 * the new actor in 0.5s" without importing R3F.
 */
export const TURN_FOCUS_LERP_SECONDS = 0.5;

/** Why the camera was asked to refocus. */
export type CameraFocusReason = 'turn-start' | 'selection' | 'manual';

/** One request for the tactical camera to center on a combatant. */
export interface CameraFocusRequest {
  /** The combatant to center on. */
  characterId: string;
  /** The combatant's grid position at the moment of the request. */
  position: Position;
  /** What triggered the refocus. */
  reason: CameraFocusReason;
  /**
   * Monotonic counter. Two consecutive turns can belong to the SAME combatant
   * (a solo fight, a readied re-entry), and a listener that deduped on
   * `characterId` alone would silently skip the second refocus. Listeners
   * dedupe on this instead.
   */
  requestId: number;
  /** The combat round/turn counter, when the emitter knows it. Diagnostics only. */
  turn?: number;
}

type CameraFocusListener = (request: CameraFocusRequest) => void;

export class CameraFocusEventEmitter {
  private listeners: CameraFocusListener[] = [];

  /**
   * The most recent request, retained so a camera that mounts AFTER the turn
   * started still frames the right actor. Without replay, the very first turn of
   * a fight refocuses nothing: the turn begins during combat initialization,
   * before the R3F canvas has mounted its controller.
   */
  private last: CameraFocusRequest | null = null;

  private nextRequestId = 1;

  /** Subscribe. Returns an unsubscribe function for React effect cleanup. */
  onFocus(listener: CameraFocusListener): () => void {
    this.listeners.push(listener);
    return () => this.offFocus(listener);
  }

  /** Unsubscribe a listener. */
  offFocus(listener: CameraFocusListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Publish a refocus request and return the request that was sent (so a caller
   * or test can assert on the generated id).
   */
  emitFocus(
    characterId: string,
    position: Position,
    reason: CameraFocusReason = 'turn-start',
    turn?: number,
  ): CameraFocusRequest {
    const request: CameraFocusRequest = {
      characterId,
      position: { ...position },
      reason,
      requestId: this.nextRequestId++,
      ...(turn === undefined ? {} : { turn }),
    };
    this.last = request;
    // A listener throwing must not abort the turn boundary that emitted this.
    for (const listener of [...this.listeners]) {
      try {
        listener(request);
      } catch {
        // Camera framing is cosmetic; combat continues.
      }
    }
    return request;
  }

  /** The latest request, for a listener that mounted late. */
  getLastRequest(): CameraFocusRequest | null {
    return this.last;
  }

  /** Drop the retained request. Call when an encounter ends. */
  clearLastRequest(): void {
    this.last = null;
  }

  // ==========================================================================
  // Singleton Instance and Test Isolation Controls
  // ==========================================================================

  private static instance: CameraFocusEventEmitter | undefined;

  static getInstance(): CameraFocusEventEmitter {
    if (!CameraFocusEventEmitter.instance) {
      CameraFocusEventEmitter.instance = new CameraFocusEventEmitter();
    }
    return CameraFocusEventEmitter.instance;
  }

  /** Swap the shared instance (test isolation), mirroring the movement emitter. */
  static setInstance(instance: CameraFocusEventEmitter | null): void {
    CameraFocusEventEmitter.instance = instance ?? undefined;
  }

  static createFresh(): CameraFocusEventEmitter {
    return new CameraFocusEventEmitter();
  }
}

export const cameraFocusEvents = CameraFocusEventEmitter.getInstance();
