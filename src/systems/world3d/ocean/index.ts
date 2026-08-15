/**
 * @file index.ts — the open-ocean wave surface for maritime travel.
 *
 * A ship at sea needs a wave FIELD, not a particle solver. The volumetric
 * water in `src/systems/worldforge/terrain/` answers what a finite body of
 * water DOES when disturbed; this answers what an unbounded sea IS. Nothing
 * here imports from there.
 *
 * Method: JONSWAP with a TMA depth correction, three summed cascades (a ripple,
 * a local wind sea and a swell), cosine-2s directional spreading whose power
 * varies with frequency, and 8 real fields per cascade produced by inverse FFTs
 * on the GPU.
 * All of it published oceanography, implemented here from the literature.
 */
export * from './oceanConfig';
export * from './oceanUnits';
export * from './oceanSpectrum';
export * from './oceanFftReference';
export * from './oceanFieldReference';
export * from './oceanCapability';
export * from './oceanCompute';
export * from './oceanSurface';
export * from './oceanField';
