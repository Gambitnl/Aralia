/**
 * @file src/config/npcBehaviorConfig.ts
 * Centralizes configuration variables for NPC behavior, memory, and gossip systems.
 */

// Gossip System Tuning
export const MAX_GOSSIP_EXCHANGES_PER_LOCATION = 3;
export const MAX_TOTAL_GOSSIP_EXCHANGES = 20;
export const MAX_CROSS_LOCATION_EXCHANGES = 5;

// NPC Memory Tuning
export const MAX_FACTS_PER_NPC = 25;
export const DRIFT_THRESHOLD_DAYS = 3;