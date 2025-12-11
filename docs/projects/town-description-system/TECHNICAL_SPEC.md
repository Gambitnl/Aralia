# Town Description System - Technical Specification

## Data Structures

### TownMetadata Interface
```typescript
interface TownMetadata {
  id: string;                    // Unique town identifier
  name: string;                  // Generated town name
  worldCoords: { x: number; y: number }; // World map coordinates
  submapCoords: { x: number; y: number }; // Submap center coordinates
  biomeId: string;              // Biome context
  settlementType: SettlementType; // Settlement template

  // Basic Properties (always generated)
  population: TownPopulation;
  primaryIndustry: TownIndustry;
  governingBody: TownGovernment;
  culturalAlignment: TownCulture;

  // Generation Control
  generationSeed: number;       // Master seed for ALL town generation
  detailLevel: DetailLevel;     // How much detail has been generated

  // Town Generation State (persisted)
  townLayout?: VillageLayout;   // Generated town layout
  townSeed: number;             // Specific seed used for town generation
  lastGenerated: Date;          // When town was last generated

  // Rich Details (lazy-loaded, coordinated with town generation)
  description?: TownDescription;
  history?: TownHistory;
  notableLocations?: NotableLocation[];
  currentEvents?: TownEvent[];
  npcs?: TownNPC[];
}
```

### DetailLevel Enum
```typescript
enum DetailLevel {
  BASIC = 'basic',           // Name and basic properties only
  DESCRIPTIVE = 'descriptive', // Full descriptions generated
  POPULATED = 'populated'    // NPCs and events generated
}
```

### TownDescription Interface
```typescript
interface TownDescription {
  overview: string;          // High-level town description
  visual: string;            // What it looks like
  atmosphere: string;        // Mood and sensory details
  economy: string;           // Economic activity description
  social: string;            // Social structure and culture
}
```

### ProximityTrigger Interface
```typescript
interface ProximityTrigger {
  townId: string;
  triggerType: 'world_tile_entry' | 'submap_proximity';
  range: number;             // Tile distance for proximity triggers
  triggered: boolean;
  lastTriggered?: Date;
}
```

## Generation System

### TownNameGenerator
```typescript
class TownNameGenerator {
  static generate(settlementType: SettlementType, biomeId: string, seed: number): string {
    // Use settlement type templates + biome modifiers + seeded randomization
    // Examples: "Oakwood Hamlet", "Stonebrook Village", "Mistvale"
  }
}
```

### TownDescriptionGenerator
```typescript
class TownDescriptionGenerator {
  static generate(metadata: TownMetadata, playerContext?: PlayerContext): TownDescription {
    // Generate rich descriptions based on:
    // - Settlement type templates
    // - Biome environmental factors
    // - Cultural alignment
    // - Player race/background for flavor
  }
}
```

## World State Persistence Integration

### Save State Architecture
```typescript
interface GameSaveData {
  // Core game state
  gameState: GameState;

  // World generation state
  worldState: WorldState;

  // Generated content cache
  generatedContent: GeneratedContentCache;
}

interface WorldState {
  worldSeed: number;                    // Master world seed
  generatedTiles: Map<string, GeneratedTile>; // Generated submaps
  discoveredLocations: Map<string, DiscoveredLocation>; // Explored areas
  townStates: Map<string, PersistentTownData>; // Generated towns
  npcStates: Map<string, PersistentNPCData>; // Generated NPCs
  eventStates: Map<string, PersistentEventData>; // Active events
}

interface GeneratedTile {
  coords: WorldCoords;
  generatedAt: Date;
  biomeId: string;
  submapData: SubmapData; // The actual generated terrain
  discoveredFeatures: DiscoveredFeature[];
}

interface DiscoveredLocation {
  locationId: string;
  discoveredAt: Date;
  explorationLevel: ExplorationLevel; // How much has been explored
  generatedContent: any; // Location-specific generated content
}
```

### Town Generation with Save State
```typescript
// Town generation respects existing save state
async function generateTownWithPersistence(townId: string): Promise<TownData> {
  // Check if town already exists in save data
  const savedTown = gameSaveData.worldState.townStates.get(townId);

  if (savedTown && isValid(savedTown)) {
    return savedTown; // Return persisted town
  }

  // Generate new town
  const townData = await generateNewTown(townId);

  // Immediately persist to save data
  gameSaveData.worldState.townStates.set(townId, townData);
  markSaveDataDirty(); // Flag for autosave

  return townData;
}

// Prevent regeneration on load
function loadTownFromSave(townId: string): TownData | null {
  const savedTown = gameSaveData.worldState.townStates.get(townId);
  if (savedTown) {
    // Validate town is still consistent with world seed
    if (validateTownIntegrity(savedTown, gameSaveData.worldSeed)) {
      return savedTown;
    } else {
      // Town corrupted or world seed changed - regenerate
      console.warn(`Town ${townId} corrupted, regenerating`);
      gameSaveData.worldState.townStates.delete(townId);
    }
  }
  return null;
}
```

### Coordinated Generation
```typescript
// Town generation and description use coordinated seeds
async function generateTown(townId: string): Promise<TownData> {
  const metadata = getTownMetadata(townId);
  const seeds = generateTownSeeds(metadata.generationSeed, metadata.worldCoords);

  // Generate town layout using layoutSeed
  const layout = await generateVillageLayout({
    worldSeed: seeds.layoutSeed,
    dominantRace: metadata.settlementType.dominantRace,
    biomeId: metadata.biomeId,
    isStartingSettlement: false
  });

  // Generate description using descriptionSeed (but informed by layout)
  const description = await TownDescriptionGenerator.generate(metadata, {
    layoutInfluence: extractLayoutFeatures(layout),
    seed: seeds.descriptionSeed
  });

  return {
    metadata: { ...metadata, townLayout: layout, lastGenerated: new Date() },
    layout,
    description
  };
}
```

### Integrated Save State Persistence
```typescript
// Town state integrated with main game save
interface PersistentTownData {
  metadata: TownMetadata;
  layout: VillageLayout;        // Town structure (required)
  npcs: TownNPC[];             // Generated NPCs
  events: TownEvent[];         // Current events
  playerInteractions: TownInteraction[]; // Player relationship history
  generatedAt: Date;           // When town was first generated
  lastVisited: Date;           // For time-based events
  integrityHash: string;       // Validation hash
}

// Save town state to main game save data
function persistTownToSaveData(townData: TownData): void {
  const persistentData: PersistentTownData = {
    metadata: townData.metadata,
    layout: townData.layout,
    npcs: townData.npcs || [],
    events: townData.events || [],
    playerInteractions: townData.playerInteractions || [],
    generatedAt: new Date(),
    lastVisited: new Date(),
    integrityHash: generateIntegrityHash(townData, gameSaveData.worldSeed)
  };

  gameSaveData.worldState.townStates.set(townData.metadata.id, persistentData);
  gameSaveData.generatedContent.lastModified = new Date();

  // Trigger autosave if configured
  triggerAutosave();
}

// Load town state from main game save
function loadTownFromSaveData(townId: string): TownData | null {
  const savedTown = gameSaveData.worldState.townStates.get(townId);
  if (!savedTown) return null;

  // Validate integrity
  if (!validateTownIntegrity(savedTown)) {
    console.error(`Town ${townId} save data corrupted`);
    return null;
  }

  return {
    metadata: savedTown.metadata,
    layout: savedTown.layout,
    npcs: savedTown.npcs,
    events: savedTown.events,
    playerInteractions: savedTown.playerInteractions
  };
}

// Prevent world changes between saves
function ensureWorldConsistency(): void {
  const currentWorldSeed = gameSaveData.worldState.worldSeed;

  // Validate all generated content matches current world seed
  for (const [townId, townData] of gameSaveData.worldState.townStates) {
    if (!validateTownIntegrity(townData)) {
      console.warn(`Removing corrupted town ${townId}`);
      gameSaveData.worldState.townStates.delete(townId);
    }
  }

  // Similar validation for other generated content
  validateGeneratedTiles();
  validateDiscoveredLocations();
}
```

## Save State Integration Requirements

### Critical: World Consistency Across Saves

**Problem Statement:** Players should never experience world changes between save/load cycles. Once a town is generated, explored, or interacted with, it must remain consistent.

**Solution Requirements:**
- **Immediate Persistence:** Generated content saved to game save data immediately upon generation
- **Load Validation:** World consistency validated on game load
- **Seed Integrity:** All generation tied to master world seed with validation
- **Corruption Recovery:** Graceful handling of corrupted save data

### Save State Architecture
```typescript
interface GameSaveData {
  metadata: SaveMetadata;
  gameState: GameState;           // Core game mechanics
  worldState: WorldState;         // Generated world content
  generatedContent: GeneratedContentCache; // Cached generated items
}

interface WorldState {
  worldSeed: number;              // Master seed - NEVER changes
  generatedAt: Date;              // When world was first generated
  townStates: Map<string, PersistentTownData>;
  tileStates: Map<string, PersistentTileData>;
  locationStates: Map<string, PersistentLocationData>;
  integrityHash: string;          // Validation hash for entire world state
}
```

### Generation with Save State Awareness
```typescript
async function generateTownWithSaveState(townId: string): Promise<TownData> {
  // 1. Check existing save data FIRST
  const existingTown = loadTownFromSaveData(townId);
  if (existingTown) {
    console.log(`Loading existing town ${townId} from save data`);
    return existingTown;
  }

  // 2. Generate new town
  console.log(`Generating new town ${townId}`);
  const townData = await generateNewTown(townId);

  // 3. IMMEDIATELY persist to save data
  persistTownToSaveData(townData);

  // 4. Mark save data as modified
  gameSaveData.metadata.needsSave = true;

  return townData;
}

// Called on game load to ensure world consistency
function validateWorldStateOnLoad(): void {
  const worldSeed = gameSaveData.worldState.worldSeed;

  // Validate all generated content
  validateTownStates(worldSeed);
  validateTileStates(worldSeed);
  validateLocationStates(worldSeed);

  // Remove any corrupted entries
  cleanupCorruptedData();

  console.log('World state validation complete');
}
```

### Autosave Integration
```typescript
// Automatic saving when content is generated
function triggerAutosave(): void {
  if (gameSettings.autosaveEnabled) {
    const saveData = serializeGameSaveData();
    localStorage.setItem('aralia_autosave', JSON.stringify(saveData));
    console.log('Autosave triggered after content generation');
  }
}

// Manual save includes all generated content
function manualSave(slotName: string): void {
  const saveData = serializeGameSaveData();
  localStorage.setItem(`aralia_save_${slotName}`, JSON.stringify(saveData));

  // Clear autosave after successful manual save
  localStorage.removeItem('aralia_autosave');

  console.log(`Game saved to slot: ${slotName}`);
}
```

## Integration Points

### World Generation
```typescript
// In map generation - generate metadata only
function generateTownMetadata(worldSeed: number, coords: WorldCoords, biomeId: string): TownMetadata {
  const settlementType = determineSettlementType(biomeId, worldSeed, coords);
  const townSeeds = generateTownSeeds(worldSeed, coords);

  const metadata: TownMetadata = {
    id: `town_${coords.x}_${coords.y}_${worldSeed}`,
    name: TownNameGenerator.generate(settlementType, biomeId, townSeeds.nameSeed),
    worldCoords: coords,
    biomeId,
    settlementType,
    generationSeed: worldSeed,  // Master seed
    townSeed: townSeeds.layoutSeed, // Specific town generation seed
    detailLevel: DetailLevel.BASIC
  };
  return metadata;
}
```

### Proximity Detection
```typescript
// In game state management
function checkTownProximity(playerCoords: WorldCoords, submapCoords: SubmapCoords): ProximityTrigger[] {
  const nearbyTowns = findTownsWithinRange(playerCoords, PROXIMITY_RANGE);

  return nearbyTowns
    .filter(town => !town.detailLevel || town.detailLevel === DetailLevel.BASIC)
    .map(town => ({
      townId: town.id,
      triggerType: 'submap_proximity',
      range: PROXIMITY_RANGE,
      triggered: true
    }));
}
```

### Coordinated Town Loading
```typescript
// Integrated town generation and description loading
async function loadTown(townId: string): Promise<TownData> {
  // Check if town is already generated and cached
  const cached = loadTownState(townId);
  if (cached && isRecent(cached.metadata.lastGenerated)) {
    return cached;
  }

  const metadata = getTownMetadata(townId);
  const seeds = generateTownSeeds(metadata.generationSeed, metadata.worldCoords);

  // Step 1: Generate town layout (if not cached)
  let layout = cached?.layout;
  if (!layout) {
    layout = await generateVillageLayout({
      worldSeed: seeds.layoutSeed,
      dominantRace: metadata.settlementType.dominantRace,
      biomeId: metadata.biomeId,
      isStartingSettlement: false
    });
  }

  // Step 2: Generate description (informed by layout)
  const layoutFeatures = extractLayoutFeatures(layout);
  const description = await TownDescriptionGenerator.generate(metadata, {
    layoutInfluence: layoutFeatures,
    seed: seeds.descriptionSeed
  });

  // Step 3: Generate NPCs and events
  const npcs = await generateTownNPCs(metadata, seeds.npcSeed, layout);
  const events = await generateTownEvents(metadata, seeds.eventSeed);

  const townData: TownData = {
    metadata: {
      ...metadata,
      townLayout: layout,
      description,
      npcs,
      currentEvents: events,
      detailLevel: DetailLevel.POPULATED,
      lastGenerated: new Date()
    },
    layout,
    description,
    npcs,
    events
  };

  // Persist for future visits
  saveTownState(townData);

  return townData;
}

// Extract features from generated layout for description generation
function extractLayoutFeatures(layout: VillageLayout): LayoutFeatures {
  return {
    buildingCount: layout.tiles.flat().filter(tile => tile.type.startsWith('house_')).length,
    shopTypes: [...new Set(layout.tiles.flat()
      .filter(tile => tile.type.startsWith('shop_'))
      .map(tile => tile.type))],
    hasTemple: layout.tiles.flat().some(tile => tile.type.includes('temple')),
    hasTavern: layout.tiles.flat().some(tile => tile.type.includes('tavern')),
    architecturalStyle: layout.personality?.architecturalStyle,
    // ... more layout-derived features
  };
}
```

## Configuration

### Constants
```typescript
const PROXIMITY_RANGE = 3;          // Tiles
const MAX_LOADED_TOWNS = 10;        // Memory limit
const DESCRIPTION_CACHE_TTL = 300000; // 5 minutes
```

### Settlement Templates
```typescript
const SETTLEMENT_TEMPLATES: Record<string, SettlementTemplate> = {
  human_town: {
    namePatterns: ['{prefix}{suffix}', '{adjective} {noun}'],
    prefixes: ['Oak', 'Stone', 'River', 'Hill', 'Green'],
    suffixes: ['ford', 'brook', 'vale', 'wood', 'field'],
    industries: ['agriculture', 'trade', 'crafting'],
    // ... more template data
  }
};
```

## Performance Considerations

### Memory Management
- LRU cache for town descriptions
- Unload distant town details
- Progressive loading (descriptions before NPCs)

### Generation Optimization
- Pre-compute name components
- Template-based generation for speed
- Async generation for large towns

### Caching Strategy
- Cache generated descriptions by seed
- Invalidate on world regeneration
- Share templates across similar towns

## Testing Strategy

### Unit Tests
- Name generation determinism
- Description template rendering
- Proximity detection accuracy

### Integration Tests
- End-to-end town loading flow
- Memory usage under load
- Cache invalidation scenarios

### Performance Tests
- Town generation speed
- Memory usage scaling
- Loading time benchmarks
