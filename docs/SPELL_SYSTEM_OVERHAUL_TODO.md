# Spell System Overhaul: "The Gold Standard"

## The Objective
Transition the spell system from an "Inferred" model (regex parsing of text descriptions) to an "Explicit" model (component-based JSON data). The goal is to eliminate fragility and enable complex spell mechanics (utility, multi-effect, hybrid targeting) that are currently impossible.

## Target Architecture (The "Gold" Standard)

Every spell must be defined by **What It Does** (Effects), not **What It Says** (Text).

### 1. Explicit Targeting
Decouple "Who/Where" from "What".
*   **Range:** `Self`, `Touch`, `Ranged` (feet).
*   **AoE:** `Cone`, `Cube`, `Sphere`, `Line`, `Cylinder` (with explicit Dimensions).
*   **Selection:** `All` (Fireball), `Choice` (Mass Cure Wounds), `Self` (Shield).
*   **Filter:** `Creature`, `Object`, `Point`, `Enemy`, `Ally`.

### 2. Component-Based Effects
A spell is a container for one or more Effects.
*   `Damage`: `{ type: 'fire', amount: '8d6' }`
*   `Heal`: `{ amount: '1d8 + MOD' }`
*   `ApplyStatus`: `{ id: 'invisible', duration: '1h' }`
*   `Teleport`: `{ range: '30ft' }`
*   `Summon`: `{ entityId: 'spiritual_weapon' }`
*   `Terrain`: `{ type: 'fire_surface', duration: '1m' }`

## Implementation Phases

### Phase 1: Data Standardization (The Foundation)
*   [ ] Define the strict TypeScript interfaces for the new `Spell` schema.
*   [ ] Audit `docs/spells/` to identify all "Silver" and "Bronze" spells.
*   [ ] Migrate all spells to the new JSON format.

### Phase 2: Geometric Algorithms (The Math)
*   [ ] Implement precise grid algorithms for 5e shapes (Cone, Line, Sphere).
*   [ ] Create a visual test bench to verify coverage (e.g., "Does a 15ft cone hit 3 tiles or 6?").

### Phase 3: UI & Interaction
*   [ ] Update `BattleMap` to render accurate AoE templates during targeting.
*   [ ] Implement "Multi-Select" targeting for spells like *Magic Missile* or *Bless*.

### Phase 4: Logic Integration
*   [ ] Update `spellAbilityFactory.ts` to read the new schema directly (remove regex inference).
*   [ ] Update `useAbilitySystem.ts` to execute the component-based Effects.

---
*Draft Status: Spitballing in progress...*
