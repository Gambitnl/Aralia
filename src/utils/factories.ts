import {
  Spell,
  SpellSchool,
  SpellRarity,
  SpellAttackType,
  CastingTime,
  Range,
  Components,
  Duration,
  SpellTargeting,
  DamageEffect
} from '@/types/spells';

import { getGameEpoch } from '@/utils/timeUtils';
import {
  GameState,
  GamePhase,
  PlayerCharacter,
  CombatCharacter,
  Item,
  GameMessage,
  MapData,
  DiscoveryEntry,
  Quest,
  Monster,
  GroundingChunk,
  TempPartyMember,
  Action,
  GeminiLogEntry,
  NpcMemory,
  DiscoveryResidue,
  EconomyState,
  AbilityScores,
  Race,
  Class,
  Skill,
  TransportMode,
  CombatState
} from '@/types/index';

import {
  TurnState,
  CombatAction,
  Position
} from '@/types/combat';

/**
 * Creates a mock Spell object with sensible defaults.
 * @param overrides Partial<Spell> to override default values.
 * @returns A complete Spell object.
 */
export function createMockSpell(overrides: Partial<Spell> = {}): Spell {
  const defaultCastingTime: CastingTime = { value: 1, unit: "action" };
  const defaultRange: Range = { type: "ranged", distance: 60 };
  const defaultComponents: Components = { verbal: true, somatic: true, material: false };
  const defaultDuration: Duration = { type: "instantaneous", concentration: false };

  // Explicitly using SpellTargeting and DamageEffect for clarity/defaults
  const defaultTargeting: SpellTargeting = {
    type: "single",
    range: 60,
    validTargets: ["creatures", "enemies"]
  };

  const defaultDamageEffect: DamageEffect = {
    type: "DAMAGE",
    trigger: { type: "immediate" },
    condition: { type: "hit" },
    damage: { dice: "1d8", type: "Fire" }
  };

  return {
    id: `spell-${crypto.randomUUID()}`,
    name: "Mock Spell",
    level: 1,
    school: "Evocation" as SpellSchool,
    classes: ["Wizard"],
    description: "A mock spell for testing.",
    rarity: "common" as SpellRarity,
    attackType: "ranged" as SpellAttackType,

    castingTime: defaultCastingTime,
    range: defaultRange,
    components: defaultComponents,
    duration: defaultDuration,
    targeting: defaultTargeting,

    effects: [defaultDamageEffect],

    ...overrides
  };
}

/**
 * Creates a mock Item object with sensible defaults.
 */
export function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${crypto.randomUUID()}`,
    name: "Mock Item",
    type: "weapon",
    description: "A generic mock item.",
    rarity: "common", // Note: Item interface doesn't strictly type this as a union yet, assumed common string
    weight: 1,
    // value: 10, // Removed: value is not in Item interface
    ...overrides
  };
}

/**
 * Creates a mock Quest object with sensible defaults.
 */
export function createMockQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: `quest-${crypto.randomUUID()}`,
    title: "Mock Quest",
    description: "A quest for testing purposes.",
    status: "Active", // Matches QuestStatus.Active enum string value
    objectives: [],
    giverId: "npc-123",
    dateStarted: getGameEpoch().getTime(),
    rewards: { xp: 100, gold: 50 },
    ...overrides
  };
}

/**
 * Creates a mock PlayerCharacter object with sensible defaults.
 */
export function createMockPlayerCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  const mockRace: Race = {
    id: 'human',
    name: 'Human',
    description: 'Versatile and adaptable.',
    traits: []
  };

  const mockClass: Class = {
    id: 'fighter',
    name: 'Fighter',
    description: 'A master of martial combat.',
    hitDie: 10,
    primaryAbility: ['Strength', 'Constitution'],
    savingThrowProficiencies: ['Strength', 'Constitution'],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: []
  };

  const mockAbilities: AbilityScores = {
    Strength: 10,
    Dexterity: 10,
    Constitution: 10,
    Intelligence: 10,
    Wisdom: 10,
    Charisma: 10
  };

  const mockSkills: Skill[] = [];

  return {
    id: `char-${crypto.randomUUID()}`,
    name: "Mock Hero",
    race: mockRace,
    class: mockClass,
    abilityScores: mockAbilities,
    finalAbilityScores: mockAbilities,
    skills: mockSkills,
    hp: 10,
    maxHp: 10,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot' as TransportMode,
    equippedItems: {},
    ...overrides
  };
}

/**
 * Creates a mock GameState object with sensible defaults.
 * @param overrides Partial<GameState> to override default values.
 * @returns A complete GameState object.
 */
export function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.PLAYING,
    party: [] as PlayerCharacter[],
    tempParty: null as TempPartyMember[] | null,
    inventory: [] as Item[],
    gold: 100,
    currentLocationId: "village-center",
    subMapCoordinates: { x: 0, y: 0 },
    messages: [] as GameMessage[],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 12345,
    mapData: null as MapData | null,
    isMapVisible: true,
    isSubmapVisible: true,
    isPartyOverlayVisible: true,
    isNpcTestModalVisible: false,
    isLogbookVisible: false,
    isGameGuideVisible: false,
    dynamicLocationItemIds: {},
    currentLocationActiveDynamicNpcIds: null,
    geminiGeneratedActions: [] as Action[],
    characterSheetModal: {
      isOpen: false,
      character: null
    },
    gameTime: getGameEpoch(),

    isDevMenuVisible: false,
    isPartyEditorVisible: false,
    isGeminiLogViewerVisible: false,
    geminiInteractionLog: [] as GeminiLogEntry[],
    hasNewRateLimitError: false,
    devModelOverride: null,

    isEncounterModalVisible: false,
    generatedEncounter: null as Monster[] | null,
    encounterSources: null as GroundingChunk[] | null,
    encounterError: null,

    currentEnemies: null,

    lastInteractedNpcId: null,
    lastNpcResponse: null,

    inspectedTileDescriptions: {},

    discoveryLog: [] as DiscoveryEntry[],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,

    npcMemory: {} as Record<string, NpcMemory>,

    locationResidues: {} as Record<string, DiscoveryResidue>,

    metNpcIds: [],

    merchantModal: {
      isOpen: false,
      merchantName: "",
      merchantInventory: [] as Item[],
      economy: undefined as EconomyState | undefined,
    },

    questLog: [] as Quest[],

    ...overrides
  };
}

/**
 * Creates a mock CombatCharacter object with sensible defaults.
 */
export function createMockCombatCharacter(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  const mockClass: Class = {
    id: "wizard",
    name: "Wizard",
    description: "A scholar who can wield magic.",
    hitDie: 6,
    primaryAbility: ["Intelligence"],
    savingThrowProficiencies: ["Intelligence", "Wisdom"],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: []
  };

  const defaultPosition: Position = { x: 0, y: 0 };

  const defaults: CombatCharacter = {
    id: `combat-char-${crypto.randomUUID()}`,
    name: "Mock Combatant",
    level: 1,
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    initiative: 10,
    position: defaultPosition,
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: "1/4"
    },
    abilities: [],
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1
    },
    class: mockClass,
    // Add missing fields that are commonly needed
    concentratingOn: undefined,
    conditions: [],
    activeEffects: [],
    riders: [],
    savePenaltyRiders: [],
    activeLightSources: []
  } as unknown as CombatCharacter;

  return { ...defaults, ...overrides };
}

/**
 * Creates a mock CombatState object with sensible defaults.
 * @param overrides Partial<CombatState> to override default values.
 * @returns A complete CombatState object.
 */
export function createMockCombatState(overrides: Partial<CombatState> = {}): CombatState {
  const defaultTurnState: TurnState = {
    currentTurn: 0,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: [] as CombatAction[]
  };

  return {
    isActive: true,
    characters: [],
    turnState: defaultTurnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: [],
    mapData: {
      dimensions: { width: 20, height: 20 },
      tiles: new Map(),
      theme: 'forest',
      seed: 12345
    },
    ...overrides
  };
}
