/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/NobleHouseGenerator.ts
 * Generates Noble Houses with members, relationships, and secrets.
 */
import { NobleHouse } from '../../types/noble';
export declare const generateNobleHouse: (_kingdomId?: string, seed?: number) => NobleHouse;
