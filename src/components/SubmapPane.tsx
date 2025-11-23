/**
 * @file SubmapPane.tsx
 * This component displays the visual submap for the player's current
 * world map tile location, showing their precise position within a 25x25 grid.
 * It now features more varied tile visuals, including feature clumping and paths,
 * an icon glossary accessible via a modal, and tooltips with contextual hints.
 * It uses the useSubmapProceduralData hook for data generation and has a decomposed getTileVisuals function.
 * CompassPane is now integrated into this modal.
 */
import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { BIOMES } from '../constants'; 
import { SUBMAP_DIMENSIONS } from '../config/mapConfig'; 
import { Action, InspectSubmapTilePayload, Location, MapData, BiomeVisuals, PlayerCharacter, NPC, Item, SeededFeatureConfig, GlossaryDisplayItem } from '../types'; 
import { BattleMapData, BattleMapTile } from '../types/combat';
import GlossaryDisplay from './GlossaryDisplay'; 
import { SUBMAP_ICON_MEANINGS } from '../data/glossaryData'; 
import { useSubmapProceduralData, PathDetails } from '../hooks/useSubmapProceduralData';
import CompassPane from './CompassPane'; 
import { biomeVisualsConfig, defaultBiomeVisuals } from '../config/submapVisualsConfig';
import { findPath } from '../utils/pathfinding'; 
import ActionPane from './ActionPane';
import SubmapTile from './SubmapTile';
import { CaTileType } from '../services/cellularAutomataService';

interface SubmapPathNode {
  id: string;
  coordinates: { x: number; y: number };
  movementCost: number;
  blocksMovement: boolean;
  terrain?: any; 
  elevation?: any;
  blocksLoS?: any;
  decoration?: any;
  effects?: any;
}

interface SubmapPaneProps {
  currentLocation: Location; 
  currentWorldBiomeId: string; 
  playerSubmapCoords: { x: number; y: number };
  onClose: () => void;
  submapDimensions: { rows: number; cols: number };
  parentWorldMapCoords: { x: number; y: number }; 
  onAction: (action: Action) => void; 
  disabled: boolean; 
  inspectedTileDescriptions: Record<string, string>;
  mapData: MapData | null; 
  gameTime: Date;
  playerCharacter: PlayerCharacter;
  worldSeed: number;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
  geminiGeneratedActions: Action[] | null;
  isDevDummyActive: boolean;
  unreadDiscoveryCount: number;
  hasNewRateLimitError: boolean;
}

// --- Submap Tile Hint Data ---
const submapTileHints: Record<string, string[]> = {
  'default': [ 
    "The air is still here.", 
    "You survey your surroundings.", 
    "A sense of anticipation hangs in the air.", 
    "An unremarkable patch of terrain, yet potential lurks everywhere.",
    "The ground here seems ordinary.",
    "A quiet moment of observation."
  ],
  'forest_default': [
    "Sunlight filters weakly through the dense canopy above this spot.",
    "The air is cool and smells of damp earth and pine needles.",
    "A gnarled root, thick as your arm, breaks the surface of the forest floor.",
    "You hear the rustling of small creatures in the underbrush nearby.",
    "A patch of unusually vibrant green moss clings to an old log.",
    "The ground here is soft with fallen leaves, muffling your steps.",
    "A whisper of wind rustles the highest leaves.",
    "The scent of decaying wood is faint but present."
  ],
  'forest_path': ["The path seems clear ahead.", "Tracks of small animals mark the soft earth.", "An ancient, moss-covered tree looms beside the path.", "Sunlight struggles to reach the forest floor here, keeping it cool."],
  'forest_water': ["The water of the pond looks surprisingly clear.", "Something ripples the surface for a moment, then vanishes.", "Dragonflies with iridescent wings flit over the pond.", "Mossy rocks line the water's edge, slick and damp."],
  'forest_dense_forest': ["The trees grow very close together, their branches intertwined.", "It's noticeably darker and quieter within this thicket.", "You feel a primal sense of being watched from the shadows.", "The undergrowth is thick and tangled, promising difficult passage."],
  'forest_stone_area': ["These weathered stones feel ancient to the touch.", "Faint, almost eroded carvings might be hidden on these stones.", "A subtle vibration or hum seems to emanate from the ground here.", "Moss grows in deep green patches on these weathered stones."],
  'forest_glowing_mushroom_grove': [
    "An eerie, soft luminescence emanates from a patch of exotic mushrooms.",
    "The air here smells unusually sweet and earthy.",
    "These glowing fungi pulse with a faint, rhythmic light.",
    "The ground around the mushrooms is damp and spongy."
  ],
  'plains_default': [
    "Tall, golden grasses sway gently in the warm breeze here.",
    "The vast sky stretches overhead, a canvas of blue and white.",
    "You spot a distant hawk circling lazily, high above this open stretch.",
    "The ground is firm and well-suited for swift travel.",
    "A cluster of vibrant wildflowers adds a splash of unexpected color to the landscape.",
    "You notice a faint game trail, almost invisible, winding through the grass.",
    "The sun feels warm on your skin.",
    "A lone, windswept tree stands defiantly in the distance."
  ],
  'plains_path': ["This path is well-worn, clearly a common route.", "You see signs of recent travelers - perhaps a discarded trinket or fresh tracks.", "The way ahead seems open and straightforward.", "A few hardy wildflowers grow stubbornly by the wayside."],
  'plains_village_area': ["You can hear the distant, muffled sounds of a settlement - a dog barking, perhaps voices.", "The faint, comforting smell of woodsmoke and cooking fires drifts on the wind.", "A well-trodden path, wider than most, leads towards signs of civilization.", "Small, neatly tilled fields might be just beyond your sight, hinting at farming."],
  'plains_sparse_forest': ["A small, welcoming cluster of trees offers a brief respite from the open sun.", "Birdsong, louder and more varied here, echoes from the branches.", "The ground beneath the trees is cool and littered with fallen leaves.", "This copse seems like an ideal spot for a short rest or a hidden meeting."],
  'plains_campsite': ["The charred remains of an old campfire are clearly visible.", "Someone has camped here recently; the ground is flattened and some supplies might be overlooked.", "Discarded scraps or a forgotten tool hint at previous occupants and their haste or carelessness.", "The area feels temporarily tamed, a brief pause in the wilderness."],
  'plains_lone_monolith': ["The monolith stands silent and imposing, a finger of stone pointing to the sky.", "Strange, weathered symbols might be etched into its ancient surface, telling a forgotten story.", "The stone feels unnaturally cold to the touch, even under the sun.", "The wind whistles around its sharp edges, creating an eerie tune."],
  'plains_boulder_field': ["Large, smooth boulders are scattered haphazardly across the landscape, like forgotten marbles of giants.", "This area could provide excellent cover or an ambush spot.", "The ground is uneven and rocky, requiring careful footing.", "Small, hardy plants grow in the crevices between the stones."],
  'mountain_default': [
    "The mountain air is thin, cold, and crisp in your lungs.",
    "Loose scree and sharp stones make footing treacherous in this spot.",
    "A sheer, unscalable cliff face looms nearby, its stone ancient and weathered.",
    "The wind howls with a lonely, mournful sound through a narrow pass just ahead.",
    "You spot a hardy, brightly colored mountain flower clinging tenaciously to life in a rock crevice.",
    "A massive boulder, streaked with unusual mineral deposits, rests precariously here.",
    "The silence is profound, broken only by the wind.",
    "Far below, the world unfurls like a map."
  ],
  'mountain_path': ["This narrow path is steep and winds precariously along the mountainside.", "Only the most sure-footed creatures—or determined climbers—would dare to travel here.", "Loose rocks and gravel skitter underfoot, threatening a dangerous slide.", "The view from this exposed path, though perilous, might be breathtakingly vast."],
  'mountain_rocky_terrain': ["Jagged, sharp rocks jut out from the ground like broken teeth.", "Dark cave entrances or hidden crevices might be concealed among the crags and shadows.", "This terrain is exceptionally difficult to navigate; progress is slow and requires concentration.", "You hear the distant, sharp crack of falling rocks echoing from higher up."],
  'mountain_snowy_patch': ["A patch of old, compacted snow clings stubbornly to the mountainside, defying the sun.", "The air is noticeably colder here, a pocket of lingering winter.", "The glistening surface of the snow might hide treacherous ice beneath.", "Faint tracks in the snow could reveal the recent passage of mountain creatures... or something else."],
  'hills_default': [
    "From this gentle rise, you can see the undulating green and gold landscape for miles around.",
    "A smooth, grassy slope leads downwards from your current position.",
    "Patches of colorful wildflowers dot the hillside, alive with the buzzing of bees and flitting butterflies.",
    "A few scattered, wind-sculpted trees offer sparse shade on the open hills.",
    "The ground here is covered in short, springy turf, pleasant to walk upon.",
    "You hear the distant, melodic bleating of sheep carried on the breeze.",
    "A weathered outcrop of rock provides a natural landmark.",
    "The air is fresh and carries the scent of wild herbs."
  ],
  'desert_default': [
    "The relentless sun beats down, and heat shimmers above the endless expanse of sand.",
    "A dry, hot wind whispers across the dunes, carrying fine grains that sting your eyes.",
    "You spot a surprisingly resilient desert plant, its waxy leaves a dull green against the ochre sand.",
    "The sand is incredibly fine and deep, shifting and sighing under your every step.",
    "A bleached animal skull, picked clean by scavengers, lies half-buried nearby – a stark reminder of the desert's harshness.",
    "The distant horizon is a mirage, a wavering line of heat and light.",
    "A large, flat rock offers a brief respite from the scorching sand.",
    "The silence of the desert is vast and almost deafening."
  ],
  'swamp_default': [
    "The air is thick and heavy with humidity, carrying the cloying smell of decay and stagnant water.",
    "Murky, dark water pools around your feet, disturbed by unseen movement from below.",
    "Gnarled, ancient trees with trailing Spanish moss create a gloomy, oppressive atmosphere.",
    "The incessant, high-pitched buzzing of mosquitoes and other unseen insects is a constant drone here.",
    "A patch of unnaturally bright green algae covers a stagnant pool, its surface unmoving.",
    "The ground is soft and treacherous; you feel it trying to suck your boots down with every step.",
    "A chorus of frogs erupts from a nearby patch of reeds.",
    "The remains of a rotted log bridge suggest a path once existed here."
  ],
  'ocean_default': [
    "The vast, endless ocean stretches to the horizon in all directions.",
    "Waves crash rhythmically against unseen shores or rise and fall in deep swells.",
    "The salty spray of the sea mists your face.",
    "A lone seabird cries overhead, circling before disappearing into the distance.",
    "The water here is a deep, mysterious blue.",
    "A piece of driftwood bobs on the surface nearby."
  ],
  'cave_default': [
      "The air is cool, damp, and still.",
      "Water drips rhythmically from a stalactite somewhere in the dark.",
      "The rocky floor is uneven and slick with moisture.",
      "Shadows dance on the walls, cast by unseen light sources.",
      "A faint draft suggests a larger chamber nearby.",
      "The silence is heavy, broken only by your own breathing."
  ],
  'dungeon_default': [
      "The air is stale and carries the scent of old stone and dust.",
      "Cobwebs hang in thick curtains from the ceiling.",
      "The floor is made of worn flagstones, cracked with age.",
      "Rusting iron fixtures line the walls.",
      "You hear the faint scuttling of vermin in the shadows.",
      "A sense of dread permeates these ancient halls."
  ],
  'wall': ["Solid rock blocks your path.", "A rough-hewn stone wall stands before you.", "The cave wall is damp and covered in lichen.", "An ancient masonry wall, built by forgotten hands."],
  'floor': ["The ground is level enough for easy travel.", "Rough stone floor, worn smooth by time.", "A patch of dirt floor, packed hard."],
  'pond': ["Ripples disturb the pond's surface; something is moving within.", "The water of the pond looks murky and deep, its bottom hidden.", "A chorus of frogs suddenly erupts from the reeds at the pond's edge.", "A faint glint from the pond's bottom catches your eye. Treasure, or just a reflection?"],
  'dense_thicket': ["It's almost impossible to see more than a few feet into the dense thicket.", "You hear a distinct rustling from deep within the bushes. Animal or something else?", "This looks like an excellent place to lay an ambush... or be ambushed.", "Only the smallest creatures could easily pass through this dense growth."],
  'ancient_stone_circle': ["The air around these ancient stones hums with a forgotten power.", "Are these massive stones arranged naturally, or by some long-lost design?", "A palpable sense of ancient ritual and unknown purpose hangs heavy in the air here.", "The ground within the circle feels strangely different, perhaps cooler or more barren."],
  'glowing_mushroom_grove': ["An eerie, pulsating luminescence emanates from this patch of exotic mushrooms.", "The air here smells unusually sweet and damp, a cloying, fungal aroma.", "These glowing fungi might be a source of magical power... or a deadly poison.", "The soft glow from the mushrooms casts strange, dancing shadows."],
  'oasis': ["The sight of fresh water and lush greenery is a stark, welcome relief in this arid land.", "Numerous animal tracks lead to the water's edge, indicating this is a vital resource.", "The shade of swaying palm trees offers a cool respite from the oppressive heat.", "The water looks clear, but is it safe to drink without purification?"],
  'rocky_mesa': ["The flat top of the distant mesa offers a commanding view of the surroundings.", "Climbing this sheer rock formation would be a significant challenge, even for the skilled.", "Wind has carved strange, hoodoo-like shapes into the weathered rock face.", "Perhaps a territorial creature lairs atop the mesa, guarding its domain."],
  'sand_dunes': ["The ever-shifting sands of these dunes make travel slow and arduous.", "Legends say ancient ruins or lost treasures can sometimes be found buried beneath these dunes.", "The wind whispers across the crests of the dunes, constantly reshaping the landscape.", "The intense heat shimmering above the dunes creates disorienting mirages."],
  'murky_pool': ["The water in this pool is dark, still, and utterly opaque.", "Large, slow bubbles occasionally rise to the surface, releasing a foul-smelling gas.", "The cloying smell of decay and stagnant water hangs heavy in the humid air.", "What unseen creatures might lurk in the muddy depths of this pool?"],
  'dense_reeds': ["The reeds grow incredibly tall and dense here, effectively blocking your view.", "You hear a distinct slithering or splashing sound from within the reeds, just out of sight.", "The ground beneath the reeds is soft, wet, and likely treacherous.", "A narrow, hidden path might wind its way through this dense patch of reeds."],
  'sunken_ruin_fragment': ["A fragment of an ancient, moss-covered stone structure juts defiantly from the muck.", "What forgotten building or monument was this part of, now lost to the swamp?", "Treasure, ancient knowledge, or lurking danger might be hidden within these sunken remains.", "The stone is cold, slimy, and surprisingly well-preserved despite its immersion."],
  'small_island': ["This small, sandy island offers a patch of solid ground amidst the water.", "Coconuts, driftwood, or perhaps even a washed-up chest might be found here.", "Nesting seabirds cry out defensively as you approach their isolated sanctuary.", "Is this island truly deserted, or does someone or something else call it home?"],
  'kelp_forest': ["Towering stalks of kelp sway rhythmically in the underwater currents, creating a dense, shifting forest.", "Schools of small, brightly colored fish dart amongst the protective fronds of kelp.", "The water is noticeably darker and more obscured within the kelp forest.", "Larger, predatory creatures might use the dense kelp as cover for ambushes."],
  'coral_reef': ["Vibrant, multi-colored corals create a stunning and complex underwater landscape.", "Countless schools of exotic fish swim gracefully among the reef's intricate structures.", "The sharp edges of the coral could be dangerous to the unwary swimmer.", "The reef might hide secret caves, valuable pearls, or the lairs of territorial marine creatures."]
};


// --- Visual Layer Functions ---
interface VisualLayerOutput {
  style: React.CSSProperties;
  content: React.ReactNode;
  animationClass: string;
  isResource: boolean;
  effectiveTerrainType: string;
  zIndex: number;
  activeSeededFeatureConfigForTile: SeededFeatureConfig | null;
}

const getAnimationClass = (icon: string | null | undefined): string => {
  if (!icon) return '';
  if (['💧', '🌊', '🐟', '🐙', '🐡', '🐬'].includes(icon)) return 'animate-shimmer';
  if (['🌲', '🌳', '🌿', '🌴'].includes(icon)) return 'animate-sway';
  if (['✨', '🍄', '💎', '♨️', '⭐', '🕯️'].includes(icon)) return 'animate-subtle-pulse';
  return '';
};

const getIsResource = (icon: string | null | undefined): boolean => {
    if(!icon) return false;
    return ['🌲', '🌳', '🪨', '💎', '🍄', '🌿'].includes(icon);
};

function getBaseVisuals(
  rowIndex: number,
  colIndex: number,
  tileHash: number,
  visualsConfig: BiomeVisuals
): VisualLayerOutput {
  return {
    style: {
      backgroundColor: visualsConfig.baseColors[tileHash % visualsConfig.baseColors.length],
    },
    content: null,
    animationClass: '',
    isResource: false,
    effectiveTerrainType: 'default',
    zIndex: 0,
    activeSeededFeatureConfigForTile: null,
  };
}

function applyPathVisuals(
  currentVisuals: VisualLayerOutput,
  rowIndex: number,
  colIndex: number,
  pathDetails: PathDetails,
  visualsConfig: BiomeVisuals,
  tileHash: number
): VisualLayerOutput {
  const newVisuals = { ...currentVisuals };
  const currentTileCoordString = `${colIndex},${rowIndex}`;

  if (pathDetails.mainPathCoords.has(currentTileCoordString)) {
    const pathZ = 1;
    if (newVisuals.zIndex < pathZ) {
      newVisuals.style.backgroundColor = visualsConfig.pathColor;
      newVisuals.content = visualsConfig.pathIcon && tileHash % 3 === 0 
        ? <span role="img" aria-label="path detail">{visualsConfig.pathIcon}</span> 
        : null;
      newVisuals.zIndex = pathZ;
      newVisuals.effectiveTerrainType = 'path';
    }
  } else if (pathDetails.pathAdjacencyCoords.has(currentTileCoordString)) {
    const pathAdjZ = 0.5;
    if (newVisuals.zIndex < pathAdjZ) {
      if (visualsConfig.pathAdjacency?.color) {
        const currentBgMatch = newVisuals.style.backgroundColor?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        const adjBgMatch = visualsConfig.pathAdjacency.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (currentBgMatch && adjBgMatch) {
            const r = Math.floor((parseInt(currentBgMatch[1]) * 0.7 + parseInt(adjBgMatch[1]) * 0.3)); 
            const g = Math.floor((parseInt(currentBgMatch[2]) * 0.7 + parseInt(adjBgMatch[2]) * 0.3));
            const b = Math.floor((parseInt(currentBgMatch[3]) * 0.7 + parseInt(adjBgMatch[3]) * 0.3));
            const aC = parseFloat(currentBgMatch[4] || '1');
            const aA = parseFloat(adjBgMatch[4] || '1');
            const a = Math.max(aC, aA); 
            newVisuals.style.backgroundColor = `rgba(${r},${g},${b},${a.toFixed(2)})`;
        } else {
            newVisuals.style.backgroundColor = visualsConfig.pathAdjacency.color;
        }
      }
      if (visualsConfig.pathAdjacency?.scatter && !newVisuals.content) {
        const scatterRollAdj = (tileHash % 100) / 100;
        let cumulativeDensityAdj = 0;
        for (const scatter of visualsConfig.pathAdjacency.scatter) {
          cumulativeDensityAdj += scatter.density;
          if (scatterRollAdj < cumulativeDensityAdj) {
            const iconOpacity = 0.7 + (tileHash % 31) / 100;
            newVisuals.content = <span style={{ opacity: iconOpacity }} role="img" aria-label="pathside detail">{scatter.icon}</span>;
            if (scatter.color) newVisuals.style.backgroundColor = scatter.color;
            break;
          }
        }
      }
      newVisuals.zIndex = Math.max(newVisuals.zIndex, pathAdjZ);
      newVisuals.effectiveTerrainType = 'path_adj';
    }
  }
  return newVisuals;
}

function applySeededFeatureVisuals(
  currentVisuals: VisualLayerOutput,
  rowIndex: number,
  colIndex: number,
  activeSeededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>
): VisualLayerOutput {
  const newVisuals = { ...currentVisuals };
  let dominantFeatureForTile: SeededFeatureConfig | null = null;

  for (const seeded of activeSeededFeatures) {
    let isWithinFeature = false;
    const dx = Math.abs(colIndex - seeded.x);
    const dy = Math.abs(rowIndex - seeded.y);

    if (seeded.config.shapeType === 'rectangular') {
      isWithinFeature = dx <= seeded.actualSize && dy <= seeded.actualSize;
    } else { // Default to circular
      const distance = Math.sqrt(Math.pow(colIndex - seeded.x, 2) + Math.pow(rowIndex - seeded.y, 2));
      isWithinFeature = distance <= seeded.actualSize;
    }

    if (isWithinFeature) {
      const featureZ = seeded.config.zOffset || 0.1;
      if (featureZ > newVisuals.zIndex) {
        newVisuals.zIndex = featureZ;
        newVisuals.style.backgroundColor = seeded.config.color;
        newVisuals.content = <span role="img" aria-label={seeded.config.name || seeded.config.id}>{seeded.config.icon}</span>;
        newVisuals.effectiveTerrainType = seeded.config.generatesEffectiveTerrainType || seeded.config.id;
        dominantFeatureForTile = seeded.config; 
      }
    } else if (seeded.config.adjacency) {
      let isAdjacent = false;
      if (seeded.config.shapeType === 'rectangular') {
        isAdjacent = (dx <= seeded.actualSize + 1 && dy <= seeded.actualSize + 1) && !(dx <= seeded.actualSize && dy <= seeded.actualSize);
      } else {
        const distance = Math.sqrt(Math.pow(colIndex - seeded.x, 2) + Math.pow(rowIndex - seeded.y, 2));
        isAdjacent = distance <= seeded.actualSize + 1 && distance > seeded.actualSize;
      }

      if (isAdjacent) {
        const adjZ = (seeded.config.zOffset || 0.1) - 0.05; 
        if (adjZ > newVisuals.zIndex) {
          newVisuals.zIndex = adjZ;
          if (seeded.config.adjacency.color) newVisuals.style.backgroundColor = seeded.config.adjacency.color;
          if (seeded.config.adjacency.icon) newVisuals.content = <span role="img" aria-label={`${seeded.config.name || seeded.config.id} adjacency`}>{seeded.config.adjacency.icon}</span>;
          
          if (!dominantFeatureForTile) { 
             newVisuals.effectiveTerrainType = `${seeded.config.generatesEffectiveTerrainType || seeded.config.id}_adj`;
          }
        }
      }
    }
  }
  newVisuals.activeSeededFeatureConfigForTile = dominantFeatureForTile;
  return newVisuals;
}


function applyScatterVisuals(
  currentVisuals: VisualLayerOutput,
  tileHash: number,
  visualsConfig: BiomeVisuals
): VisualLayerOutput {
  const newVisuals = { ...currentVisuals };
  const scatterFeaturesToUse = newVisuals.activeSeededFeatureConfigForTile?.scatterOverride || visualsConfig.scatterFeatures;
  const allowedTerrain = newVisuals.activeSeededFeatureConfigForTile?.scatterOverride 
    ? newVisuals.effectiveTerrainType // If override exists, scatter is specific to the feature's terrain type
    : currentVisuals.effectiveTerrainType; // Use the current effective terrain type (could be 'floor' or 'default')

  if (newVisuals.content === null || newVisuals.zIndex < 0.1) {
    const scatterRoll = (tileHash % 1000) / 1000;
    let cumulativeDensity = 0;
    for (const scatter of scatterFeaturesToUse) {
      cumulativeDensity += scatter.density;
      if (scatterRoll < cumulativeDensity) {
        // Logic to check 'allowedOn'. If allowedOn is present, the current terrain MUST match.
        if (scatter.allowedOn && allowedTerrain) {
             if (!scatter.allowedOn.includes(allowedTerrain) && !scatter.allowedOn.includes('default')) {
                 continue; // Skip if not allowed
             }
        }

        const scatterZ = 0.01; 
        if (scatterZ > newVisuals.zIndex) { 
             newVisuals.zIndex = scatterZ; // Keep zIndex low for scatter unless it's meant to be prominent
        }
        const iconOpacity = 0.5 + (tileHash % 51) / 100; 
        const iconNode = scatter.icon ? <span style={{ opacity: iconOpacity }} role="img" aria-label="scatter detail">{scatter.icon}</span> : null;
        if(iconNode) {
          newVisuals.content = iconNode;
          newVisuals.animationClass = getAnimationClass(scatter.icon);
          newVisuals.isResource = getIsResource(scatter.icon);
        }
        if (scatter.color) newVisuals.style.backgroundColor = scatter.color; 
        break;
      }
    }
  }
  return newVisuals;
}

const getDayNightOverlayClass = (gameTime: Date): string => {
    const hour = gameTime.getHours();
    if (hour >= 18 && hour < 21) { // Evening: 6 PM to 9 PM
        return 'bg-amber-700/20 mix-blend-overlay';
    }
    if (hour >= 21 || hour < 5) { // Night: 9 PM to 5 AM
        return 'bg-indigo-900/40 mix-blend-multiply';
    }
    return ''; // Day
};


const SubmapPane: React.FC<SubmapPaneProps> = ({
  currentLocation,
  currentWorldBiomeId,
  playerSubmapCoords,
  onClose,
  submapDimensions,
  parentWorldMapCoords,
  onAction,
  disabled,
  inspectedTileDescriptions,
  mapData,
  gameTime,
  playerCharacter,
  worldSeed,
  npcsInLocation,
  itemsInLocation,
  geminiGeneratedActions,
  isDevDummyActive,
  unreadDiscoveryCount,
  hasNewRateLimitError,
}) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionMessage, setInspectionMessage] = useState<string | null>(null);
  
  // --- NEW STATE FOR QUICK TRAVEL ---
  const [isQuickTravelMode, setIsQuickTravelMode] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const currentBiome = BIOMES[currentWorldBiomeId] || null;
  const visualsConfig = (currentBiome && biomeVisualsConfig[currentBiome.id]) || defaultBiomeVisuals;

  const isOpen = true; 

  const { simpleHash, activeSeededFeatures, pathDetails, caGrid } = useSubmapProceduralData({
    submapDimensions,
    currentWorldBiomeId,
    parentWorldMapCoords,
    seededFeaturesConfig: visualsConfig.seededFeatures,
    worldSeed,
  });

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isQuickTravelMode) setIsQuickTravelMode(false);
        else if (isGlossaryOpen) setIsGlossaryOpen(false);
        else if (isInspecting) {
          setIsInspecting(false);
          setInspectionMessage(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) { 
      window.addEventListener('keydown', handleEsc);
      if (!isInspecting && !isGlossaryOpen && !isQuickTravelMode) {
         firstFocusableElementRef.current?.focus();
      }
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, isGlossaryOpen, isInspecting, isQuickTravelMode]);

  const getTileVisuals = useCallback((rowIndex: number, colIndex: number): VisualLayerOutput => {
    const tileHash = simpleHash(colIndex, rowIndex, 'tile_visual_seed_v4');
    
    // --- NEW LOGIC: Check for CA Grid first ---
    if (caGrid && visualsConfig.caTileVisuals) {
        const tileType: CaTileType = caGrid[rowIndex]?.[colIndex] || 'wall';
        const tileVisual = visualsConfig.caTileVisuals[tileType];
        
        let visuals: VisualLayerOutput = {
            style: { backgroundColor: tileVisual.color },
            content: tileVisual.icon ? <span role="img" aria-label={tileType}>{tileVisual.icon}</span> : null,
            animationClass: '',
            isResource: false,
            effectiveTerrainType: tileType,
            zIndex: 0,
            activeSeededFeatureConfigForTile: null,
        };
        
        // Apply scatter features on top of 'floor' tiles
        if (tileType === 'floor') {
            visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);
        }
        
        return visuals;
    }

    // --- Standard Logic ---
    let visuals = getBaseVisuals(rowIndex, colIndex, tileHash, visualsConfig);
    visuals = applyPathVisuals(visuals, rowIndex, colIndex, pathDetails, visualsConfig, tileHash);
    visuals = applySeededFeatureVisuals(visuals, rowIndex, colIndex, activeSeededFeatures);
    visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);
    
    const iconContent = React.isValidElement(visuals.content) ? (visuals.content.props as { children?: React.ReactNode }).children : null;
    const icon = typeof iconContent === 'string' ? iconContent : null;

    visuals.animationClass = getAnimationClass(icon);
    visuals.isResource = getIsResource(icon);

    return visuals;
  }, [simpleHash, visualsConfig, pathDetails, activeSeededFeatures, caGrid]);

  const pathfindingGrid = useMemo(() => {
    const grid = new Map<string, SubmapPathNode>();
    for (let r = 0; r < submapDimensions.rows; r++) {
      for (let c = 0; c < submapDimensions.cols; c++) {
        const visuals = getTileVisuals(r, c);
        const { effectiveTerrainType } = visuals;
        let movementCost = 30; // Default: 30 minutes for regular ground
        let blocksMovement = false;

        if (playerCharacter.transportMode === 'foot') {
            if (effectiveTerrainType === 'path') {
                movementCost = 15;
            } else if (effectiveTerrainType === 'wall') {
                movementCost = Infinity;
                blocksMovement = true;
            } else {
                movementCost = 30;
            }
        }
        // Future: Add 'mounted' mode logic here

        if (effectiveTerrainType === 'water') {
          blocksMovement = true;
          movementCost = Infinity;
        }

        grid.set(`${c}-${r}`, {
          id: `${c}-${r}`,
          coordinates: { x: c, y: r },
          movementCost,
          blocksMovement
        });
      }
    }
    return grid;
  }, [submapDimensions, getTileVisuals, playerCharacter]);

  const quickTravelData = useMemo(() => {
    if (!isQuickTravelMode || !hoveredTile || !playerSubmapCoords) {
      return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: false };
    }
    const startNode = pathfindingGrid.get(`${playerSubmapCoords.x}-${playerSubmapCoords.y}`);
    const endNode = pathfindingGrid.get(`${hoveredTile.x}-${hoveredTile.y}`);

    if (!startNode || !endNode || endNode.blocksMovement) {
      return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: !!endNode?.blocksMovement };
    }
    
    const themeForPathfinder = ((): BattleMapData['theme'] => {
        const validThemes: BattleMapData['theme'][] = ['forest', 'cave', 'dungeon', 'desert', 'swamp'];
        if ((validThemes as string[]).includes(currentWorldBiomeId)) {
            return currentWorldBiomeId as BattleMapData['theme'];
        }
        if (currentWorldBiomeId === 'plains' || currentWorldBiomeId === 'hills') return 'forest';
        if (currentWorldBiomeId === 'mountain') return 'cave';
        return 'forest';
    })();

    const mapForPathfinder: BattleMapData = {
        dimensions: { width: submapDimensions.cols, height: submapDimensions.rows },
        tiles: pathfindingGrid as unknown as Map<string, BattleMapTile>,
        theme: themeForPathfinder,
        seed: simpleHash(0, 0, 'pathfinder_seed'),
    };

    const pathNodes = findPath(startNode as unknown as BattleMapTile, endNode as unknown as BattleMapTile, mapForPathfinder);
    
    if (pathNodes.length === 0 && startNode !== endNode) {
        return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: true };
    }

    const pathCoords = new Set(pathNodes.map(p => p.id));
    const orderedPath = pathNodes.map(p => p.coordinates);
    const travelTime = pathNodes.reduce((acc, node) => acc + node.movementCost, 0) - (startNode.movementCost || 0);

    return { path: pathCoords, orderedPath, time: travelTime, isBlocked: false };
  }, [isQuickTravelMode, hoveredTile, playerSubmapCoords, pathfindingGrid, submapDimensions, currentWorldBiomeId, simpleHash]);


  const getHintForTile = useCallback((submapX: number, submapY: number, effectiveTerrain: string, featureConfig: SeededFeatureConfig | null ): string => {
    const tileKey = `${parentWorldMapCoords.x}_${parentWorldMapCoords.y}_${submapX}_${submapY}`;
    if (inspectedTileDescriptions[tileKey]) {
      return inspectedTileDescriptions[tileKey];
    }

    const dx = Math.abs(submapX - playerSubmapCoords.x);
    const dy = Math.abs(submapY - playerSubmapCoords.y);
    const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);

    let hintKey = 'default';
    if (featureConfig) {
      hintKey = featureConfig.id; 
    } else if (effectiveTerrain !== 'default') {
      hintKey = effectiveTerrain;
    }
    
    const biomeDefaultKey = `${currentWorldBiomeId}_default`;

    if (isAdjacent) {
      if (submapTileHints[hintKey] && submapTileHints[hintKey].length > 0) {
        return submapTileHints[hintKey][simpleHash(submapX, submapY, 'hint_adj_feature') % submapTileHints[hintKey].length];
      } else if (submapTileHints[biomeDefaultKey] && submapTileHints[biomeDefaultKey].length > 0){
        return submapTileHints[biomeDefaultKey][simpleHash(submapX, submapY, 'hint_adj_biome') % submapTileHints[biomeDefaultKey].length];
      }
    } else {
       if (featureConfig?.name) return `An area featuring a ${featureConfig.name.toLowerCase()}.`;
       if (effectiveTerrain !== 'default' && effectiveTerrain !== 'path_adj' && effectiveTerrain !== 'path') return `A patch of ${effectiveTerrain.replace(/_/g, ' ')}.`;
       return `A patch of ${currentBiome?.name || 'terrain'}.`;
    }
    return submapTileHints['default'][simpleHash(submapX, submapY, 'hint_adj_fallback') % submapTileHints['default'].length];

  }, [playerSubmapCoords, simpleHash, currentWorldBiomeId, currentBiome, inspectedTileDescriptions, parentWorldMapCoords]);

  const submapGrid = useMemo(() => {
    const grid = [];
    for (let r = 0; r < submapDimensions.rows; r++) {
      for (let c = 0; c < submapDimensions.cols; c++) {
        // Only compute the visuals structure here, NOT the tooltip content
        const visuals = getTileVisuals(r, c);
        grid.push({ r, c, visuals });
      }
    }
    return grid;
  }, [submapDimensions.rows, submapDimensions.cols, getTileVisuals]);
  
  const inspectableTiles = useMemo(() => {
    const tiles = new Set<string>();
    if (!isInspecting || !playerSubmapCoords) return tiles;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const adjX = playerSubmapCoords.x + dx;
        const adjY = playerSubmapCoords.y + dy;
        if (adjX >= 0 && adjX < submapDimensions.cols && adjY >= 0 && adjY < submapDimensions.rows) {
          tiles.add(`${adjX},${adjY}`);
        }
      }
    }
    return tiles;
  }, [isInspecting, playerSubmapCoords, submapDimensions]);

  const handleTileClickForInspection = useCallback((tileX: number, tileY: number, effectiveTerrain: string, featureConfig: SeededFeatureConfig | null) => {
    if (disabled) return;
    
    if(isQuickTravelMode) {
      const travelData = quickTravelData;
      if(travelData.path.size > 0) {
        onAction({ type: 'QUICK_TRAVEL', label: `Quick travel to (${tileX},${tileY})`, payload: { quickTravel: { destination: { x: tileX, y: tileY }, durationSeconds: travelData.time * 60 } }});
        setIsQuickTravelMode(false);
      }
      return;
    }

    if (isInspecting) {
      if (inspectableTiles.has(`${tileX},${tileY}`)) {
        const payload: InspectSubmapTilePayload = {
          tileX, tileY, effectiveTerrainType: effectiveTerrain, worldBiomeId: currentWorldBiomeId,
          parentWorldMapCoords, activeFeatureConfig: featureConfig || undefined,
        };
        onAction({ type: 'inspect_submap_tile', label: `Inspect tile (${tileX},${tileY})`, payload: { inspectTileDetails: payload }});
        setInspectionMessage(`Inspecting tile (${tileX}, ${tileY})...`);
      } else {
        setInspectionMessage("You can only inspect adjacent tiles.");
      }
    }
  }, [disabled, isQuickTravelMode, isInspecting, quickTravelData, inspectableTiles, onAction, currentWorldBiomeId, parentWorldMapCoords]);
  
  const handleTileHover = useCallback((x: number, y: number) => {
      if (isQuickTravelMode) setHoveredTile({ x, y });
  }, [isQuickTravelMode]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Simple arrow key navigation for submap inspection could be added here if desired
  };

  const toggleGlossary = () => setIsGlossaryOpen(!isGlossaryOpen);
  
  const handleInspectClick = () => {
    if (disabled) return;
    setIsQuickTravelMode(false);
    setIsInspecting(!isInspecting);
    setInspectionMessage(isInspecting ? null : "Select an adjacent tile to inspect.");
  };
  
  const handleQuickTravelClick = () => {
    if (disabled) return;
    setIsInspecting(false);
    setInspectionMessage(null);
    setIsQuickTravelMode(!isQuickTravelMode);
  };

  const glossaryItems: GlossaryDisplayItem[] = useMemo(() => {
    const items: GlossaryDisplayItem[] = [];
    const addedIcons = new Set<string>();

    const addIcon = (icon: string, meaningKey: string, category?: string) => {
        if (icon && !addedIcons.has(icon)) {
            items.push({ icon, meaning: SUBMAP_ICON_MEANINGS[icon] || meaningKey, category });
            addedIcons.add(icon);
        }
    };
    
    addIcon('🧍', 'Your Position', 'Player');
    if (visualsConfig.pathIcon) addIcon(visualsConfig.pathIcon, 'Path Marker', 'Path');
    visualsConfig.seededFeatures?.forEach(sf => addIcon(sf.icon, sf.name || sf.id, 'Seeded Feature'));
    visualsConfig.scatterFeatures?.forEach(sc => addIcon(sc.icon, `Scatter: ${sc.icon}`, 'Scatter Feature'));
    visualsConfig.pathAdjacency?.scatter?.forEach(paSc => addIcon(paSc.icon, `Path Adjacency: ${paSc.icon}`, 'Path Adjacency Scatter'));
    if(visualsConfig.caTileVisuals) {
         if(visualsConfig.caTileVisuals.wall.icon) addIcon(visualsConfig.caTileVisuals.wall.icon, 'Wall', 'Structure');
         // Implicitly handle floors if they have icons, though usually they don't
    }

    return items.sort((a,b) => (a.category || '').localeCompare(b.category || '') || a.meaning.localeCompare(b.meaning));
  }, [visualsConfig]);

  const gridContainerStyle: React.CSSProperties & { '--tile-size': string } = {
    '--tile-size': '1.75rem', 
    display: 'grid',
    gridTemplateColumns: `repeat(${submapDimensions.cols}, var(--tile-size))`,
    gridTemplateRows: `repeat(${submapDimensions.rows}, var(--tile-size))`,
    position: 'relative', 
  };
  
  const dayNightOverlayClass = getDayNightOverlayClass(gameTime);


  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="submap-pane-title"
    >
      <div className="bg-gray-800 p-3 md:p-4 rounded-xl shadow-2xl border border-gray-700 w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 id="submap-pane-title" className="text-xl md:text-2xl font-bold text-amber-400 font-cinzel">
            Local Area Scan - {currentLocation.name}
          </h2>
          <button
            ref={firstFocusableElementRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Close submap"
          >
            &times;
          </button>
        </div>
        
        {isInspecting && inspectionMessage && (
          <p className="text-center text-sm text-yellow-300 mb-2 italic">{inspectionMessage}</p>
        )}

        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0"> {/* Use overflow-hidden on parent */}
          {/* Submap Grid Container */}
          <div 
            className="p-1 bg-gray-900/30 rounded-md shadow-inner flex-grow overflow-auto scrollable-content relative" 
            onKeyDown={handleKeyDown}
            onMouseLeave={() => setHoveredTile(null)}
            onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
          >
            <div
                ref={gridContainerRef}
                style={gridContainerStyle}
                role="grid"
                aria-labelledby="submap-grid-description"
            >
              <p id="submap-grid-description" className="sr-only">
                Submap grid showing local terrain features. Your current position is marked with a person icon.
              </p>
              {submapGrid.map(({ r, c, visuals }) => {
                const isPlayerPos = playerSubmapCoords?.x === c && playerSubmapCoords?.y === r;
                const tileKey = `${c},${r}`;
                const isHighlightedForInspection = isInspecting && inspectableTiles.has(tileKey);
                const isInteractiveResource = !isInspecting && !isQuickTravelMode && visuals.isResource && ((Math.abs(c-playerSubmapCoords.x) <=1 && Math.abs(r-playerSubmapCoords.y) <= 1));
                const isInQuickTravelPath = isQuickTravelMode && quickTravelData.path.has(tileKey);
                const isBlockedForTravel = pathfindingGrid.get(tileKey)?.blocksMovement === true;
                const isHovered = hoveredTile?.x === c && hoveredTile?.y === r;
                const isDestination = isQuickTravelMode && isHovered;
                
                // Calculate the tooltip content here, during render time. 
                // This keeps the 'visuals' object in submapGrid stable for React.memo
                const tooltipContent = getHintForTile(c, r, visuals.effectiveTerrainType, visuals.activeSeededFeatureConfigForTile);

                return (
                  <SubmapTile
                    key={tileKey}
                    r={r}
                    c={c}
                    visuals={visuals}
                    tooltipContent={tooltipContent}
                    isPlayerPos={isPlayerPos}
                    isHighlightedForInspection={isHighlightedForInspection}
                    isInteractiveResource={isInteractiveResource}
                    isInQuickTravelPath={isInQuickTravelPath}
                    isQuickTravelMode={isQuickTravelMode}
                    isBlockedForTravel={isBlockedForTravel}
                    isDestination={!!isDestination}
                    isQuickTravelBlocked={quickTravelData.isBlocked}
                    onMouseEnter={handleTileHover}
                    onClick={handleTileClickForInspection}
                    isDisabled={disabled || (isInspecting && !isPlayerPos && !isHighlightedForInspection)}
                  />
                );
              })}
              
              {/* Dynamic SVG Path Overlay */}
              {isQuickTravelMode && quickTravelData.orderedPath.length > 0 && (
                  <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none z-[20]"
                      viewBox={`0 0 ${submapDimensions.cols} ${submapDimensions.rows}`}
                      preserveAspectRatio="none" // Stretch to fit container
                  >
                      <polyline
                          points={quickTravelData.orderedPath.map(p => 
                              `${p.x + 0.5},${p.y + 0.5}`
                          ).join(' ')}
                          fill="none"
                          stroke="yellow"
                          strokeWidth="0.15" // Relative to tile size of 1
                          strokeOpacity="0.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      />
                      {/* Destination Marker */}
                      {hoveredTile && !quickTravelData.isBlocked && (
                          <circle 
                              cx={hoveredTile.x + 0.5} 
                              cy={hoveredTile.y + 0.5} 
                              r="0.3" 
                              fill="yellow" 
                              stroke="white" 
                              strokeWidth="0.05" 
                          />
                      )}
                  </svg>
              )}
            </div>
            <div className={`day-night-overlay ${dayNightOverlayClass}`}></div>
          </div>


          {/* Controls Column */}
          <div className="flex flex-col gap-3 md:w-auto md:max-w-sm flex-shrink-0 overflow-hidden">
            <div className="flex-shrink-0">
                <CompassPane
                  currentLocation={currentLocation}
                  currentSubMapCoordinates={playerSubmapCoords}
                  worldMapCoords={currentLocation.mapCoordinates}
                  subMapCoords={playerSubmapCoords}
                  onAction={onAction}
                  disabled={disabled || isInspecting || isQuickTravelMode}
                  mapData={mapData}
                  gameTime={gameTime}
                  isSubmapContext={true}
                />
            </div>
            <div className="flex flex-col items-stretch gap-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600/70 shadow-md flex-shrink-0">
                <button
                    onClick={handleQuickTravelClick}
                    disabled={disabled}
                    className={`px-3 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors w-full
                                ${isQuickTravelMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                                disabled:bg-gray-500 disabled:cursor-not-allowed`}
                >
                  {isQuickTravelMode ? 'Cancel Travel' : 'Quick Travel'}
                </button>
                <button
                    onClick={handleInspectClick}
                    disabled={disabled}
                    className={`px-3 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors w-full
                                ${isInspecting ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'}
                                disabled:bg-gray-500 disabled:cursor-not-allowed`}
                >
                    {isInspecting ? 'Cancel Inspect' : 'Inspect Tile'}
                </button>
                <button 
                    onClick={toggleGlossary}
                    disabled={disabled}
                    className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md shadow-sm transition-colors w-full disabled:bg-gray-500 disabled:cursor-not-allowed"
                    aria-label="Toggle submap legend"
                >
                    {isGlossaryOpen ? 'Hide Legend' : 'Show Legend'}
                </button>
            </div>
            <div className="mt-2 flex-grow overflow-y-auto scrollable-content border-t border-gray-700 pt-2">
                <ActionPane
                    currentLocation={currentLocation}
                    npcsInLocation={npcsInLocation}
                    itemsInLocation={itemsInLocation}
                    onAction={onAction}
                    disabled={disabled || isInspecting || isQuickTravelMode}
                    geminiGeneratedActions={geminiGeneratedActions}
                    isDevDummyActive={isDevDummyActive}
                    unreadDiscoveryCount={unreadDiscoveryCount}
                    hasNewRateLimitError={hasNewRateLimitError}
                />
            </div>
          </div>
        </div>
        
        {isGlossaryOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]" onClick={(e) => e.target === e.currentTarget && setIsGlossaryOpen(false)}>
              <div className="bg-gray-800 p-4 rounded-lg shadow-xl max-w-md w-full max-h-[70vh] overflow-y-auto scrollable-content border border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-amber-400">Submap Legend</h3>
                    <button onClick={toggleGlossary} className="text-gray-300 hover:text-white text-xl">&times;</button>
                </div>
                <GlossaryDisplay items={glossaryItems} title=""/>
              </div>
          </div>
        )}

        {isQuickTravelMode && (
            <div 
                className="fixed bg-gray-900/80 text-white text-xs px-2 py-1 rounded-md shadow-lg pointer-events-none"
                style={{ top: mousePosition.y + 20, left: mousePosition.x + 20, zIndex: 100 }}
            >
               {quickTravelData.isBlocked ? (
                  <span className="text-red-400 font-bold">Path Blocked</span>
               ) : (
                  quickTravelData.path.size > 0 ? `Travel Time: ${quickTravelData.time} minutes` : 'Select a tile to travel'
               )}
            </div>
        )}
      </div>
    </div>
  );
};
export default SubmapPane;
