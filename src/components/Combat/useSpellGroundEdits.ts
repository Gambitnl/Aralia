/**
 * @file useSpellGroundEdits.ts - CombatView's bridge from a spell that moved
 * earth to the world's one ground (agora-257c, 2026-10-29, GG-533 step 3).
 *
 * `spellGroundEdits.ts` turns a cast into exact ground shapes. This hook does
 * two things with each shape, in cast order:
 *  1. It cuts the shape into every live ground world of the patch's own
 *     artifact: the ground the in-place fight draws (`getWorldGround`, which
 *     `World3DScene` publishes) and the ground handed across the phase change
 *     (`handoffGround`: CombatView's own copy of the fight-in-place handoff);
 *     these are normally one object. `editGround`
 *     tells every reader: the drawn ground and its roads, the river.
 *  2. It saves the shape as a world delta (APPLY_WORLDFORGE_DELTA), so the next
 *     build of that ground replays it (`replayGroundShapes`).
 * A fight with no live ground for the artifact (a travel ambush on the 2D
 * board) still saves the edit; the world shows it when it builds again. A
 * shape the live ground does not change (all of it off the grid) is not saved.
 *
 * Where the facts come from: TerrainCommand's log entries pass through
 * `takeLogEntry` (CombatView's central log handler), and an explosion's
 * crater rides its spell animation, the same fact `BattleMap3D` digs the arena
 * with (`takeAnimations`). Both are deduplicated by id.
 *
 * The ground modules load on the first edit only, so the combat bundle does
 * not carry the world bridge (they are large and three.js-adjacent).
 */
import { useCallback, useRef } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from '../../state/actionTypes';
import type { Animation, BattleMapData, CombatLogEntry, SpellEffectAnimationData } from '../../types/combat';
import type { WorldDelta } from '../../systems/worldforge/delta/types';
import type { GroundShape } from '../../systems/worldforge/terrain/groundShapeProfile';
import type { GroundHeightGrid } from '../../systems/worldforge/bridge/groundRecord';
import { groundShapeOfImpact, groundShapesOfTerrainLog } from '../../systems/combat/fightInPlace/spellGroundEdits';

export interface SpellGroundEdits {
  /** Read one combat log entry; a TerrainCommand excavate or fill becomes a ground edit. */
  takeLogEntry: (entry: CombatLogEntry) => void;
  /** Read the live animation list; an explosion's crater becomes a ground edit. */
  takeAnimations: (animations: readonly Animation[] | undefined) => void;
}

export function useSpellGroundEdits(
  mapData: BattleMapData | null,
  worldforgeDeltas: readonly WorldDelta[] | undefined,
  dispatch: Dispatch<AppAction>,
  /** The fight-in-place handoff's ground (typed loosely there), if this fight has one. */
  handoffGround?: unknown,
): SpellGroundEdits {
  // Refs, so the log handler and the effect read the latest values without
  // re-creating CombatView's stable callbacks.
  const mapRef = useRef(mapData);
  mapRef.current = mapData;
  const deltasRef = useRef(worldforgeDeltas);
  deltasRef.current = worldforgeDeltas;
  const handoffGroundRef = useRef(handoffGround);
  handoffGroundRef.current = handoffGround;
  const seen = useRef(new Set<string>());
  // The last sequence this hook gave each artifact: state lags a dispatch, so
  // two edits in one turn must not both read the same "next" from the save.
  const lastSequence = useRef(new Map<string, number>());
  // One queue, so edits land in cast order across the async module load.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const apply = useCallback((shapes: GroundShape[], map: BattleMapData) => {
    const artifact = map.worldGround?.artifactSeedPath;
    if (!artifact || shapes.length === 0) return;
    queue.current = queue.current.then(async () => {
      const [record, profile, hook] = await Promise.all([
        import('../../systems/worldforge/bridge/groundRecord'),
        import('../../systems/worldforge/terrain/groundShapeProfile'),
        import('../World3D/water/worldGroundHook'),
      ]);
      // Every live ground of this artifact, each once.
      // The handoff types its ground loosely (it keeps the bridge out of its
      // imports); a ground world is a height grid, which is all the record needs.
      const candidates = [hook.getWorldGround()?.ground, handoffGroundRef.current] as Array<GroundHeightGrid | null | undefined>;
      const live = candidates.filter((g, i): g is GroundHeightGrid =>
        !!g && Array.isArray(g.heights) && candidates.indexOf(g) === i
        && record.groundArtifactSeedPath(g) === artifact);
      for (const shape of shapes) {
        try {
          profile.validateGroundShape(shape);
        } catch (e) {
          // A shape no tool may cut is named and skipped, never saved.
          console.warn('[ground] A spell ground shape was not cut:', shape, e);
          continue;
        }
        let changed = live.length === 0;
        for (const ground of live) changed = record.editGround(ground, shape) !== null || changed;
        if (!changed) continue;
        const sequence = Math.max(
          record.nextGroundShapeSequence(deltasRef.current ?? [], artifact),
          (lastSequence.current.get(artifact) ?? 0) + 1,
        );
        lastSequence.current.set(artifact, sequence);
        dispatch({ type: 'APPLY_WORLDFORGE_DELTA', payload: { delta: record.groundShapeDelta(artifact, shape, sequence) } });
      }
    }).catch((e) => {
      console.error('[ground] A spell ground edit failed:', e);
    });
  }, [dispatch]);

  const takeLogEntry = useCallback((entry: CombatLogEntry) => {
    const map = mapRef.current;
    if (!map?.worldGround || seen.current.has(`log:${entry.id}`)) return;
    const shapes = groundShapesOfTerrainLog(entry, map);
    if (shapes.length === 0) return;
    seen.current.add(`log:${entry.id}`);
    apply(shapes, map);
  }, [apply]);

  const takeAnimations = useCallback((animations: readonly Animation[] | undefined) => {
    const map = mapRef.current;
    if (!map?.worldGround || !animations) return;
    for (const anim of animations) {
      if (anim.type !== 'spell_effect' || seen.current.has(`anim:${anim.id}`)) continue;
      const impact = (anim.data as SpellEffectAnimationData | undefined)?.groundImpact;
      const at = anim.endPosition;
      if (!impact || !at) continue;
      seen.current.add(`anim:${anim.id}`);
      const shape = groundShapeOfImpact(impact, at, map);
      if (shape) apply([shape], map);
    }
  }, [apply]);

  return { takeLogEntry, takeAnimations };
}
