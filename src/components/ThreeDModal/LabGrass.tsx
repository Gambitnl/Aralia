import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { Color as ThreeColor, DoubleSide, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { SeededRandom } from '../../utils/random/seededRandom';

type ShaderWithUniforms = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

interface LabGrassProps {
  seed: number;
  grassEnabled?: boolean;
  flowersEnabled?: boolean;
  grassCount?: number;
  flowerCountPerColor?: number;
  radius?: number;
  avoidCenter?: { x: number; z: number };
  avoidRadius?: number;
}

const MAX_GRASS_INSTANCES = 15000;
const MAX_FLOWER_INSTANCES = 800;

const findFirstMesh = (root: unknown) => {
  const scene = root as { traverse: (fn: (o: any) => void) => void };
  let found: any = null;
  scene.traverse((o: any) => {
    if (!found && o?.isMesh) found = o;
  });
  if (!found) throw new Error('No mesh found inside GLB scene');
  return found;
};

const shiftGeometryToGround = (geometry: any) => {
  geometry.computeBoundingBox?.();
  const minY = geometry.boundingBox?.min?.y ?? 0;
  if (minY !== 0 && geometry.translate) {
    geometry.translate(0, -minY, 0);
  }
  geometry.computeBoundingSphere?.();
  geometry.computeBoundingBox?.();
  return geometry;
};

const appendWindShader = (material: MeshStandardMaterial, instanced: boolean) => {
  material.onBeforeCompile = (shader: ShaderWithUniforms) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindStrength = { value: new Vector3(0.3, 0, 0.3) };
    shader.uniforms.uWindFrequency = { value: 1.0 };
    shader.uniforms.uWindScale = { value: 400.0 };

    shader.vertexShader = [
      'uniform float uTime;',
      'uniform vec3 uWindStrength;',
      'uniform float uWindFrequency;',
      'uniform float uWindScale;',
      shader.vertexShader,
    ].join('\n');

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      [
        'vec3 mod289(vec3 x) {',
        '  return x - floor(x * (1.0 / 289.0)) * 289.0;',
        '}',
        'vec2 mod289(vec2 x) {',
        '  return x - floor(x * (1.0 / 289.0)) * 289.0;',
        '}',
        'vec3 permute(vec3 x) {',
        '  return mod289(((x * 34.0) + 1.0) * x);',
        '}',
        'float simplex2d(vec2 v) {',
        '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
        '  vec2 i = floor(v + dot(v, C.yy));',
        '  vec2 x0 = v - i + dot(i, C.xx);',
        '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
        '  vec4 x12 = x0.xyxy + C.xxzz;',
        '  x12.xy -= i1;',
        '  i = mod289(i);',
        '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
        '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);',
        '  m = m * m;',
        '  m = m * m;',
        '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
        '  vec3 h = abs(x) - 0.5;',
        '  vec3 ox = floor(x + 0.5);',
        '  vec3 a0 = x - ox;',
        '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);',
        '  vec3 g;',
        '  g.x = a0.x * x0.x + h.x * x0.y;',
        '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
        '  return 130.0 * dot(m, g);',
        '}',
        '',
        'void main() {',
      ].join('\n')
    );

    const projectReplacement = instanced
      ? [
        'vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);',
        'float windOffset = 2.0 * 3.14 * simplex2d((modelMatrix * mvPosition).xz / uWindScale);',
        'vec3 windSway = position.y * uWindStrength *',
        '  sin(uTime * uWindFrequency + windOffset) *',
        '  cos(uTime * 1.4 * uWindFrequency + windOffset);',
        'mvPosition.xyz += windSway;',
        'mvPosition = modelViewMatrix * mvPosition;',
        'gl_Position = projectionMatrix * mvPosition;',
      ].join('\n')
      : [
        'vec4 mvPosition = vec4(transformed, 1.0);',
        'float windOffset = 2.0 * 3.14 * simplex2d((modelMatrix * mvPosition).xz / uWindScale);',
        'vec3 windSway = 0.2 * position.y * uWindStrength *',
        '  sin(uTime * uWindFrequency + windOffset) *',
        '  cos(uTime * 1.4 * uWindFrequency + windOffset);',
        'mvPosition.xyz += windSway;',
        'mvPosition = modelViewMatrix * mvPosition;',
        'gl_Position = projectionMatrix * mvPosition;',
      ].join('\n');

    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', projectReplacement);
    material.userData.shader = shader;
  };
};

const buildScatter = ({
  seed,
  maxInstances,
  radius,
  avoidCenter,
  avoidRadius,
  baseScale,
  scaleVariation,
  y,
}: {
  seed: number;
  maxInstances: number;
  radius: number;
  avoidCenter: { x: number; z: number };
  avoidRadius: number;
  baseScale: { x: number; y: number; z: number };
  scaleVariation: { x: number; y: number; z: number };
  y: number;
}) => {
  const rng = new SeededRandom(seed);
  const placements: Array<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    sx: number;
    sy: number;
    sz: number;
    color: ThreeColor;
  }> = [];

  const avoidSq = avoidRadius * avoidRadius;
  const attemptsMax = maxInstances * 3;
  let attempts = 0;

  while (placements.length < maxInstances && attempts < attemptsMax) {
    attempts += 1;
    const r = 10 + rng.next() * Math.max(10, radius - 10);
    const theta = rng.next() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    if ((x - avoidCenter.x) ** 2 + (z - avoidCenter.z) ** 2 < avoidSq) continue;

    const sx = baseScale.x + rng.next() * scaleVariation.x;
    const sy = baseScale.y + rng.next() * scaleVariation.y;
    const sz = baseScale.z + rng.next() * scaleVariation.z;

    placements.push({
      x,
      y,
      z,
      rx: 0,
      ry: rng.next() * Math.PI * 2,
      rz: 0,
      sx,
      sy,
      sz,
      color: new ThreeColor(
        0.25 + rng.next() * 0.1,
        0.3 + rng.next() * 0.3,
        0.1
      ),
    });
  }

  return placements;
};

const LabGrass = ({
  seed,
  grassEnabled = true,
  flowersEnabled = true,
  grassCount = 5000,
  flowerCountPerColor = 50,
  radius = 500,
  avoidCenter = { x: 0, z: 0 },
  avoidRadius = 50,
}: LabGrassProps) => {
  const baseUrl = import.meta.env.BASE_URL;

  const [grassGltf, flowerWhiteGltf, flowerBlueGltf, flowerYellowGltf] = useLoader(GLTFLoader, [
    `${baseUrl}assets/ez-tree-lab/grass.glb`,
    `${baseUrl}assets/ez-tree-lab/flower_white.glb`,
    `${baseUrl}assets/ez-tree-lab/flower_blue.glb`,
    `${baseUrl}assets/ez-tree-lab/flower_yellow.glb`,
  ]);

  const grassMesh = useMemo(() => findFirstMesh(grassGltf.scene), [grassGltf.scene]);
  const flowerWhiteMesh = useMemo(() => findFirstMesh(flowerWhiteGltf.scene), [flowerWhiteGltf.scene]);
  const flowerBlueMesh = useMemo(() => findFirstMesh(flowerBlueGltf.scene), [flowerBlueGltf.scene]);
  const flowerYellowMesh = useMemo(() => findFirstMesh(flowerYellowGltf.scene), [flowerYellowGltf.scene]);

  const grassGeometry = useMemo(() => shiftGeometryToGround(grassMesh.geometry.clone()), [grassMesh.geometry]);
  const flowerWhiteGeometry = useMemo(() => shiftGeometryToGround(flowerWhiteMesh.geometry.clone()), [flowerWhiteMesh.geometry]);
  const flowerBlueGeometry = useMemo(() => shiftGeometryToGround(flowerBlueMesh.geometry.clone()), [flowerBlueMesh.geometry]);
  const flowerYellowGeometry = useMemo(() => shiftGeometryToGround(flowerYellowMesh.geometry.clone()), [flowerYellowMesh.geometry]);

  useEffect(() => () => {
    grassGeometry.dispose();
    flowerWhiteGeometry.dispose();
    flowerBlueGeometry.dispose();
    flowerYellowGeometry.dispose();
  }, [flowerBlueGeometry, flowerWhiteGeometry, flowerYellowGeometry, grassGeometry]);

  const grassMaterial = useMemo(() => {
    const map = grassMesh.material?.map;
    const mat = new MeshStandardMaterial({
      map: map || null,
      emissive: new ThreeColor(0x308040),
      emissiveIntensity: 0.05,
      transparent: false,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    mat.vertexColors = true;
    appendWindShader(mat, true);
    return mat;
  }, [grassMesh.material]);

  const makeFlowerMaterial = (mesh: any, tint: number) => {
    const map = mesh.material?.map;
    const mat = new MeshStandardMaterial({
      map: map || null,
      transparent: true,
      alphaTest: 0.5,
      side: DoubleSide,
      color: new ThreeColor(tint),
      roughness: 1,
      metalness: 0,
    });
    appendWindShader(mat, true);
    return mat;
  };

  const flowerWhiteMaterial = useMemo(() => makeFlowerMaterial(flowerWhiteMesh, 0xffffff), [flowerWhiteMesh]);
  const flowerBlueMaterial = useMemo(() => makeFlowerMaterial(flowerBlueMesh, 0x60a5fa), [flowerBlueMesh]);
  const flowerYellowMaterial = useMemo(() => makeFlowerMaterial(flowerYellowMesh, 0xfbbf24), [flowerYellowMesh]);

  useEffect(() => () => {
    grassMaterial.dispose?.();
    flowerWhiteMaterial.dispose?.();
    flowerBlueMaterial.dispose?.();
    flowerYellowMaterial.dispose?.();
  }, [flowerBlueMaterial, flowerWhiteMaterial, flowerYellowMaterial, grassMaterial]);

  const grassRef = useRef<InstancedMesh>(null);
  const flowerWhiteRef = useRef<InstancedMesh>(null);
  const flowerBlueRef = useRef<InstancedMesh>(null);
  const flowerYellowRef = useRef<InstancedMesh>(null);

  const grassPlacements = useMemo(() => buildScatter({
    seed: seed + 111,
    maxInstances: MAX_GRASS_INSTANCES,
    radius,
    avoidCenter,
    avoidRadius,
    baseScale: { x: 5, y: 4, z: 5 },
    scaleVariation: { x: 1, y: 2, z: 1 },
    y: 0,
  }), [avoidCenter, avoidRadius, radius, seed]);

  const flowerPlacements = useMemo(() => {
    const common = {
      maxInstances: MAX_FLOWER_INSTANCES,
      radius: Math.min(radius, 250),
      avoidCenter,
      avoidRadius,
      baseScale: { x: 0.06, y: 0.06, z: 0.06 },
      scaleVariation: { x: 0.06, y: 0.06, z: 0.06 },
      y: 0,
    };
    return {
      white: buildScatter({ seed: seed + 222, ...common }),
      blue: buildScatter({ seed: seed + 333, ...common }),
      yellow: buildScatter({ seed: seed + 444, ...common }),
    };
  }, [avoidCenter, avoidRadius, radius, seed]);

  useEffect(() => {
    if (!grassEnabled) return;
    const mesh = grassRef.current as any;
    if (!mesh) return;
    const dummy = new Object3D();
    grassPlacements.forEach((p, index) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt?.(index, p.color);
    });
    mesh.count = Math.max(0, Math.min(grassCount, grassPlacements.length));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [grassCount, grassEnabled, grassPlacements]);

  const applyFlowerInstances = (ref: any, placements: typeof grassPlacements) => {
    const mesh = ref.current as any;
    if (!mesh) return;
    const dummy = new Object3D();
    placements.forEach((p, index) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.count = Math.max(0, Math.min(flowerCountPerColor, placements.length));
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (!flowersEnabled) return;
    applyFlowerInstances(flowerWhiteRef, flowerPlacements.white);
    applyFlowerInstances(flowerBlueRef, flowerPlacements.blue);
    applyFlowerInstances(flowerYellowRef, flowerPlacements.yellow);
  }, [flowerCountPerColor, flowerPlacements, flowersEnabled]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const materials = [grassMaterial, flowerWhiteMaterial, flowerBlueMaterial, flowerYellowMaterial];
    materials.forEach((mat) => {
      const shader = mat.userData.shader as ShaderWithUniforms | undefined;
      if (!shader) return;
      shader.uniforms.uTime.value = t;
    });
  });

  if (!grassEnabled && !flowersEnabled) return null;

  return (
    <>
      {grassEnabled && (
        <instancedMesh
          ref={grassRef}
          args={[grassGeometry, grassMaterial, MAX_GRASS_INSTANCES]}
          receiveShadow
          castShadow
        />
      )}
      {flowersEnabled && (
        <>
          <instancedMesh
            ref={flowerWhiteRef}
            args={[flowerWhiteGeometry, flowerWhiteMaterial, MAX_FLOWER_INSTANCES]}
            receiveShadow
            castShadow
          />
          <instancedMesh
            ref={flowerBlueRef}
            args={[flowerBlueGeometry, flowerBlueMaterial, MAX_FLOWER_INSTANCES]}
            receiveShadow
            castShadow
          />
          <instancedMesh
            ref={flowerYellowRef}
            args={[flowerYellowGeometry, flowerYellowMaterial, MAX_FLOWER_INSTANCES]}
            receiveShadow
            castShadow
          />
        </>
      )}
    </>
  );
};

export default LabGrass;
