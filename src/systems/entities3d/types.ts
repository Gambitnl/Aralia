// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/07/2026, 22:30:18
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx, components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/DesignPreview/steps/EntityForgeScene.tsx, components/DesignPreview/steps/PreviewEntityDebug.tsx, components/DesignPreview/steps/PreviewEntityForge.tsx, components/World3D/PlayerAvatar.tsx, components/World3D/SceneCast.tsx, systems/entities3d/classKits.ts, systems/entities3d/creaturePlans.ts, systems/entities3d/creatureProfiles.ts, systems/entities3d/generateEntityBlueprint.ts, systems/entities3d/library/acceptedEntities.ts, systems/entities3d/parts/chainParts.ts, systems/entities3d/parts/gearArmor.ts, systems/entities3d/parts/gearWeapons.ts, systems/entities3d/parts/headParts.ts, systems/entities3d/parts/organicParts.ts, systems/entities3d/parts/wingParts.ts, systems/entities3d/raceMap.ts, systems/entities3d/recipeFromCharacter.ts, systems/entities3d/recipeFromCombatant.ts, systems/entities3d/recipeFromOccupant.ts, systems/entities3d/registry.ts, systems/entities3d/speciesProfiles.ts, systems/entities3d/textPlan/compilePlan.ts, systems/entities3d/textPlan/planSize.ts, systems/entities3d/three/Entity3D.tsx, systems/entities3d/three/assembleEntity.ts, systems/entities3d/three/crowdBake.ts, systems/entities3d/three/gaits.ts, systems/entities3d/three/segmentBody.ts, systems/entities3d/three/skeletonBuilder.ts, systems/entities3d/three/skinnedBody.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/** Locomotion archetype. First five ported from the blobfolk prototype; `float` is a
 * wingless hover; `plan` is driven by a compiled text-to-creature PlanSpec. */
export type Gait = 'biped' | 'quad' | 'hexapod' | 'hopper' | 'flyer' | 'float' | 'plan';

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
    }
  | {
      kind: 'planned';
      /** A validated text-to-creature body plan (see textPlan/planSchema). */
      plan: import('./textPlan/planSchema').CreaturePlan;
      seed: string;
    };

/** Compiled, driver-ready body plan (METERS — compilePlan converts from feet). */
export interface PlanSpec {
  stance: 'upright' | 'horizontal' | 'serpentine' | 'floating';
  /** Nose-to-tail body length (uprights: derived from height). */
  bodyLenM: number;
  /** Base body radius; chain link radii are fractions of this. */
  bodyRadM: number;
  spine: { segments: number; taper: number; arch: number; shape?: 'round' | 'box'; bulge?: number; mass?: [number, number, number] };
  /** Body translucency (ghosts, oozes); eyes stay solid. */
  opacity?: number;
  /** Creature-level junction softness (0–1) as authored; slice 2 (fused skin)
   * reads it — slice 1 collars only need the per-chain blendM. */
  skinBlend?: number;
  chains: Array<{
    /** Stable id: 'leg0L', 'tent2', 'neck1' … */
    id: string;
    kind: 'leg' | 'arm' | 'tail' | 'tentacle' | 'neck' | 'wing' | 'torso';
    /** Torso chain this one roots on (the tauric seam). */
    parentId?: string;
    /** -1 left / 1 right for mirrored pairs; 0 centered. */
    side: -1 | 0 | 1;
    /** 0 front – 1 rear along the spine; 0–1 height on the body. */
    attach: number;
    heightFrac: number;
    links: Array<{ lenM: number; rM: number }>;
    /** Junction collar reach in METERS at the chain root (0 = no collar).
     * Resolved by compilePlan from blend × min(root radius, hull radius) × 2. */
    blendM: number;
    /** Stride phase for legs (distributed); 0 for other kinds. */
    phaseOffset: number;
    /** 'hand' = stylized palm + fingers at the tip. */
    tips?: 'hand';
    /** Accent energy rings hovering at interior joints. */
    jointRings?: boolean;
  }>;
  heads: Array<{
    /** Neck chain this head rides; undefined = spine front. */
    chainId?: string;
    /** Sculpted head form; undefined = plain ball. */
    form?: 'serpent' | 'beast' | 'blunt' | 'skull';
    sizeScale: number;
    eyes: { count: number; sizeScale: number; pupil?: 'round' | 'slit' | 'goat' };
    snout?: { lengthScale: number; droop: number };
    /** Ring of fleshy lash segments around the eye. */
    cilia?: boolean;
  }>;
}

/** Fully resolved, deterministic build description. Pure data — no three.js. */
export interface EntityBlueprint {
  gait: Gait;
  frame: Frame;
  palette: Palette;
  parts: PartInstance[];
  /** Human-readable: "Hill Dwarf Wizard", "Large Beast". */
  label: string;
  /** Present when gait is 'plan' — the compiled text-to-creature body. */
  planSpec?: PlanSpec;
}

/** Receives metaballs. The assembler adapts this onto its MarchingCubes field.
 * @deprecated Body v2: dies with the field parts — use SegmentSink. */
export interface BallSink {
  /** x/y/z in meters, entity-local (y up, z forward); r = ball radius in meters. */
  ball(x: number, y: number, z: number, r: number): void;
}

/** One rigid body bone: a tapered segment between two joints (meters,
 * entity-local). Radii are FRAME-CONSTANT per id; only the endpoints move
 * frame to frame, so the renderer builds one mesh per id and re-transforms it. */
export interface BodySegment {
  id: string;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  r0: number;
  r1: number;
}

/** Receives the body skeleton each frame: tapered bone segments plus round
 * lumps (head, hands, feet). Ids are stable across frames. */
export interface SegmentSink {
  seg(id: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1: number): void;
  ball(id: string, x: number, y: number, z: number, r: number): void;
  /** Floating accent-colored energy ring at (x,y,z), facing along its normal
   * (nx,ny,nz). radius/tube are frame-constant per id, like segment radii.
   * Optional: only the full body renderer draws rings; bake/collector sinks
   * may omit it. */
  ring?(id: string, x: number, y: number, z: number, nx: number, ny: number, nz: number, radius: number, tube: number): void;
  /** Rectangular slab from a to b (its depth axis), w×h cross-section —
   * box-bodied creatures (cubes, chests, golems). Optional like ring(). */
  box?(id: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h: number): void;
  /** Continuous swept tube through control points (flat xyz triples) with a
   * radius profile (knots spread evenly along the curve) — smooth spines and
   * chains. Optional: sinks without it receive per-segment seg() fallbacks.
   * `bands` (round 18, creature-anatomy) asks the renderer for scale-ring
   * VALUE banding along the tube — `count` evenly spaced darkened rings at up
   * to `strength` (0..1) darkening, frame-constant per id. Renderers without
   * vertex tinting (crowd bake, collectors, skinned pose sink) ignore it. */
  tube?(id: string, points: number[], radii: number[], bands?: { count: number; strength: number }): void;
  /** Junction smoothing skirt at a chain root (junction blend, slice 1):
   * a flared ring bridging the limb wall into the hull wall. root = the
   * chain's root joint, (axX,axY,axZ) = unit vector down the root link,
   * limbR = root link radius, reach = compiled blendM. Frame-updated like
   * tube(); cosmetic only — never collision or anchor data. Sinks without
   * it (crowd bake, collectors) skip collars entirely. */
  collar?(id: string, rootX: number, rootY: number, rootZ: number,
          axX: number, axY: number, axZ: number,
          limbR: number, reach: number): void;
  /** Continuous dorsal fin (creature-anatomy round 10): ONE thin lofted
   * ribbon between a base polyline (rooted inside the body) and a top
   * polyline (the serrated crest edge) — flat xyz triples, equal counts.
   * widths = base thickness in meters per station, FRAME-CONSTANT per id
   * like all sink radii; base/top follow the live spine every frame.
   * Optional like tube(): sinks without it (crowd bake, collectors,
   * wireframe) receive the driver's per-blade segment fallback. */
  fin?(id: string, base: number[], top: number[], widths: number[]): void;
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

/** One modular component definition (body v2).
 * `mesh` parts are rigid objects re-anchored every frame (horns, gear, hats).
 * `chain` parts are animated tapered segment chains rendered by the same
 * segment renderer as the body (tails, tentacles, antennae) — they wag. */
export interface PartDef {
  id: string;
  /** Default anchor; a PartInstance may override. */
  anchor: Anchor;
  kind: 'mesh' | 'chain';
  buildMesh?(ctx: PartMeshCtx): { object: import('three').Object3D };
  /** Per-frame segment chain. Ids must be stable and radii frame-constant. */
  buildChain?(
    frame: Frame,
    params: Record<string, number | string>,
    phase: PartPhase,
    anchors: PartAnchors,
  ): BodySegment[];
}
