/**
 * This worker runs canonical atlas generation and pure SVG model construction
 * outside the browser interaction thread.
 *
 * It calls the same getBridgeAtlas and buildAtlasSvgModel functions used before
 * GG-41. No geography, politics, exact-cell data, labels, settlements, or user
 * preferences are reimplemented here. The main thread receives their existing
 * outputs through the shared protocol.
 */
export {};
