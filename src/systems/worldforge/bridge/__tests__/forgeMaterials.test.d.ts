/**
 * This file protects the semantic texture vocabulary shared by production and the Building Lab.
 *
 * It proves every resolved construction material has one stable key, older role-and-biome
 * requests keep their historical keys, and the lab's explicit evidence image is deterministic.
 * The renderer tests separately prove those model-level keys are shared across many meshes.
 *
 * Covers: forgeMaterials.ts
 * Depends on: Vitest only
 */
export {};
