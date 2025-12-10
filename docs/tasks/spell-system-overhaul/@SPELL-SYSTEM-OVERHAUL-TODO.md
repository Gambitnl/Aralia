# Spell System Overhaul: "The Gold Standard"

**Last Updated:** 2025-12-11

> **Related Documentation:**
> - [SPELL_INTEGRATION_STATUS.md](./SPELL_INTEGRATION_STATUS.md) - High-level status overview and statistics
> - [SPELL_SYSTEM_ARCHITECTURE.md](./architecture/SPELL_SYSTEM_ARCHITECTURE.md) - Complete 8-pillar architecture
> - [SPELL_INTEGRATION_CHECKLIST.md](./spells/SPELL_INTEGRATION_CHECKLIST.md) - Detailed testing procedures

## The Objective

Transition the spell system from an "Inferred" model (regex parsing of text descriptions) to an "Explicit" model (component-based JSON data). The goal is to eliminate fragility and enable complex spell mechanics (utility, multi-effect, hybrid targeting) that are currently impossible.

## Target Architecture (The "Gold" Standard)

Every spell must be defined by **What It Does** (Effects), not **What It Says** (Text).

### 1. Explicit Targeting

Decouple "Who/Where" from "What". **Status: IMPLEMENTED** in [src/types/spells.ts:158-214](src/types/spells.ts#L158-L214)

*   **Range:** `self`, `touch`, `ranged`, `special` - via `Range` interface (line 127)
*   **AoE:** `Cone`, `Cube`, `Sphere`, `Line`, `Cylinder` - via `AreaOfEffect` interface (line 170)
*   **Selection:** `SingleTargeting`, `MultiTargeting`, `AreaTargeting`, `SelfTargeting`, `HybridTargeting` - discriminated union
*   **Filter:** `creatures`, `objects`, `allies`, `enemies`, `self`, `point` - via `TargetFilter` type (line 167)

### 2. Component-Based Effects

A spell is a container for one or more Effects. **Status: IMPLEMENTED** in [src/types/spells.ts:220-375](src/types/spells.ts#L220-L375)

*   `DamageEffect`: `{ type: 'DAMAGE', damage: { dice: '8d6', type: 'Fire' } }`
*   `HealingEffect`: `{ type: 'HEALING', healing: { dice: '2d8+5' } }`
*   `StatusConditionEffect`: `{ type: 'STATUS_CONDITION', statusCondition: { name: 'Invisible', duration: {...} } }`
*   `MovementEffect`: `{ type: 'MOVEMENT', movementType: 'teleport', distance: 30 }`
*   `SummoningEffect`: `{ type: 'SUMMONING', creatureId: 'spiritual_weapon', count: 1 }`
*   `TerrainEffect`: `{ type: 'TERRAIN', terrainType: 'damaging', damage: {...} }`
*   `UtilityEffect`: `{ type: 'UTILITY', utilityType: 'light', description: '...' }`
*   `DefensiveEffect`: `{ type: 'DEFENSIVE', defenseType: 'ac_bonus', value: 5 }`

## Implementation Phases

### Phase 1: Data Standardization (The Foundation)

*   [x] Define the strict TypeScript interfaces for the new `Spell` schema.
    - **Completed:** Full interface hierarchy in [src/types/spells.ts](src/types/spells.ts) (466 lines)
    - Includes type guards: `isSpell()`, `isDamageEffect()`, `isHealingEffect()`, etc.
*   [x] Audit `docs/spells/` to identify all "Silver" and "Bronze" spells.
    - **Completed:** Status tracked across 10 files ([STATUS_LEVEL_0.md](./spells/STATUS_LEVEL_0.md) through [STATUS_LEVEL_9.md](./spells/STATUS_LEVEL_9.md))
    - **Current Statistics (as of 2025-12-04):**
      - Total spells in manifest: 375
      - 🟢 Gold (Structured): 1 spell (0.3%)
      - 🟡 Silver (Inferred): 80 spells (22.9%)
      - ⚪ Bronze (Metadata): 269 spells (76.9%)
*   [~] Migrate all spells to the new JSON format.
    - **In Progress:** PR #38 (5 Level 1 spells) and PR #39 (Cantrips) merged. Pattern established.
    - JSON files exist in `public/data/spells/` (flat structure, not level-based subfolders)
    - Manifest: [public/data/spells_manifest.json](public/data/spells_manifest.json)
    - See [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) for current workflow

### Phase 2: Geometric Algorithms (The Math)

*   [ ] Implement precise grid algorithms for 5e shapes (Cone, Line, Sphere).
    - **Not Started:** No dedicated geometry module found in codebase
*   [ ] Create a visual test bench to verify coverage (e.g., "Does a 15ft cone hit 3 tiles or 6?").
    - **Not Started**

### Phase 3: UI & Interaction

*   [~] Update `BattleMap` to render accurate AoE templates during targeting.
    - **Partial:** Basic AoE preview exists via `previewAoE()` in [src/components/BattleMap/BattleMap.tsx:49-62](src/components/BattleMap/BattleMap.tsx#L49-L62)
    - Needs geometric algorithm integration for precise 5e shapes
*   [ ] Implement "Multi-Select" targeting for spells like *Magic Missile* or *Bless*.
    - **Not Started:** `MultiTargeting` interface exists, UI not implemented

### Phase 4: Logic Integration

*   [~] Update `spellAbilityFactory.ts` to read the new schema directly (remove regex inference).
    - **Partial:** Factory at [src/utils/spellAbilityFactory.ts](src/utils/spellAbilityFactory.ts) supports both legacy and new formats
    - Falls back to regex parsing when `effects[]` array is missing (Silver/Bronze spells)
*   [~] Update `useAbilitySystem.ts` to execute the component-based Effects.
    - **Partial:** Hook exists at [src/hooks/useAbilitySystem.ts](src/hooks/useAbilitySystem.ts)
    - Handles `DamageEffect`, `HealingEffect` types; other effect types need implementation

---

## Next Steps

1. **Complete Level 0 cantrip migration** - 27 cantrips need JSON data completion
2. **Implement geometric grid algorithms** - Critical blocker for accurate AoE
3. **Add multi-target UI** - Required for spells like Magic Missile
4. **Expand effect handlers** - `MovementEffect`, `SummoningEffect`, `TerrainEffect` not yet consumed by combat engine

---

**Document Status:** Active implementation guide (supersedes "spitballing" draft)
