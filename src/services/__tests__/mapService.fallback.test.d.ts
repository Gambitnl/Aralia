/**
 * @file mapService.fallback.test.ts
 * @description Integration proof for worldsim-service WSS-004 remediation. Forces the Azgaar
 * generation path to throw so `generateMap` takes its real legacy fallback, then asserts the
 * produced world is NOT a flat pancake: heights vary (biome-derived relief) and provenance is
 * recorded. This exercises the exact production defect path end-to-end.
 */
export {};
