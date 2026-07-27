/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 11/06/2026, 12:51:57
 * Dependents: components/BattleMap/CombatCharacterInspector.tsx, components/World3D/World3DWrapper.tsx, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellcastingAdapter.ts, types/index.ts, types/mechanics.ts, utils/character/checkUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/world/sceneUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Core ability and phase primitives shared across game domains.
 */
export declare enum GamePhase {
    MAIN_MENU = 0,
    CHARACTER_CREATION = 1,
    PLAYING = 2,
    GAME_OVER = 3,
    BATTLE_MAP_DEMO = 4,
    LOAD_TRANSITION = 5,
    /**
     * Reserved ordinal slot — formerly VILLAGE_VIEW, the legacy 2D village screen
     * (TownCanvas), retired in the grid-retirement program (slices 1a/1b). The
     * member is kept as a placeholder so every phase after it keeps its numeric
     * index and existing saves stay index-compatible. Do NOT reuse or reference.
     */
    RESERVED_RETIRED_VILLAGE_VIEW = 6,
    COMBAT = 7,
    NOT_FOUND = 8,
    /** 3D world chunk streaming sandbox demo phase added in Plan 2. */
    WORLD3D_DEMO = 9,
    /**
     * Worldforge atlas cartographer demo (docs/projects/worldforge — the
     * ported-FMG native map surface). Appended LAST so existing phase indexes
     * stay save-compatible. URL slug: 'worldforge'.
     */
    WORLDFORGE_DEMO = 10,
    /**
     * Combat messaging system demo phase, added to mount and display the
     * unified combat logging and notification system in action.
     */
    COMBAT_MESSAGING_DEMO = 11,
    /**
     * Spawn-on-land audit harness (?phase=spawnpreview). A dedicated preview mode
     * for the reroll→spawn problem: rerolls worlds and renders the EXACT MapPane
     * marker pipeline (grid↔atlas bridge → Voronoi site) over the real atlas, with
     * a pass/fail readout and a batch iterator, so an ocean spawn is reproducible
     * and visible in isolation. Appended LAST to keep phase indexes save-compatible.
     * URL slug: 'spawnpreview'.
     */
    SPAWN_PREVIEW = 12,
    /**
     * Agent-sim motion preview (?phase=agentsim). Standalone harness for the
     * WF-AGENTSIM street-movement slice: generates a demo burg + roster and renders
     * townsfolk walking between home and work as a clock scrubs the day — a visual
     * sign-off for the sim-LOD motion layer, reachable without a playing session.
     * Appended LAST to keep phase indexes save-compatible. URL slug: 'agentsim'.
     */
    AGENTSIM_PREVIEW = 13,
    /**
     * 3D agent-walking proof (?phase=agentsim3d). Standalone R3F scene rendering the
     * real <GroundAgents> InstancedMesh over a demo town — townsfolk walk the streets
     * as the clock scrubs, reachable without the load-save → Enter-3D → click-cell
     * chain. Appended LAST (save-compatible). URL slug: 'agentsim3d'.
     */
    AGENTSIM_3D_PREVIEW = 14,
    /**
     * Start Point Selection — shown after character creation, before play. The
     * player surveys the generated world and picks a *town* to begin in (the spawn
     * is always a settlement, never wilderness/ocean). Appended LAST to keep phase
     * indexes save-compatible. URL slug: 'startselect'.
     */
    START_POINT_SELECTION = 15,
    /**
     * Living-world town sim preview (?phase=livingworld). Standalone harness that
     * generates a demo town, tags its key NPCs, and ages it N years — rendering the
     * resulting Town Chronicle (births/deaths/inheritance/succession) and current
     * institution-holders. The play-and-eyeball surface for the multi-day sim,
     * reachable without a playing session. Appended LAST (save-index compatible).
     * URL slug: 'livingworld'.
     */
    LIVING_WORLD_PREVIEW = 16,
    /**
     * WebGPU render probe (?phase=webgpuprobe). Renders the streamed ground world
     * through three.js WebGPURenderer to prove the WebGPU migration path. Dev
     * harness only; appended LAST (save-index compatible). URL slug: 'webgpuprobe'.
     */
    WEBGPU_PROBE = 17
}
export type AbilityScoreName = 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
export interface AbilityScores {
    Strength: number;
    Dexterity: number;
    Constitution: number;
    Intelligence: number;
    Wisdom: number;
    Charisma: number;
}
export interface Skill {
    id: string;
    name: string;
    ability: AbilityScoreName;
}
export interface CharacterSenses {
    darkvision: number;
    blindsight: number;
    tremorsense: number;
    truesight: number;
}
/**
 * Non-walking movement speeds in feet (5e stat block).
 * Walking speed stays on {@link CharacterStats.speed} for existing movement math.
 */
export type ExtraMovementSpeeds = Partial<Record<'fly' | 'swim' | 'climb' | 'burrow', number>>;
export interface CharacterStats {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    baseInitiative: number;
    speed: number;
    /** Present when the creature has fly/swim/climb/burrow speeds in source data (e.g. 5eTools). */
    extraMovementSpeeds?: ExtraMovementSpeeds;
    cr: string;
    crLair?: string;
    xpLair?: number;
    size?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
    alignment?: string;
    creatureTypes?: string[];
    senses?: CharacterSenses;
    legendaryActionsPerRound?: number;
    /**
     * Explicit saving throw bonuses extracted from 5eTools `save` field (e.g. `{ dex: "+6", wis: "+7" }`).
     * Keys are lowercase ability names ("str","dex","con","int","wis","cha").
     * When present, these override the engine's computed `abilityMod + proficiencyBonus` formula
     * so that monsters match their published stat block values exactly.
     */
    saveBonuses?: Partial<Record<string, number>>;
}
