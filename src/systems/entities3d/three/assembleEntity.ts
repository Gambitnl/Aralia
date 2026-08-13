// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/08/2026, 02:01:12
 * Dependents: components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx, systems/entities3d/three/Entity3D.tsx
 * Imports: 8 files
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
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Bone,
} from 'three';
import type { Anchor, EntityBlueprint, PartAnchors, PartPhase, Vec3Like } from '../types';
import { ANCHORS, headRadiusM, heightM } from '../types';
import { getPart } from '../registry';
import type { GaitDriver, LocomotionState, Pose } from './gaits';
import { createGaitDriver } from './gaits';
import { createSegmentBody, wireframeifyPart } from './segmentBody';
import { createSkinnedBiped, createSkinnedPlan, createSkinnedSpecies } from './skinnedBody';
import { isSpeciesGait } from './speciesSkeleton';
import { createSkinnedClipPlayer, type SkinnedClipPlayer } from './skinnedClipPlayer';
import type { AnimationClip } from 'three';
import { buildHeadForm, buildHumanoidHead, HUMANOID_EYE } from './headForms';
import { bipedSkullRadiusM } from './skeletonBuilder';
import type { WingJointPose } from '../parts/wingParts';
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
  // slice 1 skinned the biped, slice 4 the plan creatures, slice 5 the five
  // SPECIES gaits (quad/hexapod/hopper/flyer/float). Every gait in the Gait
  // union now has a bone hierarchy; an unhandled one still throws rather than
  // silently rendering as segments. Wireframe on a deforming body is DECIDED
  // (Remy 2026-07-21): skinned bodies render solid shaded, period — wireframe
  // stays a segment-body debug look and never comes to the skeleton path, so
  // requesting it is a caller bug, not a parked feature.
  if (bodyTech === 'skinned' && gait !== 'biped' && gait !== 'plan' && !isSpeciesGait(gait)) {
    throw new Error(`bodyTech 'skinned' has no skeleton for the '${gait}' gait`);
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
    // round 10 (creature-anatomy): grounded translucent bodies (oozes, gel
    // cubes) draw ONE surface via the depth prepass — interior shells never
    // show through. Floating mist (the ghost) keeps its layered look.
    oneSurface: !!blueprint.planSpec && blueprint.planSpec.stance !== 'floating',
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
        : isSpeciesGait(gait)
          ? // Slice 5: the five species gaits get a bone hierarchy captured
            // from their own driver's rest emissions. They emit nothing
            // decorative, so no delegate is needed — every emission is a bone.
            createSkinnedSpecies(gait, frame, {
              colorHex: palette.skinHex,
              outlineThickness,
              opacity: undefined,
              weights: options.skinnedWeights,
            })
          : createSkinnedBiped(frame, {
              colorHex: palette.skinHex,
              outlineThickness,
              // biped branch: this is the else of `blueprint.planSpec ?`, so
              // planSpec is absent — humanoids carry no plan opacity.
              opacity: undefined,
              weights: options.skinnedWeights,
            })
      : null;
  if (skinnedBody) bodyRoot.add(skinnedBody.root);

  // CC0 clip playback: a mixer poses the skinned bones instead of the driver.
  // The bones live under skinnedBody.root, so the mixer resolves them by name.
  // The mixer must bind to the SkinnedMesh (which carries .skeleton) — the
  // retargeted tracks are `.bones[name].quaternion`, which PropertyBinding can
  // only resolve on an object with a skeleton, never the wrapping group.
  const clipPlayer: SkinnedClipPlayer | null =
    animSource === 'clip' && skinnedBody && options.clips
      ? createSkinnedClipPlayer(skinnedBody.skinnedMesh, options.clips)
      : null;
  // slice 1: auto-select Walk vs Idle by speed. The full action table is slice 2.
  const idleClip = clipPlayer?.clipNames().includes('Idle_A') ? 'Idle_A' : 'Idle';
  let clipMode: 'idle' | 'walk' | null = clipPlayer ? 'idle' : null;
  if (clipPlayer) clipPlayer.play(idleClip);

  // Wing mesh parts (wingsFeathered/wingsMembrane) are garnish the driver
  // cannot see — plan-driven bodies (the Emberwing dragon) need the hint or
  // their wings freeze; biped/quad drivers beat unconditionally (harmless).
  const winged = blueprint.parts.some((p) => p.partId.startsWith('wings'));
  // round 9 (creature-anatomy): plan bodies own their dorsal crest — the
  // finRidge chain part rode a 3-anchor bezier and detached laterally from
  // the slithering spine (the round-8 "floating teardrops" top view). The
  // driver emits the crest along its LIVE spine stations instead.
  const crested = !!blueprint.planSpec && blueprint.parts.some((p) => p.partId === 'finRidge');
  const driver: GaitDriver = createGaitDriver(gait, frame, blueprint.planSpec, { winged, crested });

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

  // round 11 (humanoid-anatomy): faceSculpt is the per-race face-param
  // carrier (speciesProfiles features → blueprint.parts) — its params feed
  // buildHumanoidHead below; it builds no geometry, so skip the part loop.
  const faceSculptParams = blueprint.parts.find((p) => p.partId === 'faceSculpt')?.params;
  const face = {
    noseDepth: Number(faceSculptParams?.noseDepth ?? 1),
    noseWidth: Number(faceSculptParams?.noseWidth ?? 1),
    mouthWidth: Number(faceSculptParams?.mouthWidth ?? 1),
    // round 23 (humanoid-anatomy): jaw mass (see headForms.HumanoidFaceParams)
    jawWidth: Number(faceSculptParams?.jawWidth ?? 1),
    // round 13 (humanoid-anatomy): >1 raises the upper lid (smaller cap,
    // less forward roll) — the round-12 orc's "droopy half-lidded ... sleepy"
    // read. Assembler furniture only; buildHumanoidHead ignores it.
    lidOpen: Number(faceSculptParams?.lidOpen ?? 1),
    // round 14 (humanoid-anatomy): per-race eyeball scale (<1 shrinks the
    // whole eye assembly) — the dwarf/orc "huge glossy anime eyes" clash
    // with the gritty kit; smaller whites read grim, not cute.
    eyeScale: Number(faceSculptParams?.eyeScale ?? 1),
  };
  for (const instance of blueprint.parts) {
    if (instance.partId === 'faceSculpt') continue;
    const def = getPart(instance.partId);
    const params = instance.params ?? {};
    if (def.kind === 'chain') {
      // plan bodies: the driver already emits the spine-following crest
      if (instance.partId === 'finRidge' && blueprint.planSpec) continue;
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
      // ink outlines for every mesh in the part. round 7 (creature-anatomy):
      // parts opt thin pieces out via userData.noOutline — the inverse hull on
      // near-zero-radius tips (horn points, wing spars) rendered as detached
      // scribble wires, and on two-sided membrane sheets as dark slabs.
      object.traverse((o) => {
        const m = o as Mesh;
        if ((m.userData as { noOutline?: boolean }).noOutline) return;
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

  // --- sculpted head forms (planned bodies)
  // Task 3 (skeleton pivot slice 4): in SKINNED mode each formed head is
  // parented to its `head<i>` bone, which the pose sink writes from the
  // driver's live sockets every frame — the sculpted skull rides the skeleton
  // like every ball head does. In segments mode there are no bones, so the
  // head keeps the original per-frame socket placement below.
  const formHeads: Array<{ group: Group; head: number; bone: Bone | null }> = [];
  if (blueprint.planSpec && !wireframe) {
    const toothMaterial = toonMaterial('#e8e2d4');
    blueprint.planSpec.heads.forEach((headSpec, h) => {
      if (!headSpec.form) return;
      // round 8 (creature-anatomy): formed heads repurpose the plan's
      // per-head snout.droop as a jaw-gape scale (1 + droop) — the cone
      // snout is skipped on formed heads, so droop was dead data; now a
      // drooped snout closes the hinge partway and multi-head creatures
      // stop gaping in cloned unison (the hydra fixture's flankers).
      const formGroup = buildHeadForm(headSpec.form, toonMaterial(palette.skinHex), toothMaterial, {
        gapeScale: 1 + (headSpec.snout?.droop ?? 0),
      });
      formGroup.name = `head${h}:form`;
      const headBone = skinnedBody?.boneNamed(`head${h}`) ?? null;
      if (headBone) headBone.add(formGroup);
      else bodyRoot.add(formGroup);
      formHeads.push({ group: formGroup, head: h, bone: headBone });
    });
  }

  // --- sculpted humanoid head (biped gait, solid modes)
  // round 8 (humanoid-anatomy): the biped head is ONE continuous loft
  // (headForms.buildHumanoidHead) — chin, jawline, mouth, nose, carved eye
  // sockets, brow shelf, and cranium all stations of a single surface — and
  // it gets exactly ONE ink shell around that loft. The round-7 head was a
  // collage of attached feature boxes, each with its own outline; the
  // per-piece ink was what made every close-up read as a cardboard mask kit.
  // Skinned bodies skip baking the ball sphere and the head group parents to
  // the head bone (the ball emission still drives it); the segment renderer
  // still builds its ball node, which is hidden below. Wireframe keeps the
  // ball — it is a segment-body debug look.
  const headSkinMaterial = gait === 'biped' && !blueprint.planSpec && !wireframe ? toonMaterial(palette.skinHex) : null;
  // round 11 (humanoid-anatomy): per-race face params (nose depth/width,
  // mouth width) flow into the loft — orc broad-flat, dwarf prominent.
  const humanoidHead = headSkinMaterial ? buildHumanoidHead(headSkinMaterial, face) : null;
  let segHeadNode: Object3D | null | undefined;
  if (humanoidHead) {
    humanoidHead.name = 'head:form';
    const skullR = bipedSkullRadiusM(frame);
    humanoidHead.scale.setScalar(skullR);
    // ONE outline for the whole head: an inverse hull of the skull loft. The
    // head group is scaled by skullR, so the shell thickness converts to the
    // loft's unit space to match the body's ink weight. The hull inflates the
    // SMOOTH-normal indexed clone the loft carries (userData.shellGeometry) —
    // inflating the flat-faceted render geometry tears the hull open at every
    // hard edge.
    const skullMesh = humanoidHead.getObjectByName('skull') as Mesh;
    const shellGeometry = (skullMesh.userData as { shellGeometry?: Mesh['geometry'] }).shellGeometry ?? skullMesh.geometry;
    const headShell = new Mesh(shellGeometry, outlineMaterial(palette.skinHex, outlineThickness / skullR));
    headShell.name = 'headOutline';
    humanoidHead.add(headShell);
    const headBone = skinnedBody?.boneNamed('head');
    if (headBone) headBone.add(humanoidHead);
    else bodyRoot.add(humanoidHead);
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
  // round 9 (humanoid-anatomy): unlit near-black for the biped lash lines —
  // the same ink tone the creature heads use for their lid lines.
  const lashMaterial = new MeshBasicMaterial({ color: '#231a1c' });
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
        // round 23 (creature-anatomy): SOLID LENS BULGE — Remy orbited the
        // Construct Large live and the pupils vanished off-front ("outside of
        // the frame not visible?"). Every detail part must be a solid 3D form
        // that survives a 360° orbit: the pupil is now a larger sphere seated
        // shallower in the eyeball with no z-flatten, so a dark cap stays
        // proud of the white from every angle.
        const pupil = new Mesh(new SphereGeometry(Math.max(0.005, r * 0.64), 10, 8), pupilMaterial);
        pupil.position.z = r * 0.62;
        // pupil character: slit (reptile) is tall-thin, goat is wide-flat
        const pupilShape = headSpec.eyes.pupil ?? 'round';
        if (pupilShape === 'slit') pupil.scale.set(0.38, 1.45, 1);
        else if (pupilShape === 'goat') pupil.scale.set(1.45, 0.42, 1);
        eye.add(pupil);
        bodyRoot.add(eye);
        eyes.push(eye);
        plannedEyeHead.push(h);
        plannedEyeSlot.push(k);
      }
    });
  } else if (humanoidHead && headSkinMaterial) {
    // round 12 (humanoid-anatomy): MOUTH INK — ONE curved tube that tracks
    // the loft's recessed mouth ring analytically (y −0.235: half-width
    // 0.46, zF 0.47, front-half flatten cos^0.75 — mirror of loftFace). The
    // round-11 three-segment bar broke on the human: at mouthWidth 1 the
    // raked corner bars' inner ends (x ≈ 0.098, z ≈ 0.43) sank below the
    // loft surface (~0.46 there), burying the joins so the ink read as a
    // center dash plus two detached ticks — the critic's "disconnected
    // black scribble". A groove-following curve cannot disconnect at any
    // mouthWidth. End samples pull back into the cheek so the tube's open
    // ends stay buried; scale.y flattens the tube into a lip line. Lives
    // here, not in buildHumanoidHead: the head stays ONE loft mesh (the
    // round-8 pin); ink features are assembler furniture like the eyes.
    const mouthGroup = new Group();
    mouthGroup.name = 'mouthLine';
    const mw = face.mouthWidth;
    const grooveZ = (theta: number) => 0.47 * Math.pow(Math.cos(theta), 0.75);
    const thetaMax = Math.min(0.85, 0.5 * mw);
    const mouthPts: Vector3[] = [];
    const MOUTH_SAMPLES = 8;
    for (let i = -MOUTH_SAMPLES; i <= MOUTH_SAMPLES; i++) {
      const theta = (i / MOUTH_SAMPLES) * thetaMax;
      mouthPts.push(new Vector3(Math.sin(theta) * 0.46, 0, grooveZ(theta) + 0.02));
    }
    // buried end samples: past the corner, dive 0.06 under the cheek
    const endTheta = thetaMax + 0.14;
    mouthPts.unshift(new Vector3(Math.sin(-endTheta) * 0.46, 0, grooveZ(endTheta) - 0.06));
    mouthPts.push(new Vector3(Math.sin(endTheta) * 0.46, 0, grooveZ(endTheta) - 0.06));
    const mouthCurve = new CatmullRomCurve3(mouthPts, false, 'catmullrom', 0.5);
    const mouthTube = new Mesh(new TubeGeometry(mouthCurve, 24, 0.036, 6, false), lashMaterial);
    mouthTube.scale.y = 0.55; // tube → flattened lip line
    mouthGroup.add(mouthTube);
    mouthGroup.position.set(0, -0.235, 0);
    humanoidHead.add(mouthGroup);
    // round 12: NOSE SHADOW — one short dark bar tucked under the nose tip
    // (replaces the round-11 nostril-pit pair, which sat flat on the
    // underside plane and vanished from the front at sheet scale). The bar
    // rides the underside slope between the upper-lip station (y −0.17) and
    // the tip station (y −0.08), so its z tracks the race nose depth: the
    // orc's flat nose pulls it in, the dwarf's prominent nose pushes it out.
    // One connected shadow under the tip is what makes the ridge above read
    // as a NOSE at panel distance.
    const noseShadow = new Mesh(new BoxGeometry(0.19 * face.noseWidth, 0.032, 0.09), lashMaterial);
    noseShadow.position.set(0, -0.135, 0.585 + 0.16 * face.noseDepth);
    noseShadow.name = 'noseShadow';
    humanoidHead.add(noseShadow);
    // round 8 (humanoid-anatomy): INSET eyes — children of the sculpted head
    // in its unit space, nested in the socket recess the loft carves under
    // the brow shelf (HUMANOID_EYE is now smaller and deeper: r 0.13,
    // z 0.46, so most of the ball sits inside the surface). Each eye carries
    // a skin-toned UPPER LID cap that crops the top of the iris — the googly
    // full-circle sticker read dies with the lid. Parented to the eye, the
    // lid rides the blink squash (scale.y), so a blink reads as the lid
    // closing; the blink loop is untouched.
    for (const name of ['eyeL', 'eyeR'] as const) {
      const sgn = name === 'eyeL' ? -1 : 1;
      const eye = new Mesh(new SphereGeometry(HUMANOID_EYE.r, 12, 10), eyeMaterial);
      eye.name = name;
      eye.position.set(sgn * HUMANOID_EYE.x, HUMANOID_EYE.y, HUMANOID_EYE.z);
      const pupil = new Mesh(new SphereGeometry(HUMANOID_EYE.r * 0.58, 10, 8), pupilMaterial);
      pupil.position.z = HUMANOID_EYE.r * 0.72;
      eye.add(pupil);
      // upper lid: a skin cap over the ball's top-front, tilted forward so
      // its rim crosses the iris top — visible lid coverage from the front
      // round 13 (humanoid-anatomy): lidOpen > 1 (orc) shrinks the cap and
      // eases the forward roll — the rim rides above the iris top instead of
      // drooping across it (the "sleepy" read).
      // round 14 (humanoid-anatomy): the 1.6 raise DID reach the geometry but
      // was eaten downstream — the roll eased only 0.24 rad and the LASH BAND
      // kept its full π·0.18 thickness riding across the iris top, so the
      // dark "droopy lid" line never moved. The raise now nearly levels the
      // rim (0.55 slope), shrinks the cap harder (0.12), and thins/raises the
      // lash band itself (see below).
      const lidRaise = Math.max(0, face.lidOpen - 1);
      // round-14 probe numbers: the pupil's top sits at ~51° polar; the old
      // raised band still spanned 50–70° after the forward roll — a dark bar
      // straight across the iris = the sleepy read. The raised rim now
      // finishes ABOVE the pupil top and the whole lid tilts inner-corner-
      // down (angry glare), not outer-corner-down (sleepy droop).
      const lidRot = -0.5 + 0.7 * lidRaise;
      const angryTilt = 0.28 * lidRaise;
      const lid = new Mesh(
        new SphereGeometry(HUMANOID_EYE.r * 1.14, 12, 5, 0, Math.PI * 2, 0, Math.PI * (0.42 - 0.15 * lidRaise)),
        headSkinMaterial,
      );
      lid.rotation.x = lidRot; // roll the cap rim down over the iris top
      lid.rotation.z = sgn * -angryTilt; // inner corner dips — mean, not sleepy
      lid.name = `${name}Lid`;
      eye.add(lid);
      // round 12 (humanoid-anatomy): SOCKET FILLER — a skin-toned sphere
      // tucked behind the ball that plugs the ball-to-loft junction at every
      // azimuth. At 3/4 angles, sightlines slipped between the ball and the
      // (backface-culled) loft front into the head interior and hit the
      // BackSide ink shell — a thin dark drip under the far eye, the last of
      // the critic's stray face lines. Socket-carve and lid experiments left
      // it untouched; only sealing the junction kills it.
      const socketFiller = new Mesh(new SphereGeometry(HUMANOID_EYE.r * 1.32, 12, 10), headSkinMaterial);
      socketFiller.position.z = -0.055;
      socketFiller.name = `${name}SocketFiller`;
      eye.add(socketFiller);
      // round 9 (humanoid-anatomy): dark LASH LINE along the lid rim. The
      // skin-toned lid cap is invisible against pale skin (the round-8 human
      // read as an iris dot with no lid; the dwarf's white ball read as a
      // googly sticker) — the same near-black line the creature heads carry
      // (headForms eyeSocketPair lidMaterial) makes "lidded" read on every
      // skin tone. Parented to the lid, it rides the blink squash.
      // round 11 (humanoid-anatomy): the band DEEPENS (length π0.1 → π0.18).
      // Round 10 pulled the ball forward (z 0.42 → 0.45) and eased the socket
      // carve to open the orc's sleepy aperture; on the dwarf that exposed a
      // full white annulus around the pupil below the narrow band — the
      // white-circle googly regression the round-10 verdict called. The wider
      // band re-crops the iris top at the new exposure on every skin tone.
      // round 12 (humanoid-anatomy): FRONT ARC only (±80° around +z), not a
      // full 2π ring — the ring's outer side limb leaked past the socket rim
      // at 3/4 angles and hung below the far eye as a short dark vertical
      // drip (one of the critic's "tear streak" stray lines). The front arc
      // keeps the identical iris crop in every face-on read.
      // round 13 (humanoid-anatomy): the lash band tracks the raised lid rim
      // (thetaStart shifts up with lidOpen, same roll as the lid).
      // round 14 (humanoid-anatomy): the band also THINS with the raise
      // (π·0.18 → π·0.11 at lidOpen 1.6) and starts higher (0.10 slope) —
      // the fat dark band across the iris top WAS the sleepy read; a thin
      // high rim line under the brow reads open and mean.
      const lash = new Mesh(
        new SphereGeometry(HUMANOID_EYE.r * 1.16, 12, 3, Math.PI / 2 - 1.4, 2.8, Math.PI * (0.34 - 0.14 * lidRaise), Math.PI * (0.18 - 0.11 * lidRaise)),
        lashMaterial,
      );
      lash.rotation.x = lidRot; // same roll as the lid — the band sits at its rim
      lash.rotation.z = sgn * -angryTilt; // rides the lid's angry tilt
      lash.name = `${name}Lash`;
      eye.add(lash);
      // round 20 (humanoid-anatomy): THE LOWER LID — round 19 on the dwarf:
      // "pale streaks under both eyes that read as tears". The eye has carried
      // an upper lid since round 8 but never a lower one, so the pale sclera
      // sphere spilled BELOW the dark lash line as a bright wedge hanging off
      // each eye — the tear. (Round 11's alar creases and round 12's lash-ring
      // side limb were different sources of the same artifact; this is the
      // ball itself.) A skin-toned bottom cap, mirror of the upper lid and
      // slightly wider, crops the sclera at the lower rim on every skin tone
      // and every azimuth. Parented to the eye, so it rides the blink squash.
      const lowerLid = new Mesh(
        new SphereGeometry(HUMANOID_EYE.r * 1.15, 12, 5, 0, Math.PI * 2, Math.PI * 0.66, Math.PI * 0.34),
        headSkinMaterial,
      );
      // NEGATIVE x rolls a BOTTOM cap forward (+z), the mirror of the upper
      // lid's negative lidRot rolling a TOP cap forward — a positive angle
      // tips this rim backwards and leaves the sclera showing.
      lowerLid.rotation.x = -0.32; // roll the rim up over the sclera's bottom-front
      lowerLid.rotation.z = sgn * -angryTilt; // matches the upper lid's tilt
      lowerLid.name = `${name}LowerLid`;
      eye.add(lowerLid);
      // round 14 (humanoid-anatomy): per-race eye shrink — scaling the eye
      // group scales pupil, lid, lash, and socket filler with it; the loft
      // socket recess is unchanged, so the smaller ball sits deeper-set.
      if (face.eyeScale !== 1) eye.scale.setScalar(face.eyeScale);
      humanoidHead.add(eye);
      eyes.push(eye);
    }
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
  const tmpQuatB = new Quaternion();
  const tmpVecA = new Vector3();
  const FORWARD = new Vector3(0, 0, 1);
  const AXIS_Z = new Vector3(0, 0, 1);
  const WING_JOINT_NAMES = ['wingArm', 'wingElbow', 'wingHand'] as const;

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
      // Task 3: formed heads emit no ball, so the pose sink never sees their
      // head<i> bones — write them from the driver's live sockets before the
      // locals resolve, or bone-parented sculpted heads freeze at bind pose.
      if (driver.headSockets && skinnedBody.poseHeadSockets) {
        skinnedBody.poseHeadSockets(driver.headSockets());
      }
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
        // Sign convention (from the original beat): +z-rotation on wingL and
        // -z on wingR BOTH lower the tips symmetrically; ±y sweeps tips back.
        const fold = driver.wingFold;
        const beat = driver.flap * (1 - fold * 0.55);
        for (const [wing, sgn] of [
          [wingL, -1],
          [wingR, 1],
        ] as const) {
          const armJoint = wing.getObjectByName('wingArm');
          const foldedBlade = wing.getObjectByName('wingFolded');
          if (armJoint && foldedBlade) {
            // round 9 (creature-anatomy): folded and spread are DIFFERENT
            // MESHES (the low-poly game trick) — articulating the spread
            // armature into a fold failed three rounds straight. The
            // purpose-built folded blade (wingParts buildFoldedWing) shows at
            // fold ≈ 1; the three-joint armature holds its SPREAD pose (plus
            // the flap beat) and only shows at fold ≈ 0; a short smoothstep
            // cross-scale bridges the transition so neither pops.
            // round 10 (creature-anatomy): the swap is COMPLETE — every child
            // of the wing group that is not the folded blade counts as spread
            // assembly and hides with it, so no arm bone, spar, or joint ball
            // can ever render next to the blade.
            const f = fold * fold * (3 - 2 * fold);
            for (const child of wing.children) {
              const k = child === foldedBlade ? f : 1 - f;
              child.scale.setScalar(Math.max(1e-3, k));
              child.visible = k > 0.02;
            }
            for (const jointName of WING_JOINT_NAMES) {
              const joint = jointName === 'wingArm' ? armJoint : wing.getObjectByName(jointName);
              const pose = joint && (joint.userData as { wingJoint?: WingJointPose }).wingJoint;
              if (!joint || !pose) continue;
              if (pose.beatSign) {
                tmpQuatB.setFromAxisAngle(AXIS_Z, pose.beatSign * beat);
                joint.quaternion.multiplyQuaternions(tmpQuatB, pose.spread);
              } else {
                joint.quaternion.copy(pose.spread);
              }
            }
          } else if (armJoint) {
            // round 7 (creature-anatomy): membrane wings are a THREE-JOINT
            // armature (shoulder › elbow › wrist). Each joint group carries
            // its own spread/folded local pose (wingParts POSE); blending per
            // joint gives the folded wing real anatomy — humerus up-and-back
            // to a high elbow peak, radius forward-down to a wrist spike over
            // the shoulder, finger spars fanned back along the flank with the
            // membrane draped between them. Round 6's whole-wing slerp
            // produced the rigid kite-sail panels the critic called out.
            for (const jointName of WING_JOINT_NAMES) {
              const joint = jointName === 'wingArm' ? armJoint : wing.getObjectByName(jointName);
              const pose = joint && (joint.userData as { wingJoint?: WingJointPose }).wingJoint;
              if (!joint || !pose) continue;
              tmpQuat.copy(pose.spread).slerp(pose.folded, fold);
              if (pose.beatSign) {
                tmpQuatB.setFromAxisAngle(AXIS_Z, pose.beatSign * beat);
                joint.quaternion.multiplyQuaternions(tmpQuatB, tmpQuat);
              } else {
                joint.quaternion.copy(tmpQuat);
              }
            }
          } else {
            // feathered wings keep the round-5 parked-bird drape: tips drop
            // past horizontal and trail along the rear flank.
            // round 25 (creature-anatomy): the rear sweep halves (0.9 → 0.45)
            // and the lateral squash eases (0.6 → 0.35). With the round-25
            // layered feather groups the wing is a real sheet, and the old
            // sweep tucked the whole thing directly behind the torso — the
            // orbit check showed the front panel with no wing visible at all,
            // on the archetype whose wings ARE its identity statement.
            wing.rotation.z = -sgn * (beat + fold * 1.62);
            wing.rotation.y = sgn * fold * 0.45;
            wing.scale.x = 1 - fold * 0.35;
          }
        }
      }
    }

    // eyes track their head — planned bodies read live sockets, others the anchor
    if (blueprint.planSpec && driver.headSockets) {
      const sockets = driver.headSockets();
      // sculpted head forms ride their sockets
      for (const fh of formHeads) {
        const socket = sockets[fh.head];
        if (!socket) continue;
        if (fh.bone) {
          // Skinned mode (Task 3): the head<i> bone already carries position
          // and facing — the mesh only keeps its radius scale (buildHeadForm
          // geometry is unit-radius by construction).
          fh.group.scale.setScalar(socket.r);
          continue;
        }
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
        // round 5 (creature-anatomy): spread 0.95 → 0.72 — the lofted skulls
        // taper toward the nose, so wide-set eyes floated OFF the snout
        // flanks as googly discs; the tighter set seats them on the brow line
        // where the cheek station still carries width.
        // round 7 (creature-anatomy): forward 0.72 → 0.62 — the ball now sits
        // half-buried in the brow/snout junction (a SOCKETED eye under the
        // headForm's new orbit hood + lid line, not a disc glued on the cheek).
        eye.position.set(
          socket.x + socket.fx * socket.r * 0.62 + rx * spread * socket.r * 0.72,
          socket.y + socket.r * 0.16,
          socket.z + socket.fz * socket.r * 0.62 + rz * spread * socket.r * 0.72,
        );
        tmpVecA.set(socket.fx, socket.fy, socket.fz);
        eye.quaternion.setFromUnitVectors(FORWARD, tmpVecA);
      }
    } else if (humanoidHead) {
      // round 7 (humanoid-anatomy): the sculpted head rides the head bone in
      // skinned mode (nothing to do); in segments mode it tracks the head
      // anchor (the drawn ball's center) and the segment renderer's ball node
      // hides behind it. Eyes are children of the head — they ride along.
      if (!skinnedBody) {
        const head = driver.pose.anchors.head.pos;
        humanoidHead.position.set(head.x, head.y, head.z);
        if (segHeadNode === undefined) segHeadNode = body.root.getObjectByName('seg:head') ?? null;
        if (segHeadNode) segHeadNode.visible = false;
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
