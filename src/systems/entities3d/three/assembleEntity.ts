// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/07/2026, 12:44:28
 * Dependents: components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx, systems/entities3d/three/Entity3D.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  Color,
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
import { createSkinnedBiped, createSkinnedPlan } from './skinnedBody';
import { createSkinnedClipPlayer, type SkinnedClipPlayer } from './skinnedClipPlayer';
import type { AnimationClip } from 'three';
import { buildHeadForm } from './headForms';
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

/** How the body is constructed (skeleton pivot slice 1).
 * 'segments' — body v2: one rigid mesh per skeleton segment (the default;
 * unchanged behavior). 'skinned' — a THREE.Bone hierarchy driving one
 * rigid-weight SkinnedMesh + one ink-shell SkinnedMesh (biped, solid only for
 * now; the segment renderer still draws chain parts like tails). */
export type BodyTech = 'segments' | 'skinned';

export interface AssembleOptions {
  /** @deprecated Body v2 has no field to scale — accepted and ignored. */
  resolutionScale?: number;
  /** @deprecated Body v2 has no field to throttle — accepted and ignored. */
  fieldUpdateHz?: number;
  /** Draw solid (toon) or wireframe. Default: the global ENTITY_RENDER_MODE. */
  renderMode?: EntityRenderMode;
  /** Body construction technique. Default 'segments' — opting in is the only
   * way to get the slice-1 skinned body; nothing else changes. */
  bodyTech?: BodyTech;
  /** Skinned-body weight style (slice 3). 'rigid' reproduces the segment
   * look exactly; 'smooth' lofts one-piece chain tubes with joint-blended
   * weights (creased elbows/knees). Default 'rigid' until the eyeball gate. */
  skinnedWeights?: 'rigid' | 'smooth';
  /** Animation source (CC0 clip slice 1). 'procedural' (default) = the gait
   * driver poses the bones. 'clip' = a retargeted mocap clip drives them via
   * an AnimationMixer; requires bodyTech 'skinned' and a loaded clip pack. */
  animSource?: 'procedural' | 'clip';
  /** Retargeted clip pack (from loadHumanoidClips) — required when
   * animSource is 'clip'. */
  clips?: Map<string, AnimationClip>;
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
  const bodyTech = options.bodyTech ?? 'segments';
  // Scope guards — fail honestly instead of falling back:
  // creature/plan skeletons are slice 4 — biped and plan gaits are skinned;
  // species gaits (quad/hexapod/hopper/flyer/float) skeletons are NOT this
  // slice. Wireframe on a deforming body is DECIDED (Remy 2026-07-21):
  // skinned bodies render solid shaded, period — wireframe stays a segment-body
  // debug look and never comes to the skeleton path, so requesting it is a
  // caller bug, not a parked feature.
  if (bodyTech === 'skinned' && gait !== 'biped' && gait !== 'plan') {
    throw new Error(`bodyTech 'skinned' supports only the biped and plan gaits in slice 4 (got '${gait}')`);
  }
  if (bodyTech === 'skinned' && wireframe) {
    throw new Error("bodyTech 'skinned' renders solid shaded only (decided 2026-07-21) — wireframe is a segment-body debug look");
  }
  const animSource = options.animSource ?? 'procedural';
  if (animSource === 'clip' && bodyTech !== 'skinned') {
    throw new Error("animSource 'clip' needs bodyTech 'skinned' — a clip drives bones, and only the skinned body has them");
  }
  if (animSource === 'clip' && !options.clips) {
    throw new Error("animSource 'clip' needs a loaded clip pack (options.clips) — load it with loadHumanoidClips first");
  }

  const group = new Group();
  group.name = `entity:${blueprint.label}`;
  const bodyRoot = new Group();
  bodyRoot.name = 'bodyRoot';
  group.add(bodyRoot);

  const outlineThickness = Math.max(hM * 0.011, 0.006);
  // The segment renderer stays even in skinned mode: chain parts (tails,
  // beards) are procedural wagging chains outside the skeleton until slice 4.
  // In skinned mode the DRIVER's emissions bypass it (they feed the bones),
  // so it only ever draws chain-part segments there.
  const body = createSegmentBody({
    renderMode,
    colorHex: palette.skinHex,
    // Plan-driven bodies (compiled CreaturePlans) carry their belly tone in
    // secondaryHex — the tube renderer countershades with it. Segment gaits
    // emit no tubes, so their secondaryHex (cloak lining etc.) stays unused.
    bellyHex: blueprint.planSpec ? palette.secondaryHex : undefined,
    accentHex: palette.accentHex,
    outlineThickness,
    opacity: blueprint.planSpec?.opacity,
  });
  bodyRoot.add(body.root);

  const skinnedBody =
    bodyTech === 'skinned'
      ? blueprint.planSpec
        ? // Slice 4: plan creatures get a real bone hierarchy + rigid-weight
          // skinned body. Decorative emissions (snouts, cilia, toes, fingers,
          // rings, collars) stay on the anchor path — forwarded to the segment
          // renderer so nothing that renders today is dropped in skinned mode.
          createSkinnedPlan(frame, blueprint.planSpec, {
            colorHex: palette.skinHex,
            outlineThickness,
            opacity: blueprint.planSpec?.opacity,
            weights: options.skinnedWeights,
            decorativeDelegate: body.sink,
          })
        : createSkinnedBiped(frame, {
            colorHex: palette.skinHex,
            outlineThickness,
            opacity: blueprint.planSpec?.opacity,
            weights: options.skinnedWeights,
          })
      : null;
  if (skinnedBody) bodyRoot.add(skinnedBody.root);

  // CC0 clip playback: a mixer poses the skinned bones instead of the driver.
  // The bones live under skinnedBody.root, so the mixer resolves them by name.
  const clipPlayer: SkinnedClipPlayer | null =
    animSource === 'clip' && skinnedBody && options.clips
      ? createSkinnedClipPlayer(skinnedBody.root, options.clips)
      : null;
  // slice 1: auto-select Walk vs Idle by speed. The full action table is slice 2.
  const idleClip = clipPlayer?.clipNames().includes('Idle_A') ? 'Idle_A' : 'Idle';
  let clipMode: 'idle' | 'walk' | null = clipPlayer ? 'idle' : null;
  if (clipPlayer) clipPlayer.play(idleClip);

  // Wing mesh parts (wingsFeathered/wingsMembrane) are garnish the driver
  // cannot see — plan-driven bodies (the Emberwing dragon) need the hint or
  // their wings freeze; biped/quad drivers beat unconditionally (harmless).
  const winged = blueprint.parts.some((p) => p.partId.startsWith('wings'));
  const driver: GaitDriver = createGaitDriver(gait, frame, blueprint.planSpec, { winged });

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

  // --- sculpted head forms (planned bodies) — posed at live sockets per frame
  const formHeads: Array<{ group: Group; head: number }> = [];
  if (blueprint.planSpec && !wireframe) {
    const toothMaterial = toonMaterial('#e8e2d4');
    blueprint.planSpec.heads.forEach((headSpec, h) => {
      if (!headSpec.form) return;
      const formGroup = buildHeadForm(headSpec.form, toonMaterial(palette.skinHex), toothMaterial);
      formGroup.name = `head${h}:form`;
      bodyRoot.add(formGroup);
      formHeads.push({ group: formGroup, head: h });
    });
  }

  // --- eyes (the charm organ) — solid in both render modes
  // Warm off-white reads softer than pure #ffffff against toon skin; radius
  // factors tuned down twice 2026-07-27 (0.32hr whites read "googly" on beast
  // heads; still lemur-eyed at 0.27, so 0.24 planned / 0.25 legacy).
  const eyeMaterial = new MeshBasicMaterial({ color: '#f4f1e6' });
  // Contrast guard: a gold pupil on gold skin (forge-7 dragon) is invisible.
  // When iris and skin luminance are too close, fall back to a dark pupil.
  const lum = (hex: string) => {
    const c = new Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };
  const pupilHex = Math.abs(lum(palette.eyeHex) - lum(palette.skinHex)) < 0.12 ? '#1c1c22' : palette.eyeHex;
  const pupilMaterial = new MeshBasicMaterial({ color: pupilHex });
  const eyes: Mesh[] = [];
  /** Planned bodies: eye i belongs to head socket plannedEyeHead[i], slot plannedEyeSlot[i]. */
  const plannedEyeHead: number[] = [];
  const plannedEyeSlot: number[] = [];
  if (blueprint.planSpec) {
    blueprint.planSpec.heads.forEach((headSpec, h) => {
      const r = hr * headSpec.sizeScale * 0.24 * headSpec.eyes.sizeScale;
      for (let k = 0; k < headSpec.eyes.count; k++) {
        const eye = new Mesh(new SphereGeometry(Math.max(0.008, r), 12, 10), eyeMaterial);
        eye.name = `eyeP${h}_${k}`;
        const pupil = new Mesh(new SphereGeometry(Math.max(0.005, r * 0.58), 10, 8), pupilMaterial);
        pupil.position.z = r * 0.72;
        // pupil character: slit (reptile) is tall-thin, goat is wide-flat
        const pupilShape = headSpec.eyes.pupil ?? 'round';
        if (pupilShape === 'slit') pupil.scale.set(0.38, 1.55, 0.8);
        else if (pupilShape === 'goat') pupil.scale.set(1.55, 0.42, 0.8);
        eye.add(pupil);
        bodyRoot.add(eye);
        eyes.push(eye);
        plannedEyeHead.push(h);
        plannedEyeSlot.push(k);
      }
    });
  } else {
    for (const name of ['eyeL', 'eyeR'] as const) {
      const eye = new Mesh(new SphereGeometry(hr * 0.25, 12, 10), eyeMaterial);
      eye.name = name;
      const pupil = new Mesh(new SphereGeometry(hr * 0.16, 10, 8), pupilMaterial);
      pupil.position.z = hr * 0.24;
      eye.add(pupil);
      bodyRoot.add(eye);
      eyes.push(eye);
    }
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
  const tmpVecA = new Vector3();
  const FORWARD = new Vector3(0, 0, 1);

  function update(t: number, dt: number, loco: LocomotionState = IDLE): void {
    driver.update(t, dt, loco);
    phase.t = t;
    phase.gaitPhase = driver.gaitPhase;
    phase.flap = driver.flap;
    bodyRoot.position.y = driver.verticalOffsetM;

    // skeleton + animated chain parts, transform-only after the first frame.
    // Skinned mode: the driver's emissions drive the bones (pose adapter);
    // chain parts still render through the segment renderer either way.
    body.beginFrame();
    if (clipPlayer && skinnedBody) {
      // clip mode: the mixer owns the bones; the driver still ran (above) for
      // facing + group movement, but must NOT also pose the skeleton.
      const walking = loco.speed > 0.1;
      const want = walking ? 'walk' : 'idle';
      if (want !== clipMode) {
        clipPlayer.play(walking ? 'Walk' : idleClip, { fadeSec: 0.2 });
        clipMode = want;
      }
      if (walking) clipPlayer.setSpeed(loco.speed);
      clipPlayer.update(dt);
    } else if (skinnedBody) {
      driver.buildBody(skinnedBody.sink);
      skinnedBody.finishFrame();
    } else {
      driver.buildBody(body.sink);
    }
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
        // rest fold (2026-07-27): idle wings sweep DOWN against the body and
        // trail backward instead of standing as vertical sails; the beat
        // calms to a breath while folded and opens with speed.
        // Sign convention (from the original beat): +z-rotation on wingL and
        // -z on wingR BOTH lower the tips symmetrically; ±y sweeps tips back.
        const fold = driver.wingFold;
        const beat = driver.flap * (1 - fold * 0.55);
        // 2026-07-28: less straight-down drape (1.05 -> 0.88), much stronger
        // backward sweep (0.55 -> 1.05) — folded membranes lie along the
        // rear flank like a bird's parked wing instead of curtaining the legs
        const dihedral = beat + fold * 1.32;
        wingL.rotation.z = dihedral;
        wingR.rotation.z = -dihedral;
        wingL.rotation.y = -fold * 0.5;
        wingR.rotation.y = fold * 0.5;
        // pleat (2026-07-28, ref mz-final-2): real folded wings collapse their
        // span; rigid rotation can't, so compress the span axis as the fold
        // deepens — the membrane pleats into a strip lying on the flank
        // instead of hanging off it as a full-size slab. fold=0 -> 1.0.
        const pleat = 1 - fold * 0.5;
        wingL.scale.x = pleat;
        wingR.scale.x = pleat;
      }
    }

    // eyes track their head — planned bodies read live sockets, others the anchor
    if (blueprint.planSpec && driver.headSockets) {
      const sockets = driver.headSockets();
      // sculpted head forms ride their sockets
      for (const fh of formHeads) {
        const socket = sockets[fh.head];
        if (!socket) continue;
        fh.group.position.set(socket.x, socket.y, socket.z);
        tmpVecA.set(socket.fx, socket.fy, socket.fz);
        fh.group.quaternion.setFromUnitVectors(FORWARD, tmpVecA);
        fh.group.scale.setScalar(socket.r);
      }
      for (const [i, eye] of eyes.entries()) {
        const socket = sockets[plannedEyeHead[i]];
        if (!socket) continue;
        const K = socket.eyes.count;
        const spread = K === 1 ? 0 : plannedEyeSlot[i] / (K - 1) - 0.5;
        // face frame: forward f, right = f × up (horizontal)
        const rx = -socket.fz;
        const rz = socket.fx;
        eye.position.set(
          socket.x + socket.fx * socket.r * 0.72 + rx * spread * socket.r * 0.95,
          socket.y + socket.r * 0.16,
          socket.z + socket.fz * socket.r * 0.72 + rz * spread * socket.r * 0.95,
        );
        tmpVecA.set(socket.fx, socket.fy, socket.fz);
        eye.quaternion.setFromUnitVectors(FORWARD, tmpVecA);
      }
    } else {
      const head = driver.pose.anchors.head.pos;
      for (const [i, eye] of eyes.entries()) {
        const sgn = i === 0 ? -1 : 1;
        eye.position.set(head.x + sgn * hr * 0.42, head.y + hr * 0.12, head.z + hr * 0.8);
        eye.quaternion.copy(tmpQuat.identity());
      }
    }
    blinkT -= dt;
    let eyeScaleY = 1;
    if (blinkT <= 0) {
      // A long frame (hitch, headless render) can jump far past the blink
      // window; skip the blink rather than feed a negative phase into the
      // squash curve (|blinkT/0.06 - 1| explodes for negatives — giant eyes).
      blinkT = 1.8 + ((t * 997) % 3.2);
    } else if (blinkT < 0.12) {
      eyeScaleY = Math.max(0.08, Math.abs(blinkT / 0.06 - 1));
    }
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
    clipPlayer?.dispose();
    // skinned extras: shared geometry/materials plus the skeleton's bone
    // texture; the traverse below re-hits the meshes harmlessly
    skinnedBody?.dispose();
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
    // skinned mode: segment count only covers chain parts (honest — the body
    // is not segments there); triangles add the skinned fill + shell
    return {
      segments: body.segmentCount(),
      triangles: body.triangles() + (skinnedBody?.triangles() ?? 0),
      renderMode,
    };
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
