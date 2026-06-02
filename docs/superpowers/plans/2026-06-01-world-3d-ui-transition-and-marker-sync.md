# Plan 4: 2D↔3D Transition + Bidirectional Atlas Marker Sync

**Status:** draft  
**Created:** 2026-06-01  
**Owner:** claude  
**Surface:** `world-3d-ui` (transition + HUD layer)  
**Dependencies:** `world3d` rendering engine (Plan 1-3 complete), `worldsim-service`  
**Governing Spec:** `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` §7–§9  

---

## Intent

Design the orchestration layer that:
1. Transitions the player from the 2D Azgaar atlas into the streamed 3D world (and back)
2. Keeps a bidirectional marker sync between the 3D player position and the 2D atlas
3. Defines the in-3D HUD surface (control panel, view-mode toggle, nameplates, minimap, debug overlays)

This plan is **design-only**; implementation happens in subsequent slices.

---

## Scope Boundaries

### In Scope (world-3d-ui)
- Transition orchestration: entry trigger, camera dive animation, scene mount/unmount handoff with world3d
- `playerWorldPos` game-state anchor and its subscription model
- Bidirectional marker sync: 3D→atlas projection + atlas→3D click-to-travel
- Phase/entry wiring that makes the 3D world reachable from PLAYING phase
- In-3D HUD component surface (defined here, built incrementally later)

### Out of Scope (owned elsewhere)
- Chunk streaming, mesh generation, R3F scene, camera controller — `world3d`
- World generation + history/story/events — `worldsim-service`
- Combat HUD / `BattleMap3D` — separate combat surfaces
- TownCanvas handoff — spec §10, deferred to later

---

## Current Architecture

### Entry Today
- `?phase=world3d` → `useHistorySync` maps slug → `GamePhase.WORLD3D_DEMO` → `<World3DDemo />`
- `World3DDemo` is a self-contained sandbox: generates its own world via `runWorldSim`, uses inline loader
- No real transition from PLAYING/atlas; you jump straight to the sandbox
- **Fix applied (W3DUI-5):** Added URL-phase guard to prevent `handleLegacyDummyAutoStart` from hijacking deep links

### World3D Scene
- `World3DScene` accepts `loader: ChunkLoader` + `start: [x, y, z]`
- Uses `useChunkStreaming` hook to manage chunk load/unload lifecycle
- Renders terrain, water, roads, sites, vegetation via `ChunkPieces`
- Fixed-origin rendering: scene drawn relative to `sceneOrigin` for floating-point precision

### Atlas Today
- `MapPane.tsx` renders the Azgaar atlas SVG in map mode
- No 3D position marker subscription
- No click-to-travel handler
- Click interactions are for exploration/discovery, not world entry

### Game State
- `GameState` has no `playerWorldPos` field yet (spec §7.3 mentions it for saves)
- `GameState.phase` controls which view is mounted
- No concept of "dual-mode" (atlas + 3D simultaneously)

---

## Design Decisions

### 1. Entry Model: Mode vs. Separate Phase

**Question:** Does the real entry replace `WORLD3D_DEMO`, or layer on top of the live PLAYING phase?

**Decision:** **Layer on top of PLAYING phase** (not a separate phase).

**Rationale:**
- The 3D world is a **view mode** of the same game state, not a separate screen
- Player position, party, inventory, time, NPCs must persist across the transition
- A separate phase would require serializing/deserializing state, which is error-prone
- The spec §8 implies the atlas can be "faded out" while 3D is mounted — this requires both to coexist
- `World3DDemo` remains as a dev-only sandbox for testing the rendering engine in isolation

**Implementation Pattern:**
```
GameState {
  phase: GamePhase.PLAYING,
  worldViewMode: 'atlas' | '3d',  // NEW: view mode within PLAYING
  playerWorldPos: { x: number, y: number, z: number },  // NEW: 3D position (spec §7.3)
  // ... existing fields
}
```

When `worldViewMode === '3d'`, the PLAYING phase renders:
- `<World3DScene />` (from world3d, with real loader + playerWorldPos)
- `<InWorldHUD />` (from world-3d-ui, overlays the 3D canvas)
- Atlas is unmounted (or paused, configurable per §8.2)

When `worldViewMode === 'atlas'`, the PLAYING phase renders:
- `<MapPane />` (atlas SVG with marker)
- `<GameLayout />` (existing 2D UI)

### 2. Transition Controller

**Responsibility:** Orchestrate the mount/unmount handoff between atlas and 3D scene.

**Location:** `src/components/World3D/TransitionController.tsx` (new, world-3d-ui surface)

**API:**
```tsx
interface TransitionControllerProps {
  /** Current view mode */
  mode: 'atlas' | '3d';
  /** Target world position for entry (from atlas click or last known 3D pos) */
  entryPosition: { x: number; y: number };
  /** Called when transition completes */
  onComplete: () => void;
  /** Children: the 3D scene (only rendered when mode === '3d') */
  children: React.ReactNode;
}
```

**Entry Sequence (atlas → 3D):**
1. User clicks "Enter world" on discovered tile OR zooms past threshold
2. `TransitionController` resolves click target → `(wx, wy)`
3. Dispatch `SET_WORLD_VIEW_MODE('3d')` + `SET_PLAYER_WORLD_POS({ x: wx, y: wy, z: terrainHeight })`
4. Fade-out atlas SVG over ~300ms (Framer Motion)
5. Mount `<World3DScene loader={realLoader} start={[wx, terrainHeight, wy]} />`
6. Camera dive animation: lerp from top-down framing to BG3-style orbit over ~1500ms
   - Use `FreeRoamCameraController` with animated `initialTarget` + `initialDistance`
   - If chunks aren't loaded by dive end, camera waits at destination until first chunk ready
7. Player gains 3D input control
8. `onComplete()` fires

**Exit Sequence (3D → atlas):**
1. User opens world map (existing keybind) OR clicks HUD "Open Map" button
2. Camera lerps up to high orbit over ~800ms
3. Dispatch `SET_WORLD_VIEW_MODE('atlas')`
4. Fade-in atlas SVG over ~400ms
5. `World3DScene` is unmounted **but** chunk state is preserved in `ChunkStreamer` cache (configurable)
   - Option: keep mounted but paused (spec §8.2) — **defer to implementation** based on perf testing

**Key Boundary:**
- `TransitionController` (world-3d-ui) **orchestrates** the transition
- `World3DScene` (world3d) **owns** the R3F scene, camera, chunk streaming
- `TransitionController` passes props to `World3DScene`; it does not reach into R3F internals

### 3. playerWorldPos Game-State Anchor

**Location:** Added to `GameState` in `src/state/initialState.ts` + `src/state/appReducer.ts`

**Type:**
```ts
interface PlayerWorldPosition {
  x: number;  // world meters
  y: number;  // height (terrain Y)
  z: number;  // world meters (Z is Y in 2D atlas coords)
}

// In GameState:
playerWorldPos: PlayerWorldPosition | null;  // null when in 2D-only mode
```

**Actions:**
```ts
// actionTypes.ts
| { type: 'SET_PLAYER_WORLD_POS'; payload: PlayerWorldPosition }
| { type: 'CLEAR_PLAYER_WORLD_POS' }
```

**Update Flow:**
- `FreeRoamCameraController` reports position changes via `onPositionChange(x, z)`
- `World3DScene` (or a wrapper in world-3d-ui) dispatches `SET_PLAYER_WORLD_POS` with updated position
- Terrain height `y` is looked up from `WorldData.heights` via bilinear interpolation (helper from worldsim-service)
- Throttled to ~10Hz to avoid dispatch spam (use `useThrottle` or similar)

**Subscription Model:**
- Atlas marker component subscribes to `gameState.playerWorldPos` via `useSelector`-style pattern
- When atlas is mounted, it projects `(wx, wy)` → SVG coords and renders `<circle>` marker
- When atlas is unmounted (3D mode active), no updates fire (component unmounted, subscription inactive)

### 4. Bidirectional Marker Sync

#### 4.1 3D → Atlas (Live Position)

**Component:** `src/components/World3D/AtlasPlayerMarker.tsx` (new, world-3d-ui)

**Logic:**
```tsx
const AtlasPlayerMarker: React.FC = () => {
  const playerWorldPos = useAppSelector(state => state.playerWorldPos);
  if (!playerWorldPos) return null;
  
  // Project world meters → SVG units
  // Simple scalar transform: (worldX, worldZ) → (svgX, svgY)
  const svgPos = worldToSvgCoords(playerWorldPos.x, playerWorldPos.z);
  
  return (
    <circle
      cx={svgPos.x}
      cy={svgPos.y}
      r={4}
      fill="#ff4444"
      stroke="#fff"
      strokeWidth={1}
    />
  );
};
```

**Coordinate Transform:**
- World dimensions: `60 cols × 40 rows × 8 chunks/col × 128m/chunk` = ~61km × 41km
- Atlas SVG dimensions: depends on viewport, but typically ~2000×1333 SVG units
- Transform: `svgX = (worldX / worldWidth) * svgWidth`, `svgY = (worldZ / worldHeight) * svgHeight`
- Helper: `src/utils/worldCoords.ts` (new, shared between world-3d-ui and map components)

#### 4.2 Atlas → 3D (Click-to-Travel)

**Component:** Modified `MapPane.tsx` (or new wrapper in world-3d-ui)

**Logic:**
```tsx
const handleAtlasClick = (svgX: number, svgY: number) => {
  // Reverse-project SVG click → world meters
  const worldPos = svgToWorldCoords(svgX, svgY);
  
  // Check if clicked tile is discovered (can only travel to discovered tiles)
  const tile = getTileAtWorldPos(worldPos);
  if (!tile.discovered) {
    dispatchNotification('Cannot travel to undiscovered areas.');
    return;
  }
  
  // Trigger transition
  dispatch(SET_PLAYER_WORLD_POS({ x: worldPos.x, y: 0, z: worldPos.z })); // y resolved during transition
  dispatch(SET_WORLD_VIEW_MODE('3d'));
  // TransitionController takes over from here
};
```

### 5. Loader Strategy: Inline vs. Worker

**Question:** Inline vs. worker-backed loader for the live entry?

**Decision:** **Worker-backed loader** for production entry; inline loader stays in `World3DDemo` for dev sandbox.

**Rationale:**
- `createWorkerChunkLoader` already exists in `world3d` (Plan 3)
- Worker loader prevents main-thread blocking during chunk generation
- Transition perf budget: ~1500ms dive animation; worker loader can pre-load chunks during this window
- `World3DDemo` uses inline loader for simplicity (no worker setup in sandbox)

**Implementation:**
```tsx
// In the real entry wrapper (not World3DDemo):
const loader = useMemo(() => createWorkerChunkLoader(worldData), [worldData]);
<World3DScene loader={loader} start={entryPosition} />
```

### 6. In-3D HUD Surface

**Component:** `src/components/World3D/InWorldHUD.tsx` (new, world-3d-ui)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [Top Bar]                                  │
│  Location Name  |  Time  |  [Controls ▼]   │
│                                             │
│                                             │
│              3D Canvas                      │
│                                             │
│  [Bottom Left]         [Bottom Right]       │
│  Minimap              View Mode Toggle      │
│  (radar)            [3D] [Atlas] [Exit]     │
└─────────────────────────────────────────────┘
```

**Sub-Components:**
1. **Control Panel** (`HUDControlPanel.tsx`): Dropdown menu with settings, debug toggles, map open
2. **View Mode Toggle** (`ViewModeToggle.tsx`): Switch between 3D/Atlas, exit to menu
3. **Nameplates** (`NameplateOverlay.tsx`): 3D→2D projection of NPC/site labels (uses R3F `Html` from `@react-three/drei`)
4. **Minimap** (`MinimapRadar.tsx`): Small radar-style minimap showing player + nearby entities
5. **Debug Overlays** (`DebugHUD.tsx`): Chunk load count, FPS, player coords, streamer stats (dev-only)

**Mounting:**
- `InWorldHUD` is a sibling of `World3DScene` in the PLAYING phase render tree
- Uses `position: absolute; pointer-events: auto` to overlay the canvas
- Does **not** interfere with R3F event handling (canvas captures pointer events first)
- HUD components are pure React (no R3F), except `NameplateOverlay` which uses `<Html>` portals

**Scope for MVP (Plan 4 build phase):**
- Control Panel (basic: map open, exit to menu)
- View Mode Toggle (3D ↔ Atlas)
- Debug HUD (dev-only, behind dev mode flag)
- **Deferred:** Nameplates, Minimap (separate follow-up task)

---

## File Map

### New Files (world-3d-ui surface)
```
src/
├── components/
│   └── World3D/
│       ├── TransitionController.tsx          # Entry/exit orchestration
│       ├── InWorldHUD.tsx                    # HUD container
│       ├── HUDControlPanel.tsx               # Settings/menu dropdown
│       ├── ViewModeToggle.tsx                # 3D/Atlas/Exit toggle
│       ├── DebugHUD.tsx                      # Dev overlays
│       ├── AtlasPlayerMarker.tsx             # 3D→atlas marker
│       └── NameplateOverlay.tsx              # 3D→2D label projection (deferred)
├── hooks/
│   └── useWorldViewMode.ts                   # Game-state view mode selector
├── utils/
│   └── worldCoords.ts                        # World↔SVG coordinate transforms
└── state/
    ├── actionTypes.ts                        # Add SET_PLAYER_WORLD_POS, SET_WORLD_VIEW_MODE
    └── appReducer.ts                         # Handle new actions
```

### Modified Files
```
src/
├── App.tsx                                   # PLAYING phase renders 3D when worldViewMode === '3d'
├── types/
│   └── core.ts                               # Add playerWorldPos, worldViewMode to GameState
├── components/MapPane.tsx                    # Add click-to-travel handler + marker subscription
└── components/World3D/World3DDemo.tsx        # Add comment: dev-only sandbox, not production entry
```

### Unchanged (world3d surface)
```
src/components/World3D/
├── World3DScene.tsx                          # No changes; accepts props from world-3d-ui
├── useChunkStreaming.ts                      # No changes
├── FreeRoamCameraController.tsx              # No changes (already reports world coords)
└── ...                                       # All rendering logic stays in world3d
```

---

## State Flow Diagram

```
[Atlas Mode]
  ↓ (user clicks "Enter World" on discovered tile)
[TransitionController]
  → resolves click → (wx, wy)
  → dispatches SET_PLAYER_WORLD_POS({ x: wx, y: 0, z: wy })
  → dispatches SET_WORLD_VIEW_MODE('3d')
  → fade-out atlas (300ms)
  ↓
[3D Mode Mounts]
  → World3DScene mounts with loader + start position
  → camera dive animation (1500ms)
  → chunks stream in via ChunkStreamer
  → InWorldHUD mounts (control panel, toggle, debug)
  ↓
[3D Gameplay]
  → FreeRoamCameraController reports position changes
  → dispatches SET_PLAYER_WORLD_POS (throttled ~10Hz)
  → gameState.playerWorldPos updates
  ↓ (user opens map / clicks "Atlas" toggle)
[TransitionController Exit]
  → camera lerp up (800ms)
  → dispatches SET_WORLD_VIEW_MODE('atlas')
  → fade-in atlas (400ms)
  → World3DScene unmounts (or pauses)
  ↓
[Atlas Mode]
  → AtlasPlayerMarker subscribes to playerWorldPos
  → renders marker at projected SVG coords
```

---

## Acceptance Criteria

### MVP (this plan's build phase)
- [ ] Player can enter 3D world from atlas via click on discovered tile
- [ ] Camera dive animation plays during entry (top-down → orbit)
- [ ] Chunks stream in during/after dive
- [ ] Player can exit back to atlas via keybind or HUD button
- [ ] `playerWorldPos` is tracked in game state and updates during 3D movement
- [ ] Atlas shows live marker tracking player position when atlas is visible
- [ ] Clicking atlas tile triggers entry to 3D at that position
- [ ] Control panel with "Open Map" + "Exit to Menu" buttons
- [ ] View mode toggle switches between 3D and atlas
- [ ] Debug HUD shows chunk count, player coords, FPS (dev-only)
- [ ] `World3DDemo` remains functional as dev sandbox (unchanged)

### Deferred (follow-up tasks)
- [ ] Nameplates/labels for NPCs and sites in 3D view
- [ ] Minimap radar showing player + nearby entities
- [ ] Chunk pause vs. unmount decision (perf testing)
- [ ] TownCanvas handoff (spec §10)
- [ ] Combat encounter trigger from 3D world (spec §11)

---

## Open Questions

| Question | Impact | Resolution Needed By |
|----------|--------|---------------------|
| Should `World3DScene` stay mounted but paused in atlas mode, or fully unmount? | Perf vs. re-entry speed | Implementation phase (test both) |
| How is terrain height (`y`) resolved during entry? | Need bilinear interp helper from WorldData | Plan 4 build (add to worldsim-service or worldCoords util) |
| Should atlas click-to-travel require "fast travel" affordance, or work on any discovered tile? | UX decision | Operator (game design) |
| What's the throttling rate for `playerWorldPos` dispatches? | Perf vs. marker smoothness | Implementation (start with 10Hz, adjust) |

---

## Related Gaps

| Gap ID | Status | Relationship |
|--------|--------|--------------|
| W3DUI-5 | done | Cold-load entry bounce (fixed; prerequisite for testing this plan) |
| W3DUI-6 | not_started | Sandbox-only entry (solved by this plan's production entry path) |
| W3DUI-7 | not_started | Bidirectional marker sync (core deliverable of this plan) |
| W3DUI-8 | not_started | No in-3D HUD (scoped in this plan, built incrementally) |
| W3DUI-3 | not_started | No mount/unmount lifecycle test (add after this plan's build) |
| W3DUI-1 | not_started | Demo uses inline loader (intentional; production entry uses worker loader per this plan) |

---

## Verification Strategy

1. **Manual Testing:**
   - Start in PLAYING phase (atlas mode)
   - Click discovered tile → verify dive animation, chunk streaming, 3D control
   - Move in 3D → verify `playerWorldPos` updates (check debug HUD)
   - Open map → verify camera lerp up, atlas fade-in, marker tracks position
   - Click atlas tile → verify re-entry to 3D at clicked position

2. **Automated Testing (Post-Build):**
   - Playwright test: entry → movement → exit → marker sync round-trip
   - RTL test: `TransitionController` mount/unmount lifecycle (W3DUI-3)
   - Unit test: `worldCoords.ts` transform functions (bidirectional)

3. **Perf Checks:**
   - Entry transition should complete within 2000ms (300ms fade + 1500ms dive + 200ms buffer)
   - Chunk load during dive: at least 1 chunk ready before dive ends
   - `playerWorldPos` dispatch throttling: no more than 10 dispatches/sec during continuous movement

---

## Next Steps

1. **Review this plan** with operator/claude
2. **Implement in slices:**
   - Slice 1: Game-state anchors (`playerWorldPos`, `worldViewMode`, actions, reducer)
   - Slice 2: `TransitionController` + entry/exit sequences
   - Slice 3: `InWorldHUD` (control panel, toggle, debug)
   - Slice 4: `AtlasPlayerMarker` + atlas click-to-travel
   - Slice 5: Integration testing + perf optimization
3. **Update TRACKER.md** with implementation tasks
4. **Begin Slice 1** after plan approval

---

**End of Plan 4**
