// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 22:20:02
 * Dependents: systems/spells/targeting/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TargetableObject } from './TargetResolver'
import type { BattleMapData, Position } from '@/types/combat'
import type { RoomFeature } from '@/types/dungeon'
import type { Item } from '@/types/items'

/**
 * This file collects positioned object candidates for spell targeting.
 *
 * The target resolver can already validate an object once something supplies a
 * real object envelope. This adapter is the narrow bridge between combat/map
 * state and that resolver: it accepts explicit positioned objects, refuses to
 * infer mechanics from visual decorations, and returns stable candidates that
 * object-targeting spells can validate.
 *
 * Called by: future combat selection hooks and current focused object-targeting
 * tests.
 * Depends on: TargetResolver's TargetableObject shape.
 */

// ============================================================================
// Registry Input Shape
// ============================================================================
// This section defines the intentionally small input contract. Battle maps may
// grow a `targetableObjects` list, and callers may also pass explicit candidates
// from another system. We do not inspect decorative tiles here because a tree or
// boulder visual lacks required spell facts such as weight, worn/carried status,
// magical status, and whether it is fixed to a surface.
// ============================================================================

export interface ObjectTargetRegistryMapSource {
  targetableObjects?: TargetableObject[]
}

export interface PositionedRoomFeatureTarget {
  feature: RoomFeature
  position: Position
  targetFacts?: Omit<TargetableObject, 'id' | 'name' | 'position'>
}

export interface PositionedLooseItemTarget {
  item: Item
  position: Position
  instanceId?: string
  size?: string
  isWornOrCarried?: boolean
  isFixedToSurface?: boolean
}

export interface ObjectTargetRegistryInput {
  mapData?: ObjectTargetRegistryMapSource | null
  explicitObjects?: TargetableObject[]
  roomFeatures?: PositionedRoomFeatureTarget[]
  looseItems?: PositionedLooseItemTarget[]
}

// ============================================================================
// Candidate Collection
// ============================================================================
// This section merges explicit object sources into the candidate list used by
// TargetResolver. Explicit objects win over map-backed objects with the same ID
// because the caller that supplied them is closer to the current player action.
// ============================================================================

export function collectObjectTargetCandidates(input: ObjectTargetRegistryInput): TargetableObject[] {
  const candidatesById = new Map<string, TargetableObject>()

  // Map-backed objects are the durable encounter-level registry. They are added
  // first so one-off explicit objects can override them when a caller has fresher
  // or more specific object facts for the current selection.
  for (const targetObject of input.mapData?.targetableObjects ?? []) {
    candidatesById.set(targetObject.id, targetObject)
  }

  // Explicit candidates cover tests, scripted encounters, or future adapters
  // that already know exactly which positioned object should be targetable.
  for (const targetObject of input.explicitObjects ?? []) {
    candidatesById.set(targetObject.id, targetObject)
  }

  // Loose item candidates are intentionally opt-in: loot and inventory systems
  // must provide a position before an item can become a spell target. This keeps
  // unpositioned loot results from becoming imaginary objects on the battle map.
  for (const looseItem of input.looseItems ?? []) {
    const targetObject = toLooseItemTargetObject(looseItem)

    candidatesById.set(targetObject.id, targetObject)
  }

  // Dungeon room features are real interactive objects, but not every feature
  // has enough spell-targeting facts to safely become an object target. Only
  // convert positioned features when a room or encounter producer supplies those
  // facts explicitly.
  for (const roomFeature of input.roomFeatures ?? []) {
    if (!roomFeature.targetFacts) {
      continue
    }

    candidatesById.set(roomFeature.feature.id, {
      id: roomFeature.feature.id,
      name: roomFeature.feature.name,
      position: roomFeature.position,
      ...roomFeature.targetFacts
    })
  }

  return Array.from(candidatesById.values())
}

function toLooseItemTargetObject(looseItem: PositionedLooseItemTarget): TargetableObject {
  return {
    id: `loose-item-${looseItem.instanceId ?? looseItem.item.id}`,
    name: looseItem.item.name,
    position: looseItem.position,
    size: looseItem.size,
    weightPounds: looseItem.item.weight,
    isWornOrCarried: looseItem.isWornOrCarried ?? false,
    isMagical: Boolean(looseItem.item.magicProperties),
    isFixedToSurface: looseItem.isFixedToSurface ?? false
  }
}

// ============================================================================
// Battle Map Population
// ============================================================================
// This section gives encounter and dungeon setup code a safe way to attach the
// collected object candidates to a battle map. It returns a new map object rather
// than mutating the caller's current map state.
// ============================================================================

export function withObjectTargetCandidates(
  mapData: BattleMapData,
  input: Omit<ObjectTargetRegistryInput, 'mapData'>
): BattleMapData {
  return {
    ...mapData,
    targetableObjects: collectObjectTargetCandidates({
      ...input,
      mapData
    })
  }
}
