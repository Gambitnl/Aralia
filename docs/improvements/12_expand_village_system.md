- [x] Plan Completed

# Plan: Expand Village System with Procedural Generation

## 1. Purpose

Transform the basic hardcoded village into a dynamic, procedurally generated system that creates unique villages each time, with varied infrastructure, buildings, and layouts. This will leverage the existing submap generation system and create a foundation for rich settlement interactions.

## 2. Current State Analysis

**Existing Assets:**
- ✅ Basic VillageScene.tsx with canvas rendering
- ✅ Village game phase and navigation system  
- ✅ Submap generation system (`src/utils/submapUtils.ts`)
- ✅ Seeded feature system for procedural placement
- ✅ Path generation algorithms for roads
- ✅ Exit mechanism (just implemented)

**Current Limitations:**
- ❌ Hardcoded 9x8 village layout
- ❌ Only 3 tile types (grass, path, inn door)
- ❌ No variety between villages
- ❌ No shops, houses, or varied infrastructure

## 3. Implementation Plan

### Phase 1: Enhanced Village Canvas System
**Goal:** Expand the current canvas-based village with more building types

- [ ] **Add Building Types**:
  - Houses (different styles: small, medium, large)
  - Shops (blacksmith, general store, tavern, temple)
  - Infrastructure (well, market square, guard post)
  - Special buildings (mayor's house, guild hall)

- [ ] **Expand Tile System**:
  ```typescript
  // New tile types beyond 0, 1, 2
  const TILE_TYPES = {
    GRASS: 0,
    PATH: 1, 
    INN: 2,
    HOUSE_SMALL: 3,
    HOUSE_MEDIUM: 4,
    HOUSE_LARGE: 5,
    BLACKSMITH: 6,
    GENERAL_STORE: 7,
    TEMPLE: 8,
    WELL: 9,
    MARKET_SQUARE: 10,
    GUARD_POST: 11
  };
  ```

- [ ] **Visual Improvements**:
  - Different colors/patterns for building types
  - Simple roof/door indicators
  - Path varieties (cobblestone, dirt)

### Phase 2: Procedural Village Layout Generation
**Goal:** Use the existing submap system to generate village layouts

- [ ] **Leverage Existing Systems**:
  - Extend `src/utils/submapUtils.ts` village seeded features
  - Use deterministic seeding based on world coordinates
  - Integrate with `src/config/submapVisualsConfig.ts`

- [ ] **Village Layout Algorithm**:
  ```typescript
  interface VillageGenerationConfig {
    size: 'small' | 'medium' | 'large';
    biome: string;
    population: number;
    specialBuildings: string[];
    pathStyle: 'planned' | 'organic';
  }
  ```

- [ ] **Building Placement Rules**:
  - Central plaza/square with key buildings
  - Residential areas on outskirts  
  - Commercial buildings near main paths
  - Special buildings (temple, guild) in prominent locations
  - Ensure all buildings connected by paths

### Phase 3: Advanced Village Features
**Goal:** Add depth and interactivity to villages

- [ ] **Building Interactions**:
  - Each building type has specific click behaviors
  - Shops open trade interfaces
  - Houses show residents/lore
  - Special buildings unlock unique actions

- [ ] **Village Personality System**:
  - Rich/poor villages with different building distributions
  - Cultural themes (mining town, farming village, trading post)
  - Biome-specific architecture styles
  - Population size affects building count/types

- [ ] **Integration with Game Systems**:
  - NPCs spawn in appropriate buildings
  - Village type affects available services
  - Quest locations generated based on village features
  - Economic simulation (what villages produce/need)

## 4. Technical Architecture

### Leveraging Existing Systems

**Submap Generation Integration:**
```typescript
// Extend existing seeded features in submapVisualsConfig.ts
const villageFeatures = {
  buildings: [
    { type: 'inn', probability: 1.0, size: [2,2] },
    { type: 'house', probability: 0.7, size: [1,1] }, 
    { type: 'shop', probability: 0.4, size: [1,1] },
    // ... more building types
  ],
  pathSystem: {
    style: 'organic', // or 'planned'
    connectivity: 'all_buildings',
    mainRoad: true
  }
};
```

**Village Generation Service:**
```typescript
// New file: src/services/villageGenerator.ts
export interface GeneratedVillage {
  layout: number[][];
  buildings: VillageBuilding[];
  paths: VillagePath[];
  metadata: VillageMetadata;
}

export function generateVillage(
  worldX: number, 
  worldY: number, 
  biome: string,
  seed: number
): GeneratedVillage {
  // Use existing seeded random from submapUtils
  // Apply building placement algorithms
  // Generate connecting paths
  // Return complete village data
}
```

### Integration Points

1. **VillageScene.tsx**: Update to receive generated village data
2. **useGameActions.ts**: Handle building-specific interactions  
3. **submapUtils.ts**: Extend seeded features for village generation
4. **App.tsx**: Pass world coordinates to village generation

## 5. Benefits of This Approach

- **Leverages Existing Code**: Uses proven submap generation system
- **Scalable**: Can easily add new building types and features
- **Consistent**: Uses same seeding/randomization as world generation
- **Performance**: Canvas rendering is lightweight and fast
- **Extensible**: Foundation for future settlement features

## 6. Next Steps

1. Start with Phase 1 to expand tile types and visual variety
2. Create village generation service using existing submap patterns
3. Integrate procedural generation with current VillageScene
4. Add building interactions and village personality systems

This approach builds on the strong foundation already in place while creating a rich, varied village experience that fits seamlessly into the existing game architecture.
