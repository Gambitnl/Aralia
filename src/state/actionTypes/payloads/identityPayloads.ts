/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/actionTypes/payloads/identityPayloads.ts
 * Defines payload types for identity and intrigue actions.
 */

import { Disguise, Secret, IntrigueCheckResult } from '../../../types/identity';

export interface CreateAliasPayload {
    name: string;
    history: string;
    region: string;
}

export interface EquipDisguisePayload {
    disguise: Disguise;
}

export interface LearnSecretPayload {
    secret: Secret;
}

export interface VerifyDisguisePayload {
    result: IntrigueCheckResult;
    npcId: string;
}
