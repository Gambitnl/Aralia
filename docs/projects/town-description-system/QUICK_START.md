# Town Description System - Quick Start

## Immediate Action Items (Start Today)

### 0. Save State Architecture (30 minutes - CRITICAL FIRST STEP)

**Why First?** Prevents the exact problem you described - world changes between saves.

```typescript
// Add to src/types/save.ts
interface GameSaveData {
  metadata: {
    version: string;
    savedAt: Date;
    needsSave: boolean;
  };
  gameState: GameState;
  worldState: WorldState;
}

interface WorldState {
  worldSeed: number;              // Master seed - NEVER changes
  townStates: Map<string, PersistentTownData>;
  generatedAt: Date;
  integrityHash: string;
}

interface PersistentTownData {
  metadata: TownMetadata;
  layout: VillageLayout;
  npcs: TownNPC[];
  events: TownEvent[];
  generatedAt: Date;
  integrityHash: string;
}

// Basic save/load functions
function saveGameData(slotName: string): void {
  const saveData: GameSaveData = {
    metadata: { version: '1.0.0', savedAt: new Date(), needsSave: false },
    gameState: currentGameState,
    worldState: currentWorldState
  };
  localStorage.setItem(`aralia_save_${slotName}`, JSON.stringify(saveData));
}

function loadGameData(slotName: string): GameSaveData | null {
  const stored = localStorage.getItem(`aralia_save_${slotName}`);
  return stored ? JSON.parse(stored) : null;
}

// Town persistence integration
function persistTown(townData: TownData): void {
  currentWorldState.townStates.set(townData.metadata.id, {
    metadata: townData.metadata,
    layout: townData.layout,
    npcs: townData.npcs || [],
    events: townData.events || [],
    generatedAt: new Date(),
    integrityHash: generateIntegrityHash(townData)
  });
  currentGameState.metadata.needsSave = true;
}
```
```bash
# Add to src/types/index.ts
interface TownMetadata {
  id: string;
  name: string;
  worldCoords: { x: number; y: number };
  submapCoords: { x: number; y: number };
  biomeId: string;
  settlementType: SettlementType;
  population: TownPopulation;
  primaryIndustry: TownIndustry;
  governingBody: TownGovernment;
  culturalAlignment: TownCulture;
  generationSeed: number;
  detailLevel: DetailLevel;
  description?: TownDescription;
}

enum DetailLevel {
  BASIC = 'basic',
  DESCRIPTIVE = 'descriptive',
  POPULATED = 'populated'
}
```

### 2. Basic Name Generation (30 minutes)
```typescript
// Create src/utils/townGeneration.ts
export class TownNameGenerator {
  static generate(settlementType: SettlementType, biomeId: string, seed: number): string {
    const rng = new SeededRandom(seed);
    const templates = settlementType.namePatterns || ['{prefix}{suffix}'];

    // Simple implementation
    const prefixes = ['Oak', 'Stone', 'River', 'Hill', 'Green', 'Mist', 'Shadow', 'Bright'];
    const suffixes = ['ford', 'brook', 'vale', 'wood', 'field', 'haven', 'spire', 'cross'];

    const prefix = prefixes[Math.floor(rng.next() * prefixes.length)];
    const suffix = suffixes[Math.floor(rng.next() * suffixes.length)];

    return `${prefix}${suffix}`;
  }
}
```

### 3. Unified Seed System (25 minutes)
```typescript
// Add to src/utils/townGeneration.ts
export interface TownSeeds {
  nameSeed: number;
  layoutSeed: number;
  descriptionSeed: number;
  npcSeed: number;
  eventSeed: number;
}

export function generateTownSeeds(masterSeed: number, coords: {x: number, y: number}): TownSeeds {
  const rng = new SeededRandom(masterSeed + coords.x * 1000 + coords.y);
  return {
    nameSeed: rng.nextInt(),
    layoutSeed: rng.nextInt(),
    descriptionSeed: rng.nextInt(),
    npcSeed: rng.nextInt(),
    eventSeed: rng.nextInt()
  };
}
```

### 4. Town Metadata with Persistence (20 minutes)
```typescript
// Update TownMetadata interface
interface TownMetadata {
  id: string;
  name: string;
  worldCoords: { x: number; y: number };
  submapCoords: { x: number; y: number };
  biomeId: string;
  settlementType: SettlementType;
  generationSeed: number;      // Master seed
  townSeed: number;           // Specific town generation seed
  detailLevel: DetailLevel;
  townLayout?: VillageLayout; // Persisted layout
  lastGenerated?: Date;       // For cache validation
  description?: TownDescription;
  // ... other fields
}

// Modify src/services/mapService.ts or villageGenerator.ts
function generateTownMetadata(worldSeed: number, coords: {x: number, y: number}, biomeId: string): TownMetadata {
  const settlementType = getSettlementTypeForBiome(biomeId);
  const seeds = generateTownSeeds(worldSeed, coords);

  const metadata: TownMetadata = {
    id: `town_${coords.x}_${coords.y}_${worldSeed}`,
    name: TownNameGenerator.generate(settlementType, biomeId, seeds.nameSeed),
    worldCoords: coords,
    submapCoords: { x: 10, y: 10 }, // Center of submap
    biomeId,
    settlementType,
    generationSeed: worldSeed,
    townSeed: seeds.layoutSeed,  // Specific seed for town generation
    detailLevel: DetailLevel.BASIC
  };
  return metadata;
}
```

### 4. Add Proximity Detection (25 minutes)
```typescript
// Add to game state management
function checkTownProximity(playerCoords: WorldCoords): void {
  // Find towns within PROXIMITY_RANGE (e.g., 3 tiles)
  const nearbyTowns = getTownsInRange(playerCoords, 3)
    .filter(town => town.detailLevel === DetailLevel.BASIC);

  nearbyTowns.forEach(town => {
    // Trigger detail generation
    generateTownDetails(town.id);
  });
}
```

### 5. Coordinated Town Loading (25 minutes)
```typescript
// Add to src/services/townDescriptionService.ts (new file)
export async function loadTown(townId: string): Promise<TownData> {
  // Check persistence first
  const cached = loadTownState(townId);
  if (cached && isRecent(cached.metadata.lastGenerated)) {
    return cached;
  }

  const metadata = getTownMetadata(townId);
  const seeds = generateTownSeeds(metadata.generationSeed, metadata.worldCoords);

  // Generate town layout using town-specific seed
  const layout = await generateVillageLayout({
    worldSeed: seeds.layoutSeed,
    dominantRace: metadata.settlementType.dominantRace,
    biomeId: metadata.biomeId,
    isStartingSettlement: false
  });

  // Generate description informed by actual layout
  const layoutFeatures = extractLayoutFeatures(layout);
  const description = await TownDescriptionGenerator.generate(metadata, {
    layoutInfluence: layoutFeatures,
    seed: seeds.descriptionSeed
  });

  const townData: TownData = {
    metadata: {
      ...metadata,
      townLayout: layout,
      description,
      lastGenerated: new Date()
    },
    layout,
    description
  };

  // Persist for future visits
  saveTownState(townData);

  return townData;
}

// Extract features from generated layout
function extractLayoutFeatures(layout: VillageLayout): LayoutFeatures {
  const tiles = layout.tiles.flat();
  return {
    buildingCount: tiles.filter(tile => tile.type.startsWith('house_')).length,
    shopTypes: [...new Set(tiles
      .filter(tile => tile.type.startsWith('shop_'))
      .map(tile => tile.type))],
    hasTemple: tiles.some(tile => tile.type.includes('temple')),
    hasTavern: tiles.some(tile => tile.type.includes('tavern')),
    architecturalStyle: layout.personality?.architecturalStyle
  };
}
```

### 6. Persistence Implementation (15 minutes)
```typescript
// Add persistence functions
function saveTownState(townData: TownData): void {
  const persistentData = {
    metadata: townData.metadata,
    layout: townData.layout,
    description: townData.description,
    savedAt: new Date()
  };
  localStorage.setItem(`town_${townData.metadata.id}`, JSON.stringify(persistentData));
}

function loadTownState(townId: string): TownData | null {
  const stored = localStorage.getItem(`town_${townId}`);
  if (!stored) return null;
  return JSON.parse(stored);
}

function isRecent(lastGenerated: Date): boolean {
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  return Date.now() - new Date(lastGenerated).getTime() < oneHour;
}
```

## Testing Checklist

- [ ] Generate a new world and verify towns have unique names
- [ ] Move near a town and check if console logs show proximity detection
- [ ] Verify town metadata saves/loads correctly
- [ ] Test that descriptions generate without errors

## Next Steps (Tomorrow)

1. **Integrate with tooltips** - Show rich descriptions when available
2. **Add to town canvas** - Display generated details in town view
3. **Expand templates** - Add more variety and cultural specificity
4. **Performance testing** - Ensure generation is fast enough

## Key Files to Modify

- `src/types/index.ts` - Add TownMetadata interface
- `src/utils/townGeneration.ts` - Create generators (new file)
- `src/services/villageGenerator.ts` - Integrate metadata generation
- `src/types.ts` - Update MapData to include town metadata
- `src/components/Submap/SubmapPane.tsx` - Update tooltips
- `src/components/TownCanvas.tsx` - Show rich descriptions

## Success Indicators

- ✅ **Save State Consistency**: Towns remain identical across save/load cycles
- ✅ **No World Changes**: Generated content preserved between sessions
- ✅ **Immediate Persistence**: Content saved instantly upon generation
- ✅ Towns have unique, fitting names that persist
- ✅ Moving near towns triggers detail generation (from save data first)
- ✅ Tooltips show rich descriptions for nearby towns
- ✅ Performance remains smooth with town generation
- ✅ System works for both procedural and predefined towns

## Questions to Answer

1. How many towns should be detailed at once? (Memory limits)
2. What's the ideal proximity range for detail generation?
3. How much detail variation do we want per town type?
4. Should town details change over time/player actions?

## Get Help

- Review existing settlement generation code
- Check how tooltips currently work
- Look at existing NPC generation patterns
- Study the world map data structures
