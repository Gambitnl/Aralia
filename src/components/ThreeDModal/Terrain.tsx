import type { Color, MeshStandardMaterial } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color as ThreeColor, PlaneGeometry } from 'three';

interface TerrainProps {
  size: number;
  heightSampler: (x: number, z: number) => number;
  slopeSampler: (x: number, z: number) => number;
  moistureSampler: (x: number, z: number) => number;
  color: Color;
  showGrid: boolean;
  gridSizeFt?: number;
  heightRange?: { min: number; max: number };
  heightColors?: { low: Color; mid: Color; high: Color };
}

const Terrain = ({
  size,
  heightSampler,
  slopeSampler,
  moistureSampler,
  color,
  showGrid,
  gridSizeFt = 5,
  heightRange,
  heightColors,
}: TerrainProps) => {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const slopeTint = useMemo(
    () => new ThreeColor(0x6b7280).lerp(new ThreeColor(color), 0.2),
    [color]
  );
  const moistureTint = useMemo(
    () => new ThreeColor(0x166534).lerp(new ThreeColor(color), 0.35),
    [color]
  );
  const geometry = useMemo(() => {
    const segments = Math.max(64, Math.round(size / 40));
    const next = new PlaneGeometry(size, size, segments, segments);
    const positions = next.attributes.position;
    const slopeValues = new Float32Array(positions.count);
    const moistureValues = new Float32Array(positions.count);
    let slopeMax = 0;

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const height = heightSampler(x, z);
      const slope = slopeSampler(x, z);
      positions.setZ(i, height);
      slopeValues[i] = slope;
      moistureValues[i] = moistureSampler(x, z);
      if (slope > slopeMax) slopeMax = slope;
    }

    const slopeScale = slopeMax > 0 ? 1 / slopeMax : 1;
    for (let i = 0; i < slopeValues.length; i += 1) {
      slopeValues[i] = Math.min(slopeValues[i] * slopeScale, 1);
    }

    next.setAttribute('slope', new BufferAttribute(slopeValues, 1));
    next.setAttribute('moisture', new BufferAttribute(moistureValues, 1));
    positions.needsUpdate = true;
    next.computeVertexNormals();
    return next;
  }, [heightSampler, moistureSampler, size, slopeSampler]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.gridSize = { value: gridSizeFt };
      shader.uniforms.gridOpacity = { value: 0.6 };
      shader.uniforms.gridColor = { value: new ThreeColor(0x64748b) };
      shader.uniforms.gridFadeStart = { value: 1200 };
      shader.uniforms.gridFadeEnd = { value: 2600 };
      shader.uniforms.gridEnabled = { value: showGrid ? 1 : 0 };
      shader.uniforms.heightMin = { value: heightRange?.min ?? -60 };
      shader.uniforms.heightMax = { value: heightRange?.max ?? 160 };
      shader.uniforms.lowColor = { value: new ThreeColor(heightColors?.low ?? color).multiplyScalar(0.7) };
      shader.uniforms.midColor = { value: new ThreeColor(heightColors?.mid ?? color).multiplyScalar(0.95) };
      shader.uniforms.highColor = { value: new ThreeColor(heightColors?.high ?? color).lerp(new ThreeColor(0xffffff), 0.25) };
      shader.uniforms.slopeColor = { value: slopeTint.clone() };
      shader.uniforms.moistureColor = { value: moistureTint.clone() };
      shader.uniforms.slopeStrength = { value: 0.65 };
      shader.uniforms.moistureStrength = { value: 0.4 };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'attribute float slope;',
          'attribute float moisture;',
          'varying vec3 vWorldPosition;',
          'varying float vSlope;',
          'varying float vMoisture;',
        ].join('\n')
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vWorldPosition = worldPosition.xyz;',
          'vSlope = slope;',
          'vMoisture = moisture;',
        ].join('\n')
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vWorldPosition;',
          'varying float vSlope;',
          'varying float vMoisture;',
          'uniform float gridSize;',
          'uniform float gridOpacity;',
          'uniform vec3 gridColor;',
          'uniform float gridFadeStart;',
          'uniform float gridFadeEnd;',
          'uniform float gridEnabled;',
          'uniform float heightMin;',
          'uniform float heightMax;',
          'uniform vec3 lowColor;',
          'uniform vec3 midColor;',
          'uniform vec3 highColor;',
          'uniform vec3 slopeColor;',
          'uniform vec3 moistureColor;',
          'uniform float slopeStrength;',
          'uniform float moistureStrength;',
          'float gridLine(vec2 coord, float scale) {',
          '  vec2 grid = coord / scale;',
          '  vec2 gridDeriv = fwidth(grid);',
          '  vec2 gridMod = abs(fract(grid - 0.5) - 0.5) / gridDeriv;',
          '  float line = 1.0 - min(min(gridMod.x, gridMod.y), 1.0);',
          '  return line;',
          '}',
        ].join('\n')
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        [
          'float heightRange = max(heightMax - heightMin, 0.001);',
          'float heightT = clamp((vWorldPosition.y - heightMin) / heightRange, 0.0, 1.0);',
          'vec3 heightColor = mix(lowColor, midColor, smoothstep(0.0, 0.6, heightT));',
          'heightColor = mix(heightColor, highColor, smoothstep(0.55, 1.0, heightT));',
          'float slopeT = smoothstep(0.15, 0.7, vSlope);',
          'vec3 slopeTint = mix(heightColor, slopeColor, slopeT * slopeStrength);',
          'float moistureT = smoothstep(0.1, 0.9, vMoisture);',
          'vec3 moistureTint = mix(slopeTint, moistureColor, moistureT * moistureStrength);',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, moistureTint, 0.8);',
          '#include <dithering_fragment>',
          'if (gridEnabled > 0.5) {',
          '  float dist = distance(cameraPosition, vWorldPosition);',
          '  float fade = smoothstep(gridFadeEnd, gridFadeStart, dist);',
          '  float line = gridLine(vWorldPosition.xz, gridSize);',
          '  float gridMask = line * fade;',
          '  gl_FragColor.rgb = mix(gl_FragColor.rgb, gridColor, gridMask * gridOpacity);',
          '}',
        ].join('\n')
      );

      material.userData.shader = shader;
    };

    material.needsUpdate = true;
  }, [gridSizeFt]);

  useEffect(() => {
    const material = materialRef.current;
    const shader = material?.userData.shader;
    if (!shader) return;
    shader.uniforms.gridEnabled.value = showGrid ? 1 : 0;
    shader.uniforms.gridSize.value = gridSizeFt;
    shader.uniforms.heightMin.value = heightRange?.min ?? shader.uniforms.heightMin.value;
    shader.uniforms.heightMax.value = heightRange?.max ?? shader.uniforms.heightMax.value;
    if (heightColors) {
      shader.uniforms.lowColor.value.set(heightColors.low);
      shader.uniforms.midColor.value.set(heightColors.mid);
      shader.uniforms.highColor.value.set(heightColors.high);
    }
    if (shader.uniforms.slopeColor) shader.uniforms.slopeColor.value.set(slopeTint);
    if (shader.uniforms.moistureColor) shader.uniforms.moistureColor.value.set(moistureTint);
  }, [gridSizeFt, heightColors, heightRange, moistureTint, showGrid, slopeTint]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial ref={materialRef} color={color} roughness={0.92} metalness={0.05} />
    </mesh>
  );
};

export default Terrain;
