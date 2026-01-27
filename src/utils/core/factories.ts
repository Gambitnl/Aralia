// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:19:56
 * Dependents: core/index.ts, factories.ts
 * Imports: 7 files
 * 
 * Tool: Codebase Visualizer (Headless Sync)
 */
// @dependencies-end

import {
  Spell,
  SpellSchool,
  SpellRarity,
  SpellAttackType,
  DamageEffect,
  DamageType
} from '@/types/spells';

import { getGameEpoch, getGameDay } from '@/utils/core/timeUtils';
import {
  GameState,
  GamePhase,
  PlayerCharacter,
  CombatCharacter,
  Item,
  GameMessage,
  Monster,
  AbilityScores,
  Race,
  Class,
  TransportMode,
  CombatState,
  QuestStatus,
  ItemType,
  Faction
} from '@/types/index';
import type { QuestDefinition } from '@/types/quests';

import {
  TurnState
} from '@/types/combat';

import { CommandContext } from '@/commands/base/SpellCommand';
import { v4 as uuidv4 } from 'uuid';
import { buildHitPointDicePools } from '@/utils/character';

/**
 * [Warden] Hardened factories against failures in uuid generation or time utilities.
 * Also ensures that returned objects are valid even if overrides are malformed.
 */

// Helper to safely generate a UUID, falling back to random string if it fails
const safeUuid = (): string => {
  try {
    return uuidv4();
  } catch (e) {
    console.error("Warden: uuidv4 failed, using fallback", e);
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * Creates a mock Spell object with sensible defaults.
 * @param overrides Partial<Spell> to override default values.
 * @returns A complete Spell object.
 */
export function createMockSpell(overrides: Partial<Spell> = {}): Spell {
  try {
    const defaultDamageEffect: DamageEffect = {
      type: "DAMAGE",
      trigger: { type: "immediate" },
      condition: { type: "hit" },
      description: "Mock damage effect.",
      damage: { dice: "1d8", type: DamageType.Fire }
    };

    const defaultTargeting = {
      type: "single",
      range: 60,
      maxTargets: 1,
      validTargets: ["creatures"],
      lineOfSight: true,
      // SpellValidator expects areaOfEffect on all targeting payloads.
      areaOfEffect: { shape: "Sphere", size: 0 },
      filter: {
        creatureTypes: [],
        excludeCreatureTypes: [],
        sizes: [],
        alignments: [],
        hasCondition: [],
        isNativeToPlane: false,
      },
    } as unknown as Spell['targeting'];

    return {
      id: `spell-${safeUuid()}`,
      name: "Mock Spell",
      aliases: [],
      level: 1,
      school: "Evocation" as SpellSchool,
      source: "core",
      legacy: false,
      classes: ["Wizard"],
      description: "A mock spell for testing.",
      ritual: false,
      rarity: "common" as SpellRarity,
      attackType: "ranged" as SpellAttackType,

      castingTime: {
        value: 1,
        unit: "action",
        combatCost: {
          type: "action",
          condition: ""
        },
        explorationCost: {
          value: 0,
          unit: "minute"
        }
      },

      range: {
        type: "ranged",
        distance: 60
      },

      components: {
        verbal: true,
        somatic: true,
        material: false,
        materialDescription: "",
        materialCost: 0,
        isConsumed: false
      },

      duration: {
        type: "instantaneous",
        value: 0,
        unit: "round",
        concentration: false
      },

      targeting: defaultTargeting,

      effects: [defaultDamageEffect],

      arbitrationType: "mechanical",
      aiContext: {
        prompt: "",
        playerInputRequired: false
      },
      higherLevels: "",
      tags: [],

      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockSpell failed", error);
    // Return a bare-minimum safe object to prevent downstream crashes
    return {
      id: "error-spell",
      name: "Error Spell",
      level: 0,
      school: "Universal" as SpellSchool,
      classes: [],
      description: "Failed to create spell.",
      ritual: false,
      rarity: "common",
      attackType: "ranged",
      castingTime: { value: 1, unit: "action" },
      range: { type: "ranged", distance: 0 },
      components: { verbal: false, somatic: false, material: false },
      duration: { type: "instantaneous", concentration: false },
      targeting: { type: "self", validTargets: ["self"] },
      effects: [],
      arbitrationType: "mechanical",
      aiContext: { prompt: "", playerInputRequired: false }
    } as Spell;
  }
}

/**
 * Creates a mock Faction object.
 */
export function createMockFaction(overrides: Partial<Faction> = {}): Faction {
  try {
    return {
      id: `faction-${safeUuid()}`,
      name: "Mock Faction",
      description: "A generic mock faction.",
      type: "NOBLE_HOUSE",
      colors: { primary: "#000000", secondary: "#ffffff" },
      ranks: [],
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [],
      hates: [],
      power: 50,
      assets: [],
      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockFaction failed", error);
    return {
      id: "error-faction",
      name: "Error Faction",
      description: "Failed to create faction.",
      type: "NOBLE_HOUSE",
      colors: { primary: "#000", secondary: "#fff" },
      ranks: [],
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [],
      hates: [],
      power: 0,
      assets: []
    } as Faction;
  }
}

/**
 * Creates a mock CommandContext object with sensible defaults.
 * @param overrides Partial<CommandContext> to override default values.
 * @returns A complete CommandContext object.
 */
export function createMockCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  try {
    // Use existing factories for complex sub-objects to ensure validity
    const caster = createMockCombatCharacter({
      id: `caster-${safeUuid()}`,
      name: 'Mock Caster'
    });

    const target = createMockCombatCharacter({
      id: `target-${safeUuid()}`,
      name: 'Mock Target'
    });

    return {
      spellId: `spell-${safeUuid()}`,
      spellName: 'Mock Spell',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState(),
      // Optional fields remain undefined unless overridden
      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockCommandContext failed", error);
    // Minimal fallback
    return {
      spellId: 'error-context',
      spellName: 'Error Context',
      castAtLevel: 1,
      caster: createMockCombatCharacter({ id: 'fallback-caster' }),
      targets: [],
      gameState: createMockGameState()
    };
  }
}

/**
 * Creates a mock PlayerCharacter object with sensible defaults.
 */
export function createMockPlayerCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  try {
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
      features: [],
      spellcasting: {
        ability: 'Intelligence',
        knownCantrips: 0,
        knownSpellsL1: 0,
        spellList: []
      }
    };

    const mockAbilities: AbilityScores = {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10
    };

    const level = overrides.level ?? 1;
    // Seed class levels so mock characters have valid Hit Dice pools.
    const baseCharacter: PlayerCharacter = {
      id: overrides.id ?? `char-${safeUuid()}`,
      name: overrides.name ?? "Mock Hero",
      race: overrides.race ?? mockRace,
      class: overrides.class ?? mockClass,
      level,
      abilityScores: overrides.abilityScores ?? mockAbilities,
      finalAbilityScores: overrides.finalAbilityScores ?? mockAbilities,
      skills: overrides.skills ?? [],
      hp: overrides.hp ?? 10,
      maxHp: overrides.maxHp ?? 10,
      armorClass: overrides.armorClass ?? 10,
      speed: overrides.speed ?? 30,
      darkvisionRange: overrides.darkvisionRange ?? 0,
      transportMode: (overrides.transportMode ?? 'foot') as TransportMode,
      equippedItems: overrides.equippedItems ?? {},
      statusEffects: overrides.statusEffects ?? [], // Initialize statusEffects
      classLevels: overrides.classLevels ?? { [mockClass.id]: level },
      ...overrides
    };
    if (!baseCharacter.hitPointDice) {
      // Ensure Hit Dice pools exist even when overrides omit them.
      const resolvedClassLevels = baseCharacter.classLevels ?? { [baseCharacter.class.id]: baseCharacter.level ?? 1 };
      baseCharacter.classLevels = resolvedClassLevels;
      baseCharacter.hitPointDice = buildHitPointDicePools(baseCharacter, { classLevels: resolvedClassLevels });
    }
    return baseCharacter;
  } catch (error) {
    console.error("Warden: createMockPlayerCharacter failed", error);
    // Return minimal safe object
    return {
      id: "error-char",
      name: "Error Hero",
      race: { id: "human", name: "Human", description: "", traits: [] },
      class: {
        id: "fighter", name: "Fighter", description: "", hitDie: 10,
        primaryAbility: [], savingThrowProficiencies: [],
        skillProficienciesAvailable: [], numberOfSkillProficiencies: 0,
        armorProficiencies: [], weaponProficiencies: [], features: [],
        spellcasting: {
          ability: 'Intelligence',
          knownCantrips: 0,
          knownSpellsL1: 0,
          spellList: []
        }
      },
      level: 1,
      classLevels: { fighter: 1 },
      abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      skills: [],
      hp: 1, maxHp: 1, armorClass: 10, speed: 30, darkvisionRange: 0,
      transportMode: 'foot' as TransportMode,
      equippedItems: {},
      statusEffects: []
    } as PlayerCharacter;
  }
}

/**
 * Creates a mock GameState object with sensible defaults.
 * @param overrides Partial<GameState> to override default values.
 * @returns A complete GameState object.
 */
export function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  try {
    const resolvedGameTime = overrides.gameTime ?? getGameEpoch();
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
      gameTime: resolvedGameTime, // This can fail if timeUtils is broken
      // Default short rest tracker aligned to the mock game clock.
      shortRestTracker: {
        restsTakenToday: 0,
        lastRestDay: getGameDay(resolvedGameTime),
        lastRestEndedAtMs: null,
      },

      isDevMenuVisible: false,
      isPartyEditorVisible: false,
      isGeminiLogViewerVisible: false,
      geminiInteractionLog: [],
      isOllamaLogViewerVisible: false,
      isUnifiedLogViewerVisible: overrides.isUnifiedLogViewerVisible ?? false,
      ollamaInteractionLog: [],
      hasNewRateLimitError: false,
      isOllamaDependencyModalVisible: false,
      devModelOverride: null,
      isDevModeEnabled: overrides.isDevModeEnabled ?? false,

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

      // Intriguer: Faction System
      factions: {},
      playerFactionStandings: {},
      companions: {},

      // Templar: Religion System
      divineFavor: {},
      temples: {},

      // Shadowbroker: Crime System
      notoriety: {
        globalHeat: 0,
        localHeat: {},
        knownCrimes: [],
        bounties: []
      },

      // Economy System
      economy: {
        marketEvents: [],
        tradeRoutes: [],
        globalInflation: 0,
        regionalWealth: {},
        marketFactors: {
          scarcity: [],
          surplus: []
        },
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        activeEvents: []
      },

      questLog: [],
      notifications: [],

      religion: {
        divineFavor: {},
        discoveredDeities: [],
        activeBlessings: []
      },

      dynamicLocations: {},
      dynamicNPCs: {},
      generatedNpcs: {}, // Generated NPC registry for test state parity.
      environment: {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'clear'
      },
      naval: { playerShips: [], activeShipId: null, currentVoyage: null, knownPorts: [] },
      isThievesGuildVisible: false,
      isNavalDashboardVisible: false,
      isNobleHouseListVisible: false,
      isTradeRouteDashboardVisible: false,
      activeDialogueSession: null,
      isDialogueInterfaceOpen: false,
      activeRumors: [],
      worldHistory: undefined,
      activeHeist: null,
      activeContracts: [],
      playerIdentity: undefined,
      legacy: undefined,
      strongholds: {},
      activeRitual: null,
      banterCooldowns: {},
      // TODO(2026-01-03 pass 4 Codex-CLI): banter debug log placeholder; surface real logs when conversational banter system wires through state.
      banterDebugLog: [],
      isLockpickingModalVisible: false,
      activeLock: null,
      isDiceRollerVisible: false,
      visualDiceEnabled: true,

      underdark: {
        currentDepth: 0,
        currentBiomeId: 'cavern_standard',
        lightLevel: 'bright',
        activeLightSources: [],
        faerzressLevel: 0,
        wildMagicChance: 0,
        sanity: {
          current: 100,
          max: 100,
          madnessLevel: 0
        }
      },

      isQuestLogVisible: false,

      townState: null,
      townEntryDirection: null,

      // TODO: Fix TS2322 - missing or incompatible archivedBanters
      archivedBanters: [],

      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockGameState failed", error);
    // Extreme fallback - manually construct Date if timeUtils failed
    return {
      phase: GamePhase.GAME_OVER, // Safer phase to land in on error
      party: [],
      tempParty: null,
      inventory: [],
      gold: 0,
      currentLocationId: "error",
      subMapCoordinates: { x: 0, y: 0 },
      messages: [],
      isLoading: false,
      loadingMessage: "System Error",
      isImageLoading: false,
      error: "Critical Factory Error",
      worldSeed: 0,
      mapData: null,
      isMapVisible: false,
      isSubmapVisible: false,
      isPartyOverlayVisible: false,
      isNpcTestModalVisible: false,
      isLogbookVisible: false,
      isGameGuideVisible: false,
      dynamicLocationItemIds: {},
      currentLocationActiveDynamicNpcIds: null,
      geminiGeneratedActions: [],
      characterSheetModal: { isOpen: false, character: null },
      gameTime: new Date(),
      // Keep rest tracking stable in the fallback state.
      shortRestTracker: {
        restsTakenToday: 0,
        lastRestDay: getGameDay(new Date()),
        lastRestEndedAtMs: null,
      },
      isDevMenuVisible: true, // Allow dev menu to potentially fix
      isPartyEditorVisible: false,
      isGeminiLogViewerVisible: false,
      isOllamaLogViewerVisible: false,
      isUnifiedLogViewerVisible: false,
      geminiInteractionLog: [],
      ollamaInteractionLog: [],
      hasNewRateLimitError: false,
      isOllamaDependencyModalVisible: false,
      devModelOverride: null,
      isDevModeEnabled: false,
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
      merchantModal: { isOpen: false, merchantName: "", merchantInventory: [] },
      fences: {},
      factions: {},
      playerFactionStandings: {},
      companions: {},
      divineFavor: {},
      temples: {},
      notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
      economy: {
        marketEvents: [],
        tradeRoutes: [],
        globalInflation: 0,
        regionalWealth: {},
        marketFactors: { scarcity: [], surplus: [] },
        buyMultiplier: 1,
        sellMultiplier: 0.5,
        activeEvents: []
      },
      questLog: [],
      notifications: [],
      religion: { divineFavor: {}, discoveredDeities: [], activeBlessings: [] },
      dynamicLocations: {},
      dynamicNPCs: {},
      generatedNpcs: {},
      environment: {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'clear'
      },
      naval: { playerShips: [], activeShipId: null, currentVoyage: null, knownPorts: [] },
      isThievesGuildVisible: false,
      isNavalDashboardVisible: false,
      isNobleHouseListVisible: false,
      isTradeRouteDashboardVisible: false,
      activeDialogueSession: null,
      isDialogueInterfaceOpen: false,
      activeRumors: [],
      worldHistory: undefined,
      activeHeist: null,
      activeContracts: [],
      playerIdentity: undefined,
      legacy: undefined,
      strongholds: {},
      activeRitual: null,
      banterCooldowns: {},
      // TODO: Fix TS2741 - missing archivedBanters in fallback
      archivedBanters: [],
      banterDebugLog: [],
      isLockpickingModalVisible: false,
      activeLock: null,
      isDiceRollerVisible: false,
      visualDiceEnabled: true,
      underdark: { currentDepth: 0, currentBiomeId: 'cavern_standard', lightLevel: 'dim', activeLightSources: [], faerzressLevel: 0, wildMagicChance: 0, sanity: { current: 100, max: 100, madnessLevel: 0 } },
      isQuestLogVisible: false,
      townState: null,
      townEntryDirection: null
    };
  }
}

/**
 * Creates a mock CombatCharacter object with sensible defaults.
 */
export function createMockCombatCharacter(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  try {
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
      features: [],
      spellcasting: {
        ability: 'Intelligence',
        knownCantrips: 0,
        knownSpellsL1: 0,
        spellList: []
      }
    };

    const defaults: CombatCharacter = {
      id: `combat-char-${safeUuid()}`,
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
      savePenaltyRiders: [],
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      damageDealt: [],
      healingDone: []
    };

    return { ...defaults, ...overrides };
  } catch (error) {
    console.error("Warden: createMockCombatCharacter failed", error);
    return {
      id: 'error-combat-char',
      name: 'Error Combatant',
      level: 1, team: 'enemy', currentHP: 1, maxHP: 1,
      initiative: 0, position: { x: 0, y: 0 },
      stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 0, cr: "0" },
      abilities: [], statusEffects: [],
      actionEconomy: {
        action: { used: true, remaining: 0 },
        bonusAction: { used: true, remaining: 0 },
        reaction: { used: true, remaining: 0 },
        movement: { used: 0, total: 0 },
        freeActions: 0
      },
      class: {
        id: "fallback",
        name: "Fallback",
        description: "",
        hitDie: 6,
        primaryAbility: [],
        savingThrowProficiencies: [],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 0,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        spellcasting: {
          ability: 'Intelligence',
          knownCantrips: 0,
          knownSpellsL1: 0,
          spellList: []
        }
      },
      conditions: [], activeEffects: [], riders: [], savePenaltyRiders: [], resistances: [], immunities: [], vulnerabilities: [], damageDealt: [], healingDone: []
    } as CombatCharacter;
  }
}

/**
 * Creates a mock CombatState object with sensible defaults.
 * @param overrides Partial<CombatState> to override default values.
 * @returns A complete CombatState object.
 */
export function createMockCombatState(overrides: Partial<CombatState> = {}): CombatState {
  try {
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
  } catch (error) {
    console.error("Warden: createMockCombatState failed", error);
    return {
      isActive: false,
      characters: [],
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: null, phase: 'planning', actionsThisTurn: [] },
      selectedCharacterId: null, selectedAbilityId: null, actionMode: 'select',
      validTargets: [], validMoves: [], combatLog: [], reactiveTriggers: [], activeLightSources: [],
      mapData: { dimensions: { width: 1, height: 1 }, tiles: new Map(), theme: 'forest', seed: 0 }
    };
  }
}

/**
 * Creates a mock Item object.
 */
export function createMockItem(overrides: Partial<Item> = {}): Item {
  try {
    return {
      id: `item-${safeUuid()}`,
      name: "Mock Item",
      type: ItemType.Treasure, // Default to a valid enum
      description: "A generic mock item.",
      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockItem failed", error);
    return { id: 'error-item', name: 'Error Item', type: ItemType.Treasure, description: 'Error' } as Item;
  }
}

/**
 * Creates a mock Quest object.
 */
export function createMockQuest(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  try {
    const defaultStageId = 'start';
    const defaults: QuestDefinition = {
      id: `quest-${safeUuid()}`,
      title: "Mock Quest",
      description: "A quest to test the quest system.",
      giverId: "npc-1",
      type: 'Side',
      status: QuestStatus.Active,
      stages: {
        [defaultStageId]: {
          id: defaultStageId,
          journalEntry: "Begin the mock adventure.",
          objectives: [],
          nextStageIds: []
        }
      },
      currentStageId: defaultStageId,
      dateStarted: Date.now()
    };
    return { ...defaults, ...overrides };
  } catch (error) {
    console.error("Warden: createMockQuest failed", error);
    const fallbackStage: QuestDefinition['stages'] = {
      fallback: { id: 'fallback', journalEntry: 'Quest factory failed', objectives: [], nextStageIds: [] }
    };
    return {
      id: 'error-quest',
      title: 'Error Quest',
      description: 'Error',
      giverId: 'system',
      type: 'Side',
      status: QuestStatus.Active,
      stages: fallbackStage,
      currentStageId: 'fallback',
      dateStarted: Date.now()
    };
  }
}

/**
 * Creates a mock Monster object.
 */
export function createMockMonster(overrides: Partial<Monster> = {}): Monster {
  try {
    const defaults: Monster = {
      name: "Mock Monster",
      quantity: 1,
      cr: "1",
      description: "A scary monster"
    };
    return { ...defaults, ...overrides };
  } catch (error) {
    console.error("Warden: createMockMonster failed", error);
    return {
      name: 'Error Monster',
      quantity: 1,
      cr: "0",
      description: "Error creating monster"
    };
  }
}


/**
 * Creates a mock GameMessage object.
 */
export function createMockGameMessage(overrides: Partial<GameMessage> = {}): GameMessage {
  try {
    return {
      id: 123,
      text: "This is a mock message.",
      timestamp: new Date(),
      sender: "system",
      ...overrides
    };
  } catch (error) {
    console.error("Warden: createMockGameMessage failed", error);
    return { id: 0, text: "Error creating message", timestamp: new Date(), sender: "system" };
  }
}
