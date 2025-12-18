import {
  Spell,
  SpellSchool,
  SpellRarity,
  SpellAttackType,
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
  Quest,
  Monster,
  AbilityScores,
  Race,
  Class,
  TransportMode,
  CombatState,
  QuestStatus
} from '@/types/index';

import {
  TurnState
} from '@/types/combat';

import { CommandContext } from '@/commands/base/SpellCommand';

/**
 * Creates a mock Spell object with sensible defaults.
 * @param overrides Partial<Spell> to override default values.
 * @returns A complete Spell object.
 */
export function createMockSpell(overrides: Partial<Spell> = {}): Spell {
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

    castingTime: {
      value: 1,
      unit: "action"
    },

    range: {
      type: "ranged",
      distance: 60
    },

    components: {
      verbal: true,
      somatic: true,
      material: false
    },

    duration: {
      type: "instantaneous",
      concentration: false
    },

    targeting: {
      type: "single",
      range: 60,
      validTargets: ["creatures", "enemies"]
    },

    effects: [defaultDamageEffect],

    ...overrides
  };
}

/**
 * Creates a mock CommandContext object with sensible defaults.
 * @param overrides Partial<CommandContext> to override default values.
 * @returns A complete CommandContext object.
 */
export function createMockCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  // Use existing factories for complex sub-objects to ensure validity
  const caster = createMockCombatCharacter({
    id: `caster-${crypto.randomUUID()}`,
    name: 'Mock Caster'
  });

  const target = createMockCombatCharacter({
    id: `target-${crypto.randomUUID()}`,
    name: 'Mock Target'
  });

  return {
    spellId: `spell-${crypto.randomUUID()}`,
    spellName: 'Mock Spell',
    castAtLevel: 1,
    caster,
    targets: [target],
    gameState: createMockGameState(),
    // Optional fields remain undefined unless overridden
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

  return {
    id: `char-${crypto.randomUUID()}`,
    name: "Mock Hero",
    race: mockRace,
    class: mockClass,
    abilityScores: mockAbilities,
    finalAbilityScores: mockAbilities,
    skills: [],
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
    party: [],
    tempParty: null,
    inventory: [],
    gold: 100,
    currentLocationId: "village-center",
    subMapCoordinates: { x: 0, y: 0 },
    messages: [],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 12345,
    mapData: null,
    isMapVisible: true,
    isSubmapVisible: true,
    isPartyOverlayVisible: true,
    isNpcTestModalVisible: false,
    isLogbookVisible: false,
    isGameGuideVisible: false,
    dynamicLocationItemIds: {},
    currentLocationActiveDynamicNpcIds: null,
    geminiGeneratedActions: [],
    characterSheetModal: {
      isOpen: false,
      character: null
    },
    gameTime: getGameEpoch(),

    isDevMenuVisible: false,
    isPartyEditorVisible: false,
    isGeminiLogViewerVisible: false,
    geminiInteractionLog: [],
    hasNewRateLimitError: false,
    devModelOverride: null,

    isEncounterModalVisible: false,
    generatedEncounter: null,
    encounterSources: null,
    encounterError: null,

    currentEnemies: null,

    lastInteractedNpcId: null,
    lastNpcResponse: null,

    inspectedTileDescriptions: {},

    discoveryLog: [],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,

    npcMemory: {},

    locationResidues: {},

    metNpcIds: [],

    merchantModal: {
      isOpen: false,
      merchantName: "",
      merchantInventory: [],
    },

    fences: {},

    questLog: [],

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

  const defaults: CombatCharacter = {
    id: `combat-char-${crypto.randomUUID()}`,
    name: "Mock Combatant",
    level: 1,
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    initiative: 10,
    position: { x: 0, y: 0 },
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
    savePenaltyRiders: []
  };

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
    actionsThisTurn: []
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

/**
 * Creates a mock Item object.
 */
export function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${crypto.randomUUID()}`,
    name: "Mock Item",
    type: "misc",
    description: "A generic mock item.",
    ...overrides
  };
}

/**
 * Creates a mock Quest object.
 */
export function createMockQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: `quest-${crypto.randomUUID()}`,
    name: "Mock Quest",
    description: "A quest to test the quest system.",
    status: QuestStatus.Active,
    objectives: [],
    ...overrides
  };
}

/**
 * Creates a mock Monster object.
 */
export function createMockMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: `monster-${crypto.randomUUID()}`,
    name: "Mock Monster",
    type: "beast",
    cr: 1,
    hp: 20,
    ac: 12,
    stats: {
      strength: 14,
      dexterity: 12,
      constitution: 12,
      intelligence: 6,
      wisdom: 10,
      charisma: 6
    },
    actions: [],
    ...overrides
  };
}

/**
 * Creates a mock GameMessage object.
 */
export function createMockGameMessage(overrides: Partial<GameMessage> = {}): GameMessage {
  return {
    id: `msg-${crypto.randomUUID()}`,
    text: "This is a mock message.",
    timestamp: Date.now(),
    type: "info",
    ...overrides
  };
}
