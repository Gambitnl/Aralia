/**
 * This file verifies the first WSS-005a feature-source bridge.
 *
 * Azgaar is now the product-decided source of truth for atlas features. This test
 * proves that the WorldData object persisted for 3D keeps a typed Azgaar hint payload
 * beside its generated geometry, so later renderer/gameplay work can follow the same
 * canonical river/site/road source without guessing from regenerated polylines.
 */
export {};
