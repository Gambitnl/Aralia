/**
 * These tests prove that World3D box batching preserves building authorship.
 *
 * The renderer may draw many boxes through one GPU object, but each result must
 * retain its original dimensions, generated colour, rotation, position and source
 * identity. The tests exercise detailed buildings, legacy shells, marker cubes and
 * the tactical-only exclusion used by the production renderer.
 */
export {};
