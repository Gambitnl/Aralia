/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:53
 * Dependents: character/index.ts, identityUtils.ts
 * Imports: 1 files
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
 * @file src/utils/identityUtils.ts
 * Provides logic for identity management, disguise checks, and secret handling.
 */
import type { PlayerIdentityState, Identity, Alias, Disguise, Secret, IntrigueCheckResult } from '../../types/identity';
export declare function createTrueIdentity(name: string, history: string): Identity;
export declare function createAlias(name: string, history: string, initialCredibility?: number): Alias;
export declare function createDisguise(targetAppearance: string, quality: number, vulnerabilities?: string[]): Disguise;
export declare function createSecret(subjectId: string, content: string, value: number, tags?: Secret['tags']): Secret;
export declare function initializePlayerIdentity(characterId: string, name: string): PlayerIdentityState;
/**
 * Calculates the effectiveness of a disguise against a passive observer.
 * @param disguise The disguise being worn.
 * @param observerPerception The observer's passive perception score.
 * @param situationalModifiers Bonuses/penalties (e.g., distance, lighting).
 */
export declare function checkDisguise(disguise: Disguise, observerPerception: number, situationalModifiers?: number): IntrigueCheckResult;
/**
 * Attempts to switch the active persona to an alias.
 * Requires the alias to be in the player's list.
 */
export declare function switchPersona(state: PlayerIdentityState, targetAliasId: string): PlayerIdentityState;
/**
 * Adds a new secret to the player's knowledge.
 * Handles duplicate checks.
 */
export declare function learnSecret(state: PlayerIdentityState, secret: Secret): PlayerIdentityState;
/**
 * Verifies a rumor, turning it into a confirmed secret and increasing its value.
 */
export declare function verifySecret(secret: Secret): Secret;
/**
 * Calculates the risk of a specific disguise vulnerability being triggered.
 * @param disguise The active disguise.
 * @param environmentTags Tags describing the current environment (e.g., 'raining', 'bright', 'elvish_court').
 */
export declare function checkDisguiseVulnerabilities(disguise: Disguise, environmentTags: string[]): string[];
