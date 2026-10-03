// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 01:17:13
 * Dependents: components/DesignPreview/steps/PreviewBuilding3D.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns one in-game hour into the Building Lab's complete light and
 * weather mood, then samples cheap smoke from real chimney boxes.
 *
 * The preview renderer calls these pure functions so dawn, noon, dusk, night,
 * and every point between them share one clock. Tests and screenshot tooling can
 * pass an explicit smoke time, while the live renderer may pass its elapsed frame
 * time. No saved building fact, generator draw, or camera decision changes here.
 */

// ============================================================================
// Public atmosphere facts
// ============================================================================
// These small render facts describe mood without depending on Three.js. Keeping
// them plain makes the full cycle deterministic and cheap to test.
// ============================================================================

export type AtmosphereMood = 'night' | 'dawn' | 'day' | 'golden-hour' | 'dusk';

export interface BuildingAtmosphere {
  /** Normalized 0-24 hour used for every value below. */
  hour: number;
  mood: AtmosphereMood;
  skyColor: string;
  hazeColor: string;
  groundColor: string;
  sunColor: string;
  sunIntensity: number;
  /** Multiplied by the visible building span in the renderer. */
  sunPositionScale: readonly [number, number, number];
  hemisphereIntensity: number;
  sideFillIntensity: number;
  overheadFillIntensity: number;
  roofEmissiveIntensity: number;
  contactShadowOpacity: number;
  /** Fog distances are multiplied by the visible building span. */
  hazeNearScale: number;
  hazeFarScale: number;
  /** A shallow, transparent ground sheet used only when this is above zero. */
  groundFogOpacity: number;
}

interface AtmosphereKeyframe extends Omit<BuildingAtmosphere, 'mood'> {
  mood: AtmosphereMood;
}

// ============================================================================
// Continuous hour keyframes
// ============================================================================
// Noon deliberately reproduces the earlier renderer's exact colors and light
// strengths. The surrounding keyframes ease continuously into warm low sun and
// cool night instead of switching between three broad time bands.
// ============================================================================

const ATMOSPHERE_KEYFRAMES: readonly AtmosphereKeyframe[] = [
  {
    hour: 0,
    mood: 'night',
    skyColor: '#141a26',
    hazeColor: '#29354c',
    groundColor: '#1d2419',
    sunColor: '#9fb4dd',
    sunIntensity: 0.6,
    sunPositionScale: [-0.72, 0.58, -0.8],
    hemisphereIntensity: 0.4,
    sideFillIntensity: 0.1,
    overheadFillIntensity: 0.15,
    roofEmissiveIntensity: 0.05,
    contactShadowOpacity: 0.36,
    hazeNearScale: 2.1,
    hazeFarScale: 5.2,
    groundFogOpacity: 0.025,
  },
  {
    hour: 5,
    mood: 'night',
    skyColor: '#252c42',
    hazeColor: '#4c5269',
    groundColor: '#252c22',
    sunColor: '#b6c7e2',
    sunIntensity: 0.5,
    sunPositionScale: [-1.45, 0.18, 0.12],
    hemisphereIntensity: 0.42,
    sideFillIntensity: 0.12,
    overheadFillIntensity: 0.2,
    roofEmissiveIntensity: 0.08,
    contactShadowOpacity: 0.38,
    hazeNearScale: 1.45,
    hazeFarScale: 4.1,
    groundFogOpacity: 0.075,
  },
  {
    hour: 6.5,
    mood: 'dawn',
    skyColor: '#8a6470',
    hazeColor: '#d4a27f',
    groundColor: '#35412e',
    sunColor: '#ffbd7b',
    sunIntensity: 0.82,
    sunPositionScale: [-1.35, 0.28, 0.28],
    hemisphereIntensity: 0.47,
    sideFillIntensity: 0.2,
    overheadFillIntensity: 0.38,
    roofEmissiveIntensity: 0.14,
    contactShadowOpacity: 0.47,
    hazeNearScale: 1.25,
    hazeFarScale: 3.8,
    groundFogOpacity: 0.12,
  },
  {
    hour: 8.5,
    mood: 'day',
    skyColor: '#91a8b9',
    hazeColor: '#bdc8c7',
    groundColor: '#45543a',
    sunColor: '#ffe0b2',
    sunIntensity: 1.35,
    sunPositionScale: [-0.55, 1.15, 0.62],
    hemisphereIntensity: 0.52,
    sideFillIntensity: 0.29,
    overheadFillIntensity: 0.7,
    roofEmissiveIntensity: 0.22,
    contactShadowOpacity: 0.59,
    hazeNearScale: 2.2,
    hazeFarScale: 5.8,
    groundFogOpacity: 0.02,
  },
  {
    hour: 12,
    mood: 'day',
    skyColor: '#8fa3b8',
    hazeColor: '#b9c5cd',
    groundColor: '#4c5a3c',
    sunColor: '#fff1da',
    sunIntensity: 1.8,
    sunPositionScale: [1.2, 1.8, 0.9],
    hemisphereIntensity: 0.55,
    sideFillIntensity: 0.35,
    overheadFillIntensity: 0.95,
    roofEmissiveIntensity: 0.28,
    contactShadowOpacity: 0.68,
    hazeNearScale: 2.8,
    hazeFarScale: 6.5,
    groundFogOpacity: 0,
  },
  {
    hour: 16,
    mood: 'day',
    skyColor: '#879aa9',
    hazeColor: '#c9b9a6',
    groundColor: '#48563a',
    sunColor: '#ffe0b2',
    sunIntensity: 1.42,
    sunPositionScale: [1.55, 0.95, 0.32],
    hemisphereIntensity: 0.52,
    sideFillIntensity: 0.3,
    overheadFillIntensity: 0.72,
    roofEmissiveIntensity: 0.23,
    contactShadowOpacity: 0.6,
    hazeNearScale: 2.1,
    hazeFarScale: 5.4,
    groundFogOpacity: 0.018,
  },
  {
    hour: 18,
    mood: 'golden-hour',
    skyColor: '#9b6670',
    hazeColor: '#d99869',
    groundColor: '#3b4732',
    sunColor: '#ffad63',
    sunIntensity: 1.08,
    sunPositionScale: [1.5, 0.24, -0.28],
    hemisphereIntensity: 0.48,
    sideFillIntensity: 0.22,
    overheadFillIntensity: 0.42,
    roofEmissiveIntensity: 0.16,
    contactShadowOpacity: 0.52,
    hazeNearScale: 1.3,
    hazeFarScale: 3.9,
    groundFogOpacity: 0.095,
  },
  {
    hour: 20,
    mood: 'dusk',
    skyColor: '#4d526b',
    hazeColor: '#77738a',
    groundColor: '#283024',
    sunColor: '#b8c8e3',
    sunIntensity: 0.66,
    sunPositionScale: [0.72, 0.42, -1.0],
    hemisphereIntensity: 0.43,
    sideFillIntensity: 0.14,
    overheadFillIntensity: 0.24,
    roofEmissiveIntensity: 0.09,
    contactShadowOpacity: 0.42,
    hazeNearScale: 1.55,
    hazeFarScale: 4.3,
    groundFogOpacity: 0.065,
  },
  {
    hour: 24,
    mood: 'night',
    skyColor: '#141a26',
    hazeColor: '#29354c',
    groundColor: '#1d2419',
    sunColor: '#9fb4dd',
    sunIntensity: 0.6,
    sunPositionScale: [-0.72, 0.58, -0.8],
    hemisphereIntensity: 0.4,
    sideFillIntensity: 0.1,
    overheadFillIntensity: 0.15,
    roofEmissiveIntensity: 0.05,
    contactShadowOpacity: 0.36,
    hazeNearScale: 2.1,
    hazeFarScale: 5.2,
    groundFogOpacity: 0.025,
  },
] as const;

/** Wrap arbitrary fractional clock values into one stable 24-hour day. */
export function normalizeAtmosphereHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12;
  return ((hour % 24) + 24) % 24;
}

/** Blend two generated palette colors without asking a renderer to guess. */
function mixHexColor(from: string, to: string, amount: number): string {
  const channels = (value: string): [number, number, number] => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const a = channels(from);
  const b = channels(to);
  const mixed = a.map((channel, index) =>
    Math.round(channel + (b[index] - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Blend one scalar render value between its neighbouring hour keyframes. */
const mixNumber = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

/**
 * Resolve every atmosphere control from one continuous clock value.
 * The mood label changes at the midpoint only for receipts; all visible values
 * still interpolate continuously.
 */
export function buildingAtmosphereAtHour(hour: number): BuildingAtmosphere {
  const normalized = normalizeAtmosphereHour(hour);
  const upperIndex = ATMOSPHERE_KEYFRAMES.findIndex((frame) => frame.hour >= normalized);
  const upper = ATMOSPHERE_KEYFRAMES[Math.max(1, upperIndex)];
  const lower = ATMOSPHERE_KEYFRAMES[Math.max(0, upperIndex - 1)];
  const amount = upper.hour === lower.hour
    ? 0
    : (normalized - lower.hour) / (upper.hour - lower.hour);
  const position = lower.sunPositionScale.map((value, index) =>
    mixNumber(value, upper.sunPositionScale[index], amount)) as [number, number, number];

  return {
    hour: normalized,
    mood: amount < 0.5 ? lower.mood : upper.mood,
    skyColor: mixHexColor(lower.skyColor, upper.skyColor, amount),
    hazeColor: mixHexColor(lower.hazeColor, upper.hazeColor, amount),
    groundColor: mixHexColor(lower.groundColor, upper.groundColor, amount),
    sunColor: mixHexColor(lower.sunColor, upper.sunColor, amount),
    sunIntensity: mixNumber(lower.sunIntensity, upper.sunIntensity, amount),
    sunPositionScale: position,
    hemisphereIntensity: mixNumber(lower.hemisphereIntensity, upper.hemisphereIntensity, amount),
    sideFillIntensity: mixNumber(lower.sideFillIntensity, upper.sideFillIntensity, amount),
    overheadFillIntensity: mixNumber(lower.overheadFillIntensity, upper.overheadFillIntensity, amount),
    roofEmissiveIntensity: mixNumber(lower.roofEmissiveIntensity, upper.roofEmissiveIntensity, amount),
    contactShadowOpacity: mixNumber(lower.contactShadowOpacity, upper.contactShadowOpacity, amount),
    hazeNearScale: mixNumber(lower.hazeNearScale, upper.hazeNearScale, amount),
    hazeFarScale: mixNumber(lower.hazeFarScale, upper.hazeFarScale, amount),
    groundFogOpacity: mixNumber(lower.groundFogOpacity, upper.groundFogOpacity, amount),
  };
}

// ============================================================================
// Bounded chimney smoke
// ============================================================================
// Smoke can move in the live canvas, but it remains a pure sample of explicit
// seconds. Only actual visible chimney boxes become sources, and the fixed caps
// prevent a large generated roof from growing an unbounded particle workload.
// ============================================================================

export const MAX_SMOKE_CHIMNEYS = 4;
export const SMOKE_PARTICLES_PER_CHIMNEY = 5;

export interface SmokeSourceBox {
  kind: string;
  x: number;
  y: number;
  z0: number;
  h: number;
}

export interface ChimneySmokeSource {
  x: number;
  y: number;
  topFt: number;
}

export interface ChimneySmokeParticle {
  chimneyIndex: number;
  particleIndex: number;
  x: number;
  y: number;
  zFt: number;
  scale: number;
  opacity: number;
}

/** Select the first bounded set of real visible chimney boxes in model order. */
export function chimneySmokeSources(
  boxes: readonly SmokeSourceBox[],
): ChimneySmokeSource[] {
  return boxes
    .filter((box) => box.kind === 'chimney')
    .slice(0, MAX_SMOKE_CHIMNEYS)
    .map((box) => ({ x: box.x, y: box.y, topFt: box.z0 + box.h }));
}

/** Positive fractional remainder for looping a particle without a clock reset. */
function fractional(value: number): number {
  return ((value % 1) + 1) % 1;
}

/**
 * Sample a wispy plume at an explicit time. Every puff rises, widens, fades,
 * and drifts in the same gentle wind; a chimney-position phase keeps multiple
 * flues from moving in lockstep without consuming any random stream.
 */
export function sampleChimneySmoke(
  sources: readonly ChimneySmokeSource[],
  seconds: number,
): ChimneySmokeParticle[] {
  const boundedSeconds = Number.isFinite(seconds) ? seconds : 0;
  const particles: ChimneySmokeParticle[] = [];

  sources.slice(0, MAX_SMOKE_CHIMNEYS).forEach((source, chimneyIndex) => {
    const sourcePhase = fractional(source.x * 0.031 + source.y * 0.047 + chimneyIndex * 0.173);
    for (let particleIndex = 0; particleIndex < SMOKE_PARTICLES_PER_CHIMNEY; particleIndex++) {
      const life = fractional(
        boundedSeconds * 0.105
        + particleIndex / SMOKE_PARTICLES_PER_CHIMNEY
        + sourcePhase,
      );
      const curl = Math.sin((life + sourcePhase) * Math.PI * 2) * (0.14 + life * 0.38);
      const drift = life * life * 2.1;
      particles.push({
        chimneyIndex,
        particleIndex,
        x: source.x + drift * 0.62 + curl,
        y: source.y + drift * 0.24 + Math.cos(life * Math.PI * 2) * 0.13,
        zFt: source.topFt + 0.3 + life * 5.8,
        scale: 0.34 + life * 0.82,
        opacity: 0.22 * (1 - life) * (0.78 + 0.22 * Math.sin(life * Math.PI)),
      });
    }
  });

  return particles;
}
