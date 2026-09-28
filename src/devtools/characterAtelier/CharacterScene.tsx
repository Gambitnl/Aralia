// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/09/2026, 12:47:11
 * Dependents: devtools/characterAtelier/main.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Displays the Blender GLB, including its skeleton and breathing animation.
 * The scene is transparent so the painted clearing stays crisp at every size.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, useAnimations, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { raceOptions } from './choices';

export type Appearance = { hair: string; skin: string; cloth: string; build: number; tattoo: boolean; tattooColor: string; tattooOpacity: number };
const assetRoot = `${import.meta.env.BASE_URL}assets/character-atelier/`;

function Character({ model, appearance, onReady }: { model: string; appearance: Appearance; onReady: () => void }) {
  const gltf = useGLTF(`${assetRoot}${model}.glb?surface-fit=2`);
  const tattooMask = useTexture(`${assetRoot}stone-sigil-mask.png`);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.frustumCulled = false;
        object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
      }
    });
    copy.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(copy);
    const scale = (raceOptions.find(r => r.id === model)?.height ?? 1.94) / (bounds.max.y - bounds.min.y);
    copy.scale.multiplyScalar(scale);
    copy.position.y -= bounds.min.y * scale;
    return copy;
  }, [gltf, model]);
  const { actions } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.values(actions).forEach(action => action?.reset().play());
    }
    onReady();
    return () => { Object.values(actions).forEach(action => action?.stop()); };
  }, [actions, onReady]);
  useEffect(() => {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material: THREE.MeshStandardMaterial) => {
        if (material.name.startsWith('Hair')) material.color.set(appearance.hair);
        if (/skin|caucasian|\.body/i.test(material.name)) material.color.set(appearance.skin);
        if (material.name.startsWith('Tabard green')) {
          material.color.set(appearance.cloth);
          if (material.map) {
            const baseDye = new THREE.Color('#174c3c');
            material.color.setRGB(material.color.r/baseDye.r,material.color.g/baseDye.g,material.color.b/baseDye.b);
          }
        }
      });
    });
  }, [scene, appearance]);
  useEffect(() => {
    if (!appearance.tattoo || model==='dragonborn') return;
    const replacements: Array<{ material: THREE.MeshStandardMaterial; original: THREE.Texture; painted: THREE.CanvasTexture }> = [];
    const visited = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material]) as THREE.MeshStandardMaterial[]) {
        if (visited.has(material) || !material.name.includes('.body') || !material.map) continue;
        visited.add(material);
        const original = material.map;
        const skinImage = original.image as HTMLImageElement | ImageBitmap;
        const canvas = document.createElement('canvas');
        canvas.width = skinImage.width; canvas.height = skinImage.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(skinImage,0,0,canvas.width,canvas.height);
        const ink = document.createElement('canvas');ink.width=canvas.width;ink.height=canvas.height;
        const inkContext = ink.getContext('2d')!;
        inkContext.drawImage(tattooMask.image as HTMLImageElement,0,0,ink.width,ink.height);
        inkContext.globalCompositeOperation='source-in';inkContext.fillStyle=appearance.tattooColor;
        inkContext.fillRect(0,0,ink.width,ink.height);
        // Multiply pigment into the existing albedo: skin pores and shading
        // remain visible, with no extra surface, silhouette or specular edge.
        context.globalCompositeOperation='multiply';context.globalAlpha=appearance.tattooOpacity;
        context.drawImage(ink,0,0);
        const painted = new THREE.CanvasTexture(canvas);
        painted.flipY=original.flipY;painted.colorSpace=original.colorSpace;
        painted.wrapS=original.wrapS;painted.wrapT=original.wrapT;
        material.map=painted;material.needsUpdate=true;
        replacements.push({material,original,painted});
      }
    });
    return () => replacements.forEach(({material,original,painted}) => {material.map=original;material.needsUpdate=true;painted.dispose();});
  }, [scene, model, tattooMask, appearance.tattoo, appearance.tattooColor, appearance.tattooOpacity]);
  // The glTF exporter converts Blender's forward direction to face this camera.
  return <group scale={[appearance.build,1,1]}><primitive object={scene} /></group>;
}

function CameraMotion({ closeup, rotation, resetKey, model }: { closeup: boolean; rotation: number; resetKey: number; model: string }) {
  const ancestry = raceOptions.find(r => r.id === model)!;
  const size = useThree(state => state.size);
  // Portrait zoom must fit the head in the narrower canvas dimension. A fixed
  // dolly limit let tall windows crop profiles at the canvas's left edge.
  // Include room for the nose, ears and horns throughout a full rotation.
  const aspect = size.width / Math.max(1, size.height);
  const portraitMinimum = .18 + .38 / (Math.tan(THREE.MathUtils.degToRad(33 / 2)) * Math.min(1, aspect));
  const minimumDistance = closeup ? portraitMinimum : .85;
  // Preserve the race's stature in full-body view; portrait mode follows its
  // actual face, including small folk and characters with tall horns.
  const targetY = closeup ? ancestry.faceHeight : 1.12;
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const previous = useRef(rotation);
  const rotationAtReset = useRef(rotation);
  useEffect(() => { rotationAtReset.current = rotation; }, [rotation]);
  useFrame(({ camera }, delta) => {
    if (!controls.current) return;
    controls.current.target.y = THREE.MathUtils.damp(controls.current.target.y, targetY, 5, delta);
    if (previous.current !== rotation) {
      const relative = camera.position.clone().sub(controls.current.target);
      relative.applyAxisAngle(new THREE.Vector3(0,1,0), rotation - previous.current);
      camera.position.copy(controls.current.target).add(relative);
      previous.current = rotation;
    }
    controls.current.update();
  });
  useEffect(() => {
    if (!controls.current) return;
    const camera = controls.current.object as THREE.PerspectiveCamera;
    camera.position.set(0, targetY + .02, closeup ? Math.max(1.65, portraitMinimum) : 4.3);
    controls.current.target.set(0, targetY, 0);
    // Consume the rotation counter when resetting, so the next frame does not
    // undo the reset by applying a stale incremental turn.
    previous.current = rotationAtReset.current;
    controls.current.update();
  }, [closeup, resetKey, targetY, model, portraitMinimum]);
  return <OrbitControls ref={controls} enablePan={false} minDistance={minimumDistance} maxDistance={Math.max(5,minimumDistance)} minPolarAngle={Math.PI*.26} maxPolarAngle={Math.PI*.62} target={[0,1.02,0]} />;
}

export function CharacterScene({ model, appearance, closeup, rotation, resetKey }: { model: string; appearance: Appearance; closeup: boolean; rotation: number; resetKey: number }) {
  const [loadedModel, setLoadedModel] = useState('');
  const markReady = React.useCallback(() => setLoadedModel(model), [model]);
  const ready = loadedModel === model;
  return <div className="character-scene" aria-label="Interactive 3D character. Drag to rotate; scroll to zoom.">
    {!ready && <div className="model-loading" role="status"><span />Summoning your character…</div>}
    <Canvas shadows camera={{ position:[0,1.05,3.9], fov:33 }} dpr={[1,1.6]} gl={{ alpha:true, antialias:true }}>
      <ambientLight intensity={1.2} color="#b7cfdf" />
      <directionalLight position={[-3,5,4]} intensity={3.2} color="#ffe5b9" castShadow />
      <directionalLight position={[3,3,-2]} intensity={3} color="#d9e9f7" />
      <directionalLight position={[0,2,4]} intensity={.8} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={1.5} color="#ffedc9" position={[-3,3,2]} scale={[6,4,1]} />
        <Lightformer form="rect" intensity={1.2} color="#c9dfef" position={[2,3,-3]} rotation={[0,Math.PI,0]} scale={[5,5,1]} />
      </Environment>
      {/* Each rig owns its animation mixer. Reusing one across models with the
          same bone names can apply the previous character's bone transforms. */}
      <Suspense fallback={null}><Character key={model} model={model} appearance={appearance} onReady={markReady} /></Suspense>
      <ContactShadows position={[0,.015,0]} opacity={.6} scale={4} blur={2.4} far={2.5} resolution={256} />
      <CameraMotion closeup={closeup} rotation={rotation} resetKey={resetKey} model={model} />
    </Canvas>
  </div>;
}
