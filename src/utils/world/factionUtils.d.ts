/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:18
 * Dependents: factionUtils.ts, world/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/factionUtils.ts
 * Utility functions for managing faction reputation and standing.
 */
import { GameState, GameMessage } from '../../types';
import { PlayerFactionStanding, Faction } from '../../types/factions';
export type ReputationTier = 'NEMESIS' | 'HOSTILE' | 'UNFRIENDLY' | 'NEUTRAL' | 'FRIENDLY' | 'HONORED' | 'REVERED';
export declare const REPUTATION_THRESHOLDS: Record<ReputationTier, {
    min: number;
    max: number;
}>;
export declare const getReputationTier: (standing: number) => ReputationTier;
export declare const getAllFactions: (worldSeed?: number) => Record<string, Faction>;
/**
 * Gets the player's standing with a faction.
 * If 'secretly' is true, returns the true standing.
 * If false, returns the public standing (what they show).
 */
export declare const getFactionStanding: (state: GameState, factionId: string, secretly?: boolean) => number;
/**
 * Calculates the new standing value, clamped between -100 and 100.
 */
export declare const calculateNewStanding: (current: number, change: number) => number;
/**
 * Generates a log message for a reputation change.
 */
export declare const formatReputationChangeMessage: (factionName: string, change: number, type: "public" | "secret", reason?: string) => string;
interface RippleEffect {
    factionId: string;
    amount: number;
    reason: string;
}
/**
 * Calculates secondary reputation changes based on alliances and rivalries.
 *
 * Rules:
 * - Allies gain 50% of positive changes.
 * - Allies gain 50% of negative changes (they dislike you for hurting their friend).
 * - Enemies gain 50% of negative changes (they like you for hurting their enemy).
 * - Enemies lose 50% of positive changes (they dislike you for helping their enemy).
 * - Rivals lose 25% of positive changes (jealousy).
 * - Rivals gain 25% of negative changes (schadenfreude).
 */
export declare const calculateRippleEffects: (factions: Record<string, Faction>, primaryFactionId: string, amount: number) => RippleEffect[];
/**
 * @deprecated Use FactionManager.applyReputationChange instead.
 * This utility function is kept for backward compatibility but does not generate rumors.
 */
interface ApplyReputationResult {
    standings: Record<string, PlayerFactionStanding>;
    logs: GameMessage[];
}
/**
 * Applies a reputation change and all its ripple effects.
 * Returns updated standings map and generated log messages.
 * Does NOT mutate the input state.
 *
 * @deprecated Use FactionManager.applyReputationChange() for full feature support (rumors).
 */
export declare const applyReputationChange: (state: GameState, factionId: string, amount: number, reason: string) => ApplyReputationResult;
/**
 * Modifies the standing between two factions.
 * Returns the new standing value.
 * Does NOT mutate the faction objects, but assumes you will update state with the return value.
 * (Actually, to be safe, this should probably return the modified Faction objects or similar)
 *
 * For now, simpler to just return the new value and let caller handle object spread.
 */
export declare const modifyFactionRelationship: (factions: Record<string, Faction>, actorId: string, targetId: string, amount: number) => {
    actor: Faction;
    target: Faction;
} | null;
export {};
