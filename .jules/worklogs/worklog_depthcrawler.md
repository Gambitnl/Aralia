# Depthcrawler Worklog

## 2024-05-20 - Darkness is just a word
**Learning:** The current combat engine tracks `LightSource`s but does not mechanically enforce visibility. Characters can target anything regardless of lighting.
**Action:** Implementing a `LightSystem` and `VisibilitySystem` to enforce Darkvision rules. The Underdark must be mechanically dark.

## 2024-05-20 - Abyssal Vision Implementation
**Learning:** D&D 5e visibility rules are complex (Bright > Dim > Darkness). To support this, `CharacterStats` needs an explicit `senses` field.
**Action:** Created `LightingSystem` (calculates light levels per tile) and `VisibilitySystem` (checks LoS and Darkvision). Updated `CombatCharacter` to include `senses`.

## 2024-05-20 - TODO: The Blinding of the Deep (Visibility System Plan)
**Status:** Deferred / Architected
**Context:** The Underdark is defined by darkness. Currently, the BattleMap renders everything. To truly simulate the alien depths, we need a rigorous visibility system that makes Light a resource and Darkness a threat.

### 1. Architecture: The `VisibilitySystem`
**Goal:** A centralized service to calculate what a specific character can see.
**Inputs:**
- `BattleMapData` (Tiles, Walls)
- `activeLightSources` (Torches, Spells, Bioluminescence)
- `CombatCharacter` (Position, Senses: Darkvision/Blindsight)
**Logic:**
- **Step 1: Light Grid.** Calculate the light level ('bright', 'dim', 'darkness') for every tile on the map based on all active light sources.
- **Step 2: Line of Sight.** Use Bresenham's algorithm (existing in `lineOfSight.ts`) to determine physical visibility.
- **Step 3: Vision Overlay.** Combine LoS with Light Grid.
    - If Tile is blocked by Wall -> Invisible.
    - If Tile is Darkness AND Character has no Darkvision -> Invisible.
    - If Tile is Darkness AND Character has Darkvision -> Visible (as Dim Light, Monochrome).
    - If Tile is Invisible -> Hide enemies/tokens on that tile.

### 2. Integration: The Veil (Fog of War)
**Goal:** Visually represent the unknown.
**Components:**
- `BattleMapTile`: Add `visibilityState` prop ('visible', 'fog', 'hidden').
    - `visible`: Render normally.
    - `fog`: Render terrain (memory), hide tokens.
    - `hidden`: Render black void.
- `BattleMap`: Calculate `visibleTiles` set for the *current player character* (or active turn character) and pass this down.

### 3. Mechanics: Terror in the Dark
**Goal:** You cannot kill what you cannot see.
**Changes to `useAbilitySystem`:**
- **Targeting Validation:** `isValidTarget` must check `VisibilitySystem.canSee(caster, target)`.
- **UI Feedback:** "Target is in darkness" or "Target unseen" error message.
- **Disadvantage:** Attacks against unseen targets (if guessed correctly) or targets in Dim Light (if relevant features apply) should carry Disadvantage.

### 4. Why This Matters
Without this, the Underdark is just a grey forest. With this, a torch flickering out (duration mechanics) becomes a lethal emergency.
