/**
 * @file assembleEntity.ts — blueprint → live entity.
 *
 * Scene graph:
 *   group                (caller positions/rotates this)
 *   ├─ bodyRoot          (lifted by the gait's verticalOffsetM)
 *   │  ├─ metaballBody   (MarchingCubes field: gait body + field parts)
 *   │  ├─ metaballOutline(inverse hull sharing the field geometry)
 *   │  ├─ parts          (one container per mesh part, re-anchored per frame)
 *   │  └─ eyeL / eyeR    (blobfolk-style eyes with blink)
 *   └─ blobShadow        (radial ground disc, fades with airtime)
 *
 * Framework-agnostic: no React. Entity3D.tsx wraps this for R3F scenes.
 */
import {
  CircleGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import type { Anchor, BallSink, EntityBlueprint, PartAnchors, PartPhase, Vec3Like } from '../types';
import { ANCHORS, headRadiusM, heightM } from '../types';
import { getPart } from '../registry';
import type { GaitDriver, LocomotionState } from './gaits';
import { createGaitDriver } from './gaits';
import { blobShadowMaterial, outlineMaterial, toonMaterial } from './toon';

export const SUBTRACT = 12;
export const ISO = 80;

export interface EntityHandle {
  readonly group: Group;
  readonly blueprint: EntityBlueprint;
  /** Advance animation. Omit `loco` for a standing idle. */
  update(t: number, dt: number, loco?: LocomotionState): void;
  dispose(): void;
  /** React-lifecycle-safe ownership: retain in an effect, release in its
   * cleanup. Release defers the real dispose one microtask so StrictMode's
   * mount → cleanup → remount cycle never guts a handle that is still in use. */
  retain(): void;
  release(): void;
}

export interface AssembleOptions {
  /** Scale on the marching-cubes resolution tiers (0.7 = ~1/3 the cells).
   * Tactical views can afford chunkier fields. */
  resolutionScale?: number;
  /** Max metaball-field rebuilds per second. Anchor-attached gear, overlays,
   * and eyes still track every frame; only the body re-polygonizes at this
   * rate. Default: every frame. */
  fieldUpdateHz?: number;
}

const IDLE: LocomotionState = {
  position: new Vector3(),
  heading: new Vector3(0, 0, 1),
  speed: 0,
};

export class FieldSink implements BallSink {
  constructor(
    private readonly mc: MarchingCubes,
    private readonly scale: number,
    private readonly centerY: number,
  ) {}

  ball(x: number, y: number, z: number, r: number): void {
    const s2 = 2 * this.scale;
    // Floor tiny balls at ~2 field cells so limbs on huge frames stay
    // connected instead of aliasing into floating fragments.
    const rr = Math.max(r, this.scale * 0.045);
    const strength = (SUBTRACT + ISO) * (rr / s2) * (rr / s2);
    this.mc.addBall(x / s2 + 0.5, (y - this.centerY) / s2 + 0.5, z / s2 + 0.5, strength, SUBTRACT);
  }
}

export function assembleEntity(blueprint: EntityBlueprint, options: AssembleOptions = {}): EntityHandle {
  const { frame, palette, gait } = blueprint;
  const hM = heightM(frame);
  const hr = headRadiusM(frame);
  const wide = gait === 'quad' || gait === 'hexapod';
  // The field cube spans ±fieldScale meters around its center; leave headroom
  // for hats, tails, and wings.
  const fieldScale = hM * (wide ? 1.15 : 0.95) + hr * 2;
  const centerY = hM * 0.5;
  const resolutionScale = options.resolutionScale ?? 1;
  const fieldInterval = options.fieldUpdateHz ? 1 / options.fieldUpdateHz : 0;

  const group = new Group();
  group.name = `entity:${blueprint.label}`;
  const bodyRoot = new Group();
  bodyRoot.name = 'bodyRoot';
  group.add(bodyRoot);

  const bodyMaterial = toonMaterial(palette.skinHex);
  // Bigger fields need more cells or limbs alias apart; tiers keep humans cheap.
  const baseResolution = fieldScale <= 2.4 ? 48 : fieldScale <= 3.4 ? 64 : 80;
  const resolution = Math.max(28, Math.round(baseResolution * resolutionScale));
  // Geometry budget scales with the field: a body surface fills a small share
  // of the cells, and a fixed huge budget would cost megabytes per entity.
  // Floor high enough that a full biped + parts never truncates (a truncated
  // field renders as a torn spiky mass).
  const maxPolys = Math.min(120000, Math.max(30000, Math.round(resolution ** 3 * 0.4)));
  const mc = new MarchingCubes(resolution, bodyMaterial, false, false, maxPolys);
  mc.name = 'metaballBody';
  mc.isolation = ISO;
  mc.scale.setScalar(fieldScale);
  mc.position.y = centerY;
  mc.frustumCulled = false;
  bodyRoot.add(mc);

  const outline = new Mesh(mc.geometry, outlineMaterial(palette.skinHex, 0.026 / fieldScale));
  outline.name = 'metaballOutline';
  outline.scale.setScalar(fieldScale);
  outline.position.y = centerY;
  outline.frustumCulled = false;
  bodyRoot.add(outline);

  const driver: GaitDriver = createGaitDriver(gait, frame);
  const sink = new FieldSink(mc, fieldScale, centerY);

  // --- modular parts
  const partsRoot = new Group();
  partsRoot.name = 'parts';
  bodyRoot.add(partsRoot);
  const meshContainers: Array<{ container: Group; anchor: Anchor }> = [];
  const fieldParts: Array<{
    build: NonNullable<ReturnType<typeof getPart>['buildField']>;
    params: Record<string, number | string>;
  }> = [];
  const outlineThickness = Math.max(hM * 0.011, 0.006);

  for (const instance of blueprint.parts) {
    const def = getPart(instance.partId);
    const params = instance.params ?? {};
    if (def.kind === 'field') {
      fieldParts.push({ build: def.buildField!, params });
      continue;
    }
    const { object } = def.buildMesh!({
      frame,
      palette,
      params,
      material: (hex) => toonMaterial(hex),
    });
    // ink outlines for every mesh in the part
    const outlines: Mesh[] = [];
    object.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        const shell = new Mesh(m.geometry, outlineMaterial('#20242c', outlineThickness));
        shell.name = 'partOutline';
        outlines.push(shell);
        shell.position.copy(m.position);
        shell.quaternion.copy(m.quaternion);
        shell.scale.copy(m.scale);
        (m.parent ?? object).add(shell);
      }
    });
    void outlines;
    const container = new Group();
    container.name = `part:${instance.partId}`;
    container.add(object);
    partsRoot.add(container);
    meshContainers.push({ container, anchor: instance.anchor });
  }

  // --- eyes (the charm organ)
  const eyeMaterial = new MeshBasicMaterial({ color: '#ffffff' });
  const pupilMaterial = new MeshBasicMaterial({ color: palette.eyeHex });
  const eyes: Mesh[] = [];
  for (const name of ['eyeL', 'eyeR'] as const) {
    const eye = new Mesh(new SphereGeometry(hr * 0.32, 12, 10), eyeMaterial);
    eye.name = name;
    const pupil = new Mesh(new SphereGeometry(hr * 0.17, 10, 8), pupilMaterial);
    pupil.position.z = hr * 0.24;
    eye.add(pupil);
    bodyRoot.add(eye);
    eyes.push(eye);
  }
  let blinkT = 2 + (blueprint.frame.heightFt % 1) * 3; // deterministic per frame

  // --- ground shadow
  const shadowMaterial = blobShadowMaterial();
  const shadow = new Mesh(new CircleGeometry(1, 24), shadowMaterial);
  shadow.name = 'blobShadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  const shadowBase = wide ? hM * 0.9 : hM * 0.42;
  group.add(shadow);

  // anchors exposed to field parts as plain positions
  const anchorsView = Object.fromEntries(
    ANCHORS.map((a) => [a, driver.pose.anchors[a].pos as Vec3Like]),
  ) as PartAnchors;

  const phase: { -readonly [K in keyof PartPhase]: PartPhase[K] } = { t: 0, gaitPhase: 0, flap: 0 };
  const tmpQuat = new Quaternion();

  let lastFieldT = -Infinity;

  function update(t: number, dt: number, loco: LocomotionState = IDLE): void {
    driver.update(t, dt, loco);
    phase.t = t;
    phase.gaitPhase = driver.gaitPhase;
    phase.flap = driver.flap;
    bodyRoot.position.y = driver.verticalOffsetM;

    // The body field is the expensive part; throttled callers rebuild it at
    // fieldUpdateHz while everything anchor-driven stays per-frame smooth.
    if (t - lastFieldT >= fieldInterval || lastFieldT === -Infinity) {
      lastFieldT = t;
      mc.reset();
      driver.buildBody(sink);
      for (const fp of fieldParts) {
        fp.build(sink, frame, fp.params, phase, anchorsView);
      }
      mc.update();
    }

    for (const { container, anchor } of meshContainers) {
      const a = driver.pose.anchors[anchor];
      container.position.copy(a.pos);
      container.quaternion.copy(a.quat);
      const wingL = container.getObjectByName('wingL');
      const wingR = container.getObjectByName('wingR');
      if (wingL && wingR) {
        wingL.rotation.z = driver.flap;
        wingR.rotation.z = -driver.flap;
      }
    }

    // eyes track the head anchor
    const head = driver.pose.anchors.head.pos;
    for (const [i, eye] of eyes.entries()) {
      const sgn = i === 0 ? -1 : 1;
      eye.position.set(head.x + sgn * hr * 0.42, head.y + hr * 0.12, head.z + hr * 0.8);
      eye.quaternion.copy(tmpQuat.identity());
    }
    blinkT -= dt;
    let eyeScaleY = 1;
    if (blinkT < 0.12) eyeScaleY = Math.max(0.08, Math.abs(blinkT / 0.06 - 1));
    if (blinkT <= 0) blinkT = 1.8 + ((t * 997) % 3.2);
    for (const eye of eyes) eye.scale.y = eyeScaleY;

    // shadow shrinks and fades with airtime
    const air = driver.verticalOffsetM;
    const k = Math.max(0.25, 1 - air * 0.35);
    shadow.scale.setScalar(shadowBase * k);
    shadowMaterial.uniforms.uOpacity.value = 0.4 * k;
  }

  let disposed = false;
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    group.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as Material | Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    group.clear();
  }

  let refs = 0;
  function retain(): void {
    refs += 1;
  }
  function release(): void {
    refs -= 1;
    queueMicrotask(() => {
      if (refs <= 0) dispose();
    });
  }

  // settle into a valid first frame so the handle renders even if the caller
  // forgets to update before the first paint
  update(0, 1 / 60);

  return { group, blueprint, update, dispose, retain, release };
}
