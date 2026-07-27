/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/openingQuest.ts
 *
 * Turns the freshly-generated opening {@link OpeningSituation} into a real, logged
 * quest so the predicament has STAKES the player can act on — instead of being a
 * conversation that leads nowhere. The quest lands in the journal the moment the
 * scene resolves; its single objective closes once the player engages the people
 * the predicament is about (wired in the talk handler).
 *
 * Pure + deterministic given (situation, place); the runtime id is fixed
 * (`OPENING_QUEST_ID`) so the talk handler can find and advance it without
 * threading the situation around.
 */
import type { Quest } from '../../types';
import type { OpeningSituation } from './types';
/** Stable id so the talk handler can resolve + complete the opening quest. */
export declare const OPENING_QUEST_ID = "opening-situation";
/** The single objective id, completed when the player engages the strangers. */
export declare const OPENING_QUEST_OBJECTIVE_ID = "engage";
/**
 * Build the opening quest from a resolved situation. The objective is phrased so
 * that talking to those involved is a sensible way to complete it.
 */
export declare function buildOpeningQuest(situation: OpeningSituation, placeName?: string): Quest;
