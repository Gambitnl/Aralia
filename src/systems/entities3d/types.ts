/**
 * @file types.ts — contracts for the procedural 3D entity generator.
 *
 * Spec: docs/superpowers/specs/2026-07-11-entity-generator-3d-design.md
 * Plan: docs/superpowers/plans/2026-07-11-entity-generator-3d.md
 *
 * Three layers share these types:
 *   1. Blueprint (pure data, deterministic): recipe → EntityBlueprint.
 *   2. Part registry (modular components): PartDef per part, field or mesh.
 *   3. Assembler + gaits (three.js): blueprint → animated entity.
 *
 * Canon: every authored length is in FEET (worldforge SPEC decision #12);
 * only the assembler converts to meters via FT_TO_M.
 */

/** Feet → meters. The one conversion constant; renderers apply it, data never does. */
export const FT_TO_M = 0.3048;

/** Locomotion archetype. First five ported from the blobfolk prototype; `float` is a wingless hover. */
export type Gait = 'biped' | 'quad' | 'hexapod' | 'hopper' | 'flyer' | 'float';

/** Named attachment points the gait runtime positions every frame. */
export type Anchor =
  | 'head'
  | 'browL'
  | 'browR'
  | 'earL'
  | 'earR'
  | 'jaw'
  | 'crown'
  | 'chest'
  | 'back'
  | 'hips'
  | 'tailRoot'
  | 'handL'
  | 'handR'
  | 'hipL'
  | 'hipR';

/** All valid anchors, for registry validation. */
export const ANCHORS: readonly Anchor[] = [
  'head',
  'browL',
  'browR',
  'earL',
  'earR',
  'jaw',
  'crown',
  'chest',
  'back',
  'hips',
  'tailRoot',
  'handL',
  'handR',
  'hipL',
  'hipR',
];

/** Body proportions. ALL FEET. */
export interface Frame {
  /** Heel to crown for uprights; ground to back ridge for quads/hexapods. */
  heightFt: number;
  /** Radius multiplier: 0.6 gaunt … 1.6 massive. */
  bulk: number;
  /** Head size relative to frame height; 1 = human proportion. */
  headScale: number;
  /** Hip to heel. */
  limbLengthFt: number;
  /** Shoulder to fingertip (bipeds; ignored by legless gaits). */
  armLengthFt: number;
  shoulderWidthFt: number;
  stanceWidthFt: number;
}

export interface Palette {
  skinHex: string;
  /** Class/gear accent (primary clothing, weapon trim). */
  accentHex: string;
  /** Secondary accent (cloth lining, hat band). */
  secondaryHex: string;
  eyeHex: string;
}

/** One resolved modular component on an entity. */
export interface PartInstance {
  partId: string;
  anchor: Anchor;
  params?: Record<string, number | string>;
}

export type SizeCategory = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export type AgeBand = 'child' | 'adult' | 'elder';

export type EntityRecipe =
  | {
      kind: 'humanoid';
      raceId: string;
      classId: string;
      seed: string;
      /** Real equipped gear (from a PlayerCharacter) replaces the class kit when present. */
      gearOverride?: PartInstance[];
      /** Scales the frame: children come out small with bigger heads. Default adult. */
      ageBand?: AgeBand;
    }
  | {
      kind: 'creature';
      creatureType: string;
      size: SizeCategory;
      seed: string;
      /** Name-derived hints, lowercase: 'spider', 'wolf', 'skeleton'… */
      cues?: string[];
    };

/** Fully resolved, deterministic build description. Pure data — no three.js. */
export interface EntityBlueprint {
  gait: Gait;
  frame: Frame;
  palette: Palette;
  parts: PartInstance[];
  /** Human-readable: "Hill Dwarf Wizard", "Large Beast". */
  label: string;
}

/** Receives metaballs. The assembler adapts this onto its MarchingCubes field. */
export interface BallSink {
  /** x/y/z in meters, entity-local (y up, z forward); r = ball radius in meters. */
  ball(x: number, y: number, z: number, r: number): void;
}

/** Minimal position — THREE.Vector3 satisfies this, keeping the data layer three-free. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Current anchor positions in entity-local meters, produced by the gait driver each frame. */
export type PartAnchors = Readonly<Record<Anchor, Vec3Like>>;

/** Entity height in meters. */
export function heightM(frame: Frame): number {
  return frame.heightFt * FT_TO_M;
}

/** Head ball radius in meters — one formula shared by gaits and parts. */
export function headRadiusM(frame: Frame): number {
  return heightM(frame) * 0.11 * frame.headScale;
}

/** Derive full proportions from the three authored knobs.
 * `heightFt` means heel-to-crown for uprights, ground-to-back for quads/hexapods. */
export function deriveFrame(gait: Gait, heightFt: number, bulk: number, headScale: number): Frame {
  const upright = gait === 'biped' || gait === 'hopper' || gait === 'float' || gait === 'flyer';
  return {
    heightFt,
    bulk,
    headScale,
    limbLengthFt: upright ? heightFt * 0.48 : heightFt * 0.85,
    armLengthFt: gait === 'biped' ? heightFt * 0.42 : 0,
    shoulderWidthFt: heightFt * (upright ? 0.24 : 0.42) * bulk,
    stanceWidthFt: heightFt * (upright ? 0.14 : 0.38),
  };
}

/** Per-frame animation phase passed to field parts (tail wag, beard sway). */
export interface PartPhase {
  t: number;
  gaitPhase: number;
  /** Wing flap angle (radians-ish), 0 for non-flyers. */
  flap: number;
}

/** What a mesh part gets to build itself. Parts stay renderer-agnostic:
 * they create geometry but take materials from the injected factory
 * (the assembler injects toon materials; tests may inject basics). */
export interface PartMeshCtx {
  frame: Frame;
  palette: Palette;
  params: Record<string, number | string>;
  material(colorHex: string): import('three').Material;
}

/** One modular component definition.
 * `field` parts merge metaballs into the seamless body.
 * `mesh` parts are crisp attached objects, re-anchored every frame. */
export interface PartDef {
  id: string;
  /** Default anchor; a PartInstance may override. */
  anchor: Anchor;
  kind: 'field' | 'mesh';
  buildField?(
    sink: BallSink,
    frame: Frame,
    params: Record<string, number | string>,
    phase: PartPhase,
    anchors: PartAnchors,
  ): void;
  buildMesh?(ctx: PartMeshCtx): { object: import('three').Object3D };
}
