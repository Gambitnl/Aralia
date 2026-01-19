import { useEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import type { Color, MeshStandardMaterial } from 'three';
import { Color as ThreeColor, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';

type ShaderWithUniforms = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

interface LabGroundProps {
  size: number;
  tint?: Color;
  noiseScale?: number;
  patchiness?: number;
}

const LabGround = ({ size, tint = new ThreeColor(0xffffff), noiseScale = 100, patchiness = 0.7 }: LabGroundProps) => {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const baseUrl = import.meta.env.BASE_URL;
  const [grassTexture, dirtTexture, dirtNormal] = useLoader(TextureLoader, [
    `${baseUrl}assets/ez-tree-lab/grass.jpg`,
    `${baseUrl}assets/ez-tree-lab/dirt_color.jpg`,
    `${baseUrl}assets/ez-tree-lab/dirt_normal.jpg`,
  ]);

  const geometry = useMemo(() => new PlaneGeometry(size, size, 1, 1), [size]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    [grassTexture, dirtTexture, dirtNormal].forEach((texture) => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    });
    grassTexture.colorSpace = SRGBColorSpace;
    dirtTexture.colorSpace = SRGBColorSpace;
  }, [dirtNormal, dirtTexture, grassTexture]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader: ShaderWithUniforms) => {
      shader.uniforms.uNoiseScale = { value: noiseScale };
      shader.uniforms.uPatchiness = { value: patchiness };
      shader.uniforms.uGrassTexture = { value: grassTexture };
      shader.uniforms.uDirtTexture = { value: dirtTexture };

      shader.vertexShader = [
        'varying vec3 vWorldPosition;',
        shader.vertexShader,
      ].join('\n');

      shader.fragmentShader = [
        'varying vec3 vWorldPosition;',
        'uniform float uNoiseScale;',
        'uniform float uPatchiness;',
        'uniform sampler2D uGrassTexture;',
        'uniform sampler2D uDirtTexture;',
        shader.fragmentShader,
      ].join('\n');

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vWorldPosition = worldPosition.xyz;',
        ].join('\n')
      );

      // Inline simplex noise (ported from ez-tree demo) so we can procedurally
      // blend between grass/dirt textures without additional dependencies.
      shader.fragmentShader = shader.fragmentShader.replace(
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

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '{',
          '  vec2 uvWorld = vec2(vWorldPosition.x, vWorldPosition.z);',
          '  vec3 grassColor = texture2D(uGrassTexture, uvWorld / 30.0).rgb;',
          '  vec3 dirtColor = texture2D(uDirtTexture, uvWorld / 30.0).rgb;',
          '  float n = 0.5 + 0.5 * simplex2d(uvWorld / uNoiseScale);',
          '  float s = smoothstep(uPatchiness - 0.1, uPatchiness + 0.1, n);',
          '  vec4 sampledDiffuseColor = vec4(mix(grassColor, dirtColor, s), 1.0);',
          '  diffuseColor *= sampledDiffuseColor;',
          '}',
        ].join('\n')
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        [
          // Use world-position UVs for normal sampling so the details don't
          // stretch when the plane size changes.
          '{',
          '  vec2 uvWorld = vec2(vWorldPosition.x, vWorldPosition.z);',
          '  vec3 mapN = texture2D(normalMap, uvWorld / 30.0).xyz * 2.0 - 1.0;',
          '  mapN.xy *= normalScale;',
          '  normal = normalize(tbn * mapN);',
          '}',
        ].join('\n')
      );

      material.userData.shader = shader;
    };

    material.needsUpdate = true;
  }, [dirtNormal, dirtTexture, grassTexture, noiseScale, patchiness]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        ref={materialRef}
        color={tint}
        normalMap={dirtNormal}
        roughness={0.92}
        metalness={0.02}
      />
    </mesh>
  );
};

export default LabGround;
