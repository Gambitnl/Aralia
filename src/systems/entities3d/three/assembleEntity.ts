/**
 * @file assembleEntity.ts — blueprint → live entity (body v2: segments).
 *
 * Scene graph:
 *   group                (caller positions/rotates this)
 *   ├─ bodyRoot          (lifted by the gait's verticalOffsetM)
 *   │  ├─ segmentBody    (one rigid mesh per skeleton segment + chain parts)
 *   │  ├─ parts          (one container per mesh part, re-anchored per frame)
 *   │  └─ eyeL / eyeR    (blobfolk-style eyes with blink)
 *   └─ blobShadow        (radial ground disc, fades with airtime)
 *
 * Render mode (toon.ts ENTITY_RENDER_MODE): 'solid' = toon-shaded segments
 * with inverse-hull ink outlines; 'wireframe' = clean edge lines
 * (EdgesGeometry) for body and parts alike. Eyes and the ground shadow stay
 * solid in both. The metaball field era is over: nothing polygonizes at
 * runtime — per frame is transform updates only.
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
import type { Anchor, EntityBlueprint, PartAnchors, PartPhase, Vec3Like } from '../types';
import { ANCHORS, headRadiusM, heightM } from '../types';
import { getPart } from '../registry';
import type { GaitDriver, LocomotionState, Pose } from './gaits';
import { createGaitDriver } from './gaits';
import { createSegmentBody, wireframeifyPart } from './segmentBody';
import {
  blobShadowMaterial,
  outlineMaterial,
  toonMaterial,
  ENTITY_RENDER_MODE,
  type EntityRenderMode,
} from './toon';

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
  /** Live anchor transforms (the gait driver's pose) — read-only debug view. */
  readonly pose: Pose;
  /** Debugger scrub: jump the gait cycle to `phase` (0–1). The next update
   * (even with dt = 0) re-poses the body at that phase. */
  setGaitPhase(phase: number): void;
  /** Debug snapshot for the harness stats readout. */
  stats(): { segments: number; triangles: number; renderMode: EntityRenderMode };
}

export interface AssembleOptions {
  /** @deprecated Body v2 has no field to scale — accepted and ignored. */
  resolutionScale?: number;
  /** @deprecated Body v2 has no field to throttle — accepted and ignored. */
  fieldUpdateHz?: number;
  /** Draw solid (toon) or wireframe. Default: the global ENTITY_RENDER_MODE. */
  renderMode?: EntityRenderMode;
}

const IDLE: LocomotionState = {
  position: new Vector3(),
  heading: new Vector3(0, 0, 1),
  speed: 0,
};

export function assembleEntity(blueprint: EntityBlueprint, options: AssembleOptions = {}): EntityHandle {
  const { frame, palette, gait } = blueprint;
  const hM = heightM(frame);
  const hr = headRadiusM(frame);
  const wide = gait === 'quad' || gait === 'hexapod';
  const renderMode = options.renderMode ?? ENTITY_RENDER_MODE;
  const wireframe = renderMode === 'wireframe';

  const group = new Group();
  group.name = `entity:${blueprint.label}`;
  const bodyRoot = new Group();
  bodyRoot.name = 'bodyRoot';
  group.add(bodyRoot);

  const outlineThickness = Math.max(hM * 0.011, 0.006);
  const body = createSegmentBody({
    renderMode,
    colorHex: palette.skinHex,
    outlineThickness,
  });
  bodyRoot.add(body.root);

  const driver: GaitDriver = createGaitDriver(gait, frame);

  // --- modular parts
  const partsRoot = new Group();
  partsRoot.name = 'parts';
  bodyRoot.add(partsRoot);
  const meshContainers: Array<{ container: Group; anchor: Anchor }> = [];
  const chainParts: Array<{
    partId: string;
    build: NonNullable<ReturnType<typeof getPart>['buildChain']>;
    params: Record<string, number | string>;
  }> = [];

  for (const instance of blueprint.parts) {
    const def = getPart(instance.partId);
    const params = instance.params ?? {};
    if (def.kind === 'chain') {
      chainParts.push({ partId: instance.partId, build: def.buildChain!, params });
      continue;
    }
    const { object } = def.buildMesh!({
      frame,
      palette,
      params,
      material: (hex) => toonMaterial(hex),
    });
    if (wireframe) {
      // clean edge lines for parts too — no fill, no material.wireframe soup
      wireframeifyPart(object);
    } else {
      // ink outlines for every mesh in the part
      object.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) {
          const shell = new Mesh(m.geometry, outlineMaterial('#20242c', outlineThickness));
          shell.name = 'partOutline';
          shell.position.copy(m.position);
          shell.quaternion.copy(m.quaternion);
          shell.scale.copy(m.scale);
          (m.parent ?? object).add(shell);
        }
      });
    }
    const container = new Group();
    container.name = `part:${instance.partId}`;
    container.add(object);
    partsRoot.add(container);
    meshContainers.push({ container, anchor: instance.anchor });
  }

  // --- eyes (the charm organ) — solid in both render modes
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

  // anchors exposed to chain parts as plain positions
  const anchorsView = Object.fromEntries(
    ANCHORS.map((a) => [a, driver.pose.anchors[a].pos as Vec3Like]),
  ) as PartAnchors;

  const phase: { -readonly [K in keyof PartPhase]: PartPhase[K] } = { t: 0, gaitPhase: 0, flap: 0 };
  const tmpQuat = new Quaternion();

  function update(t: number, dt: number, loco: LocomotionState = IDLE): void {
    driver.update(t, dt, loco);
    phase.t = t;
    phase.gaitPhase = driver.gaitPhase;
    phase.flap = driver.flap;
    bodyRoot.position.y = driver.verticalOffsetM;

    // skeleton + animated chain parts, transform-only after the first frame
    body.beginFrame();
    driver.buildBody(body.sink);
    for (const chain of chainParts) {
      for (const s of chain.build(frame, chain.params, phase, anchorsView)) {
        body.sink.seg(`${chain.partId}:${s.id}`, s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.r0, s.r1);
      }
    }
    body.finishFrame();

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
    body.dispose();
    group.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh || (o as unknown as { isLineSegments?: boolean }).isLineSegments) {
        (m.geometry as { dispose?: () => void })?.dispose?.();
        const mat = m.material as Material | Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else (mat as Material | undefined)?.dispose?.();
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

  function setGaitPhase(phaseValue: number): void {
    driver.setPhase(phaseValue);
  }

  function stats(): { segments: number; triangles: number; renderMode: EntityRenderMode } {
    return { segments: body.segmentCount(), triangles: body.triangles(), renderMode };
  }

  // settle into a valid first frame so the handle renders even if the caller
  // forgets to update before the first paint
  update(0, 1 / 60);

  return {
    group,
    blueprint,
    update,
    dispose,
    retain,
    release,
    get pose() {
      return driver.pose;
    },
    setGaitPhase,
    stats,
  };
}
