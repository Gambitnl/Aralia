/**
 * @file crowdBake.ts — crowd stand-ins: bake a generated entity into static
 * walk-cycle keyframe geometries so hundreds of street commuters render as
 * instanced meshes instead of live metaball fields.
 *
 * One archetype = one representative body per ancestry group, baked to
 * [idle, walkPhase0 … walkPhaseN-1] merged geometries with per-vertex colors
 * (body v2: the segment skeleton is posed, its meshes are snapshotted —
 * no field extraction)
 * (body = skin tone, gear/features = their part colors). A crowd renderer
 * buckets agents by (group, phase) and swaps instances between phase
 * geometries as their gait advances — the blobfolk look at instancing cost.
 *
 * Bake-time only: nothing here runs per frame.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EntityBlueprint, PartAnchors, PartPhase, Vec3Like } from '../types';
import { ANCHORS, headRadiusM, heightM } from '../types';
import { getPart } from '../registry';
import { createGaitDriver } from './gaits';
import type { LocomotionState } from './gaits';
import { createSegmentBody } from './segmentBody';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { recipeFromOccupant } from '../recipeFromOccupant';

export const CROWD_WALK_PHASES = 8;
const WALK_SPEED = 1.15;

export interface CrowdArchetype {
  /** [idle, walk phase 0 … walk phase N-1] — feet at y=0, meters. */
  geometries: BufferGeometry[];
  heightM: number;
}


/** Colorize a part mesh's geometry (world-transformed) for merging. */
function partMeshToGeometry(mesh: Mesh): BufferGeometry {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();
  geo.applyMatrix4(mesh.matrixWorld);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = (material as MeshBasicMaterial).color ?? new Color('#888888');
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  // merged output only needs position/normal/color
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') geo.deleteAttribute(name);
  }
  return geo;
}

/** Bake one pose (idle, or a specific walk phase in [0,1)). */
function bakePose(blueprint: EntityBlueprint, walkPhase: number | null): BufferGeometry {
  const { frame, palette, gait } = blueprint;

  const driver = createGaitDriver(gait, frame);
  const loco: LocomotionState = {
    position: new Vector3(),
    heading: new Vector3(0, 0, 1),
    speed: walkPhase === null ? 0 : WALK_SPEED,
  };
  if (walkPhase === null) {
    driver.update(0.35, 1 / 60, loco); // settle a neutral stance
  } else {
    // gaitPhase integrates cadence·dt from 0 — step until the target phase
    let t = 0;
    let guard = 0;
    while (driver.gaitPhase < 1 + walkPhase && guard < 4000) {
      driver.update(t, 1 / 120, loco);
      t += 1 / 120;
      guard += 1;
    }
  }

  // pose the segment skeleton (solid mode) and snapshot its meshes
  const body = createSegmentBody({ renderMode: 'solid', colorHex: palette.skinHex, outlineThickness: 0.001 });
  body.beginFrame();
  driver.buildBody(body.sink);
  const anchorsView = Object.fromEntries(
    ANCHORS.map((a) => [a, driver.pose.anchors[a].pos as Vec3Like]),
  ) as PartAnchors;
  const phase: PartPhase = { t: 0.35, gaitPhase: driver.gaitPhase, flap: driver.flap };
  const geometries: BufferGeometry[] = [];
  for (const instance of blueprint.parts) {
    const def = getPart(instance.partId);
    const params = instance.params ?? {};
    if (def.kind === 'chain') {
      for (const seg of def.buildChain!(frame, params, phase, anchorsView)) {
        body.sink.seg(instance.partId + ':' + seg.id, seg.ax, seg.ay, seg.az, seg.bx, seg.by, seg.bz, seg.r0, seg.r1);
      }
      continue;
    }
    const { object } = def.buildMesh!({
      frame,
      palette,
      params,
      material: (hex) => new MeshBasicMaterial({ color: hex }),
    });
    const container = new Group();
    const a = driver.pose.anchors[instance.anchor];
    container.position.copy(a.pos);
    container.quaternion.copy(a.quat as Quaternion);
    container.add(object);
    container.updateMatrixWorld(true);
    container.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) geometries.push(partMeshToGeometry(m));
    });
  }
  body.finishFrame();
  body.root.updateMatrixWorld(true);
  const bodyGeometries: BufferGeometry[] = [];
  body.root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.name !== 'segOutline' && m.visible !== false && m.parent?.visible !== false) {
      bodyGeometries.push(partMeshToGeometry(m));
    }
  });
  body.dispose();
  geometries.unshift(...bodyGeometries);

  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error(`entities3d: crowd bake produced no geometry for "${blueprint.label}"`);
  }
  // lift by the driver's airborne offset so hoppers/floaters bake believably
  if (driver.verticalOffsetM > 0) {
    merged.applyMatrix4(new Matrix4().makeTranslation(0, driver.verticalOffsetM, 0));
  }
  return merged;
}

/** Bake the full keyframe set for one blueprint. */
export function bakeCrowdArchetype(blueprint: EntityBlueprint): CrowdArchetype {
  const geometries: BufferGeometry[] = [bakePose(blueprint, null)];
  for (let p = 0; p < CROWD_WALK_PHASES; p++) {
    geometries.push(bakePose(blueprint, p / CROWD_WALK_PHASES));
  }
  return { geometries, heightM: heightM(blueprint.frame) };
}

/** Stable tiny hash for group → representative seed. */
function hashGroup(group: string): number {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = ((h << 5) - h + group.charCodeAt(i)) | 0;
  return Math.abs(h) % 100000;
}

const archetypeCache = new Map<string, CrowdArchetype>();

/** One representative baked body per ancestry group, cached for the session. */
export function crowdArchetypeForGroup(group: string): CrowdArchetype {
  const cached = archetypeCache.get(group);
  if (cached) return cached;
  const blueprint = generateEntityBlueprint(
    recipeFromOccupant({ id: hashGroup(group), ageBand: 'adult', race: group }),
  );
  const arch = bakeCrowdArchetype(blueprint);
  archetypeCache.set(group, arch);
  return arch;
}
