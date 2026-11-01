/**
 * Shared types for waterfall rendering.
 * Extracted from riverWaterfallView.ts (agora-e9e1 split).
 */

import type { WaterfallContactSnapshot } from '@/systems/world3d/river/waterfallContactFlow';
import type { WaterfallLandingState } from '@/systems/world3d/river/riverFlowField';
import type { RiverFlowMap } from '@/systems/world3d/river/riverFlowField';
import type { RiverSourceStatus } from '@/systems/world3d/river/riverSourceHistory';
import type { RiverFloodPulseDescriptor } from '@/systems/world3d/river/riverFloodSurge';
import type { WaterfallDensityProfile } from '@/systems/world3d/river/waterfallDensityAtlas';
import type { FrozenWaterfallSource, FrozenWaterfallSolarState } from '@/systems/world3d/river/waterfallFrozenSource';
import type { RiverSurfaceMirror } from './riverSurfaceMirror';
import type { RiverWaterUniforms } from './riverWaterMaterial';

export type WaterfallNormalVector = readonly [number,number,number];
export type WaterfallSkyCell = { direction: [number, number, number]; mass: number; zenithMix: number };

export interface WaterfallInterfaceNormalResult {
  normal: WaterfallNormalVector;
  candidate: WaterfallNormalVector;
  confidence: number;
  fallback: boolean;
}

export interface WaterfallOpticalSegmentResult {
  transmission: number;
  scattered: number;
  absorbed: number;
  eventMean: number;
}

export interface WaterfallTwoStreamResult {
  reflection: number;
  transmission: number;
  absorption: number;
  collision: number;
  conditionalReflection: number;
  conditionalTransmission: number;
  conditionalAbsorption: number;
}

export interface WaterfallSkyIrradiance {
  frontHorizon: number;
  frontZenith: number;
  backHorizon: number;
  backZenith: number;
}

export interface WaterfallContactReceipt {
  mode: 'original' | 'stepped';
  requestedMode: 'original' | 'stepped';
  draining: boolean;
  authoritativeSnapshot: boolean;
  pool: any;
  rocksVisible: boolean;
  waterVisible: boolean;
}

export interface WaterfallFluidReceipt {
  emittedVolume: number;
  airborneVolume: number;
  landedVolume: number;
  budgetError: number;
  sourceTime: number;
  historyS: number;
  ready: boolean;
  reason: string;
  synthesisMs: number;
}

export interface WaterfallBillowReceipt {
  ready: boolean;
  reason: string;
  fieldTime: number;
  updateMs: number;
  uploadMs: number;
  expectedVolume: number;
  depositedVolume: number;
  residualVolume: number;
  maximumFraction: number;
  expandedLobes: number;
  lobes: number;
  eventCount: number;
  maximumNodePartitionError: number;
  eventPartitionResidual: number;
  eventCapacityExceeded: boolean;
  sourceBudgetVolume: number | null;
  quantizedVolume: number;
  quantizedVolumeError: number;
}

export interface WaterfallAeratedReceipt {
  updateMs: number;
  rows: number;
  ring: number;
  maximumLiquidFraction: number;
  secondaryLiquidVolume: number;
  sectionBudgetError: number;
}

export interface WaterfallMaterialSheetReceipt {
  mode: 'legacy' | 'coherent-sheet' | 'aerated-sheet' | 'billow-volume' | 'reconstructed-fluid';
  updateMs: number;
  rows: number;
  columns: number;
  meshVolume: number;
  emittedVolume: number;
  relativeVolumeError: number;
  maximumBandVolumeError: number;
  negativeBands: number;
  maxRowStepM: number;
  maxSectionAreaError: number;
  clippedVertices: number;
  drySectionAreaResidue: number;
  dryBandVolumeResidue: number;
  geometryMs: number;
  auditMs: number;
  invalidCoordinates: number;
  negativeCells: number;
  fallback: string;
  signedMeshVolume: number;
}

export interface WaterfallSecondaryReceipt {
  mode: 'none' | 'crosswise';
  rows: number;
  ring: number;
  maxRowStepM: number;
  updateMs: number;
  fallback: string;
}
