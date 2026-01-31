import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshBasicMaterial } from 'three';
import { PlaneGeometry } from 'three';

type ShaderWithUniforms = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

interface LabCloudsProps {
  size?: number;
  height?: number;
}

const LabClouds = ({ size = 2000, height = 200 }: LabCloudsProps) => {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const geometry = useMemo(() => new PlaneGeometry(size, size, 1, 1), [size]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader: ShaderWithUniforms) => {
      shader.uniforms.uTime = { value: 0.0 };

      shader.vertexShader = [
        'varying vec2 vUv;',
        'varying vec3 vWorldPosition;',
        shader.vertexShader,
      ].join('\n');

      shader.fragmentShader = [
        'uniform float uTime;',
        'varying vec2 vUv;',
        'varying vec3 vWorldPosition;',
        shader.fragmentShader,
      ].join('\n');

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vUv = uv;',
          'vWorldPosition = worldPosition.xyz;',
        ].join('\n')
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        [
          'vec3 permute(vec3 x) {',
          '  return mod(((x * 34.0) + 1.0) * x, 289.0);',
          '}',
          'float snoise(vec2 v) {',
          '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
          '  vec2 i = floor(v + dot(v, C.yy));',
          '  vec2 x0 = v - i + dot(i, C.xx);',
          '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
          '  vec4 x12 = x0.xyxy + C.xxzz;',
          '  x12.xy -= i1;',
          '  i = mod(i, 289.0);',
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
          'float n = snoise(vUv * 5.0 + uTime / 40.0) + snoise(vUv * 10.0 + uTime / 30.0);',
          'float cloud = smoothstep(0.2, 0.8, 0.5 * n + 0.4);',
          // The demo fades clouds with distance so the plane reads like a sky
          // layer instead of an obvious quad.
          'diffuseColor = vec4(1.0, 1.0, 1.0, cloud * opacity / (0.01 * length(vWorldPosition)));',
        ].join('\n')
      );

      material.userData.shader = shader;
    };

    material.needsUpdate = true;
  }, [size]);

  useFrame((state) => {
    const shader = materialRef.current?.userData.shader as ShaderWithUniforms | undefined;
    if (!shader) return;
    shader.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial ref={materialRef} transparent opacity={0.9} fog map={null} />
    </mesh>
  );
};

export default LabClouds;

