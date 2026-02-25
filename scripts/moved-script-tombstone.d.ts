#!/usr/bin/env tsx
/**
 * This helper is the "tombstone" runner for moved scripts.
 *
 * Why this exists:
 * Agents and shell aliases often call scripts by hardcoded paths. When scripts are moved to a
 * better workflow folder, those old calls silently break unless we fail loudly and explain where
 * the script moved. This helper standardizes that behavior so every tombstone prints the same
 * guidance and exits with a non-zero code.
 *
 * How this connects:
 * Old script paths keep a tiny wrapper that imports this file and calls runMovedScriptTombstone.
 * New script paths live in scripts/workflows/... and contain the actual automation logic.
 */
export interface MovedScriptTombstoneOptions {
    oldPath: string;
    newPath: string;
    reason: string;
    followUp: string;
}
export declare function runMovedScriptTombstone(options: MovedScriptTombstoneOptions): never;
