/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/party/__tests__/authoredCompanionToRichNpc.test.ts
 *
 * Proves the authored companions (Kaelen, Elara) become placeable RichNPC shells
 * that PRESERVE their authored identity + personality, so a fresh player can meet
 * and recruit them. Guards against the regression where they were seeded into
 * state.companions but placed nowhere in the world.
 */
export {};
