import type { Color } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color as ThreeColor, PlaneGeometry } from 'three';

interface TextureSplattingProps {
  size: number;
  heightSampler: (x: number, z: number) => number;
  moistureSampler: (x: number, z: number) => number;
  slopeSampler?: (x: number, z: number) => number;
  featureSampler?: (x: number, z: number) => { path: number; river: number; clearing: number };
  color: Color;
  showGrid: boolean;
  gridSizeFt?: number;
  heightRange?: { min: number; max: number };
  heightColors?: { low: Color; mid: Color; high: Color };
  biomeId: string;
  textureScale?: number;
}

type ShaderWithUniforms = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

// Biome-specific texture blending weights
const getBiomeTextureWeights = (biomeId: string) => {
  const base = {
    grassWeight: 0,
    dirtWeight: 0,
    mossWeight: 0,
    sandWeight: 0,
    mudWeight: 0,
    rockWeight: 0,
  };

  switch (biomeId) {
    case 'forest':
      return {
        ...base,
        grassWeight: 0.6,
        dirtWeight: 0.3,
        mossWeight: 0.1,
      };
    case 'desert':
      return {
        ...base,
        grassWeight: 0.1,
        dirtWeight: 0.7,
        sandWeight: 0.2,
      };
    case 'swamp':
      return {
        ...base,
        grassWeight: 0.3,
        dirtWeight: 0.4,
        mudWeight: 0.3,
      };
    case 'mountain':
      return {
        ...base,
        grassWeight: 0.4,
        dirtWeight: 0.4,
        rockWeight: 0.2,
      };
    default:
      return {
        ...base,
        grassWeight: 0.5,
        dirtWeight: 0.3,
        rockWeight: 0.2,
      };
  }
};

const TextureSplatting = ({
  size,
  heightSampler,
  moistureSampler,
  slopeSampler,
  featureSampler,
  color,
  showGrid,
  gridSizeFt = 5,
  heightRange,
  heightColors,
  biomeId,
  textureScale = 1.0
}: TextureSplattingProps) => {
  const materialRef = useRef<any>(null);
  const textureWeights = useMemo(() => getBiomeTextureWeights(biomeId), [biomeId]);
  
  const slopeTint = useMemo(
    () => new ThreeColor(0x6b7280).lerp(new ThreeColor(color), 0.2),
    [color]
  );
  const moistureTint = useMemo(
    () => new ThreeColor(0x166534).lerp(new ThreeColor(color), 0.35),
    [color]
  );
  
  const geometry = useMemo(() => {
    const segments = Math.max(128, Math.round(size / 20));
    const step = size / segments;
    const stride = segments + 1;
    const next = new PlaneGeometry(size, size, segments, segments);
    const positions = next.attributes.position;
    const heights = new Float32Array(positions.count);
    const slopeValues = new Float32Array(positions.count);
    const moistureValues = new Float32Array(positions.count);
    const pathValues = new Float32Array(positions.count);
    const riverValues = new Float32Array(positions.count);
    const clearingValues = new Float32Array(positions.count);
    let slopeMax = 0;

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const height = heightSampler(x, z);
      heights[i] = height;
      positions.setZ(i, height);
      moistureValues[i] = moistureSampler(x, z);
      
      if (featureSampler) {
        const features = featureSampler(x, z);
        pathValues[i] = features.path;
        riverValues[i] = features.river;
        clearingValues[i] = features.clearing;
      }
    }

    // Compute slope either from sampler or from height grid
    if (slopeSampler) {
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const z = positions.getY(i);
        slopeValues[i] = slopeSampler(x, z);
        if (slopeValues[i] > slopeMax) slopeMax = slopeValues[i];
      }
    } else {
      // Compute slope from the height grid directly
      for (let iz = 0; iz < stride; iz += 1) {
        for (let ix = 0; ix < stride; ix += 1) {
          const i = ix + iz * stride;
          const iL = ix > 0 ? i - 1 : i;
          const iR = ix < stride - 1 ? i + 1 : i;
          const iD = iz > 0 ? i - stride : i;
          const iU = iz < stride - 1 ? i + stride : i;
          const dhdx = (heights[iR] - heights[iL]) / (ix > 0 && ix < stride - 1 ? 2 * step : step);
          const dhdz = (heights[iU] - heights[iD]) / (iz > 0 && iz < stride - 1 ? 2 * step : step);
          const slope = Math.sqrt(dhdx * dhdx + dhdz * dhdz);
          slopeValues[i] = slope;
          if (slope > slopeMax) slopeMax = slope;
        }
      }
    }

    const slopeScale = slopeMax > 0 ? 1 / slopeMax : 1;
    for (let i = 0; i < slopeValues.length; i += 1) {
      slopeValues[i] = Math.min(slopeValues[i] * slopeScale, 1);
    }

    next.setAttribute('slope', new BufferAttribute(slopeValues, 1));
    next.setAttribute('moisture', new BufferAttribute(moistureValues, 1));
    next.setAttribute('path', new BufferAttribute(pathValues, 1));
    next.setAttribute('river', new BufferAttribute(riverValues, 1));
    next.setAttribute('clearing', new BufferAttribute(clearingValues, 1));
    positions.needsUpdate = true;
    next.computeVertexNormals();
    return next;
  }, [heightSampler, moistureSampler, slopeSampler, featureSampler, size]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader: ShaderWithUniforms) => {
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
      shader.uniforms.textureScale = { value: textureScale };
      
      // Texture blending weights
      shader.uniforms.grassWeight = { value: textureWeights.grassWeight };
      shader.uniforms.dirtWeight = { value: textureWeights.dirtWeight };
      shader.uniforms.mossWeight = { value: textureWeights.mossWeight };
      shader.uniforms.sandWeight = { value: textureWeights.sandWeight };
      shader.uniforms.mudWeight = { value: textureWeights.mudWeight };
      shader.uniforms.rockWeight = { value: textureWeights.rockWeight };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'attribute float slope;',
          'attribute float moisture;',
          'attribute float path;',
          'attribute float river;',
          'attribute float clearing;',
          'varying vec3 vWorldPosition;',
          'varying float vSlope;',
          'varying float vMoisture;',
          'varying float vPath;',
          'varying float vRiver;',
          'varying float vClearing;',
          'varying vec3 vNormal;',
          'varying vec2 vUv;',
        ].join('\n')
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vWorldPosition = worldPosition.xyz;',
          'vSlope = slope;',
          'vMoisture = moisture;',
          'vPath = path;',
          'vRiver = river;',
          'vClearing = clearing;',
          'vNormal = normalize(normalMatrix * normal);',
          'vUv = uv;',
        ].join('\n')
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vWorldPosition;',
          'varying float vSlope;',
          'varying float vMoisture;',
          'varying float vPath;',
          'varying float vRiver;',
          'varying float vClearing;',
          'varying vec3 vNormal;',
          'varying vec2 vUv;',
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
          'uniform float textureScale;',
          'uniform float grassWeight;',
          'uniform float dirtWeight;',
          'uniform float mossWeight;',
          'uniform float sandWeight;',
          'uniform float mudWeight;',
          'uniform float rockWeight;',
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
          '// Calculate texture blend weights based on terrain properties',
          'float heightRange = max(heightMax - heightMin, 0.001);',
          'float heightT = clamp((vWorldPosition.y - heightMin) / heightRange, 0.0, 1.0);',
          
          '// Base terrain color mixing',
          'vec3 heightColor = mix(lowColor, midColor, smoothstep(0.0, 0.6, heightT));',
          'heightColor = mix(heightColor, highColor, smoothstep(0.55, 1.0, heightT));',
          
          '// Slope and moisture effects',
          'float slopeT = smoothstep(0.15, 0.7, vSlope);',
          'vec3 slopeTint = mix(heightColor, slopeColor, slopeT * slopeStrength);',
          'float moistureT = smoothstep(0.1, 0.9, vMoisture);',
          'vec3 moistureTint = mix(slopeTint, moistureColor, moistureT * moistureStrength);',
          
          '// Feature-based texture blending',
          'float pathBlend = smoothstep(0.1, 0.6, vPath);',
          'float riverBlend = smoothstep(0.2, 0.8, vRiver);',
          'float clearingBlend = smoothstep(0.3, 0.9, vClearing);',
          
          '// Dynamic texture weights based on local conditions',
          'float grassFactor = (1.0 - vSlope * 0.8) * (0.7 + vMoisture * 0.3) * (1.0 - riverBlend);',
          'float dirtFactor = (0.5 + vSlope * 0.5) * (0.8 - vMoisture * 0.4) + pathBlend * 0.7;',
          'float mossFactor = vMoisture * (1.0 - vSlope * 0.5) * (1.0 - riverBlend);',
          'float sandFactor = (1.0 - vMoisture) * (0.7 + vSlope * 0.3);',
          'float mudFactor = vMoisture * riverBlend;',
          'float rockFactor = vSlope * (1.0 - clearingBlend);',
          
          '// Apply biome weights and normalize to keep energy consistent (avoid NaNs / washout).',
          'grassFactor *= grassWeight;',
          'dirtFactor *= dirtWeight;',
          'mossFactor *= mossWeight;',
          'sandFactor *= sandWeight;',
          'mudFactor *= mudWeight;',
          'rockFactor *= rockWeight;',
          'float totalWeight = grassFactor + dirtFactor + mossFactor + sandFactor + mudFactor + rockFactor;',
          'totalWeight = max(totalWeight, 0.0001);',
          'grassFactor = grassFactor / totalWeight;',
          'dirtFactor = dirtFactor / totalWeight;',
          'mossFactor = mossFactor / totalWeight;',
          'sandFactor = sandFactor / totalWeight;',
          'mudFactor = mudFactor / totalWeight;',
          'rockFactor = rockFactor / totalWeight;',
          
          '// Blend final color',
          'vec3 grassColor = vec3(0.3, 0.6, 0.2);',
          'vec3 dirtColor = vec3(0.5, 0.4, 0.3);',
          'vec3 mossColor = vec3(0.2, 0.5, 0.3);',
          'vec3 sandColor = vec3(0.8, 0.7, 0.5);',
          'vec3 mudColor = vec3(0.4, 0.3, 0.2);',
          'vec3 rockColor = vec3(0.6, 0.6, 0.6);',
          
          'vec3 blendedColor = grassFactor * grassColor +',
          '                    dirtFactor * dirtColor +',
          '                    mossFactor * mossColor +',
          '                    sandFactor * sandColor +',
          '                    mudFactor * mudColor +',
          '                    rockFactor * rockColor;',
          
          '// Apply to final color with base terrain influence',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, blendedColor, 0.7);',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, moistureTint, 0.3);',
          
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
  }, [gridSizeFt, textureWeights, textureScale]);

  useEffect(() => {
    const material = materialRef.current;
    const shader = material?.userData.shader;
    if (!shader) return;
    shader.uniforms.gridEnabled.value = showGrid ? 1 : 0;
    shader.uniforms.gridSize.value = gridSizeFt;
    shader.uniforms.heightMin.value = heightRange?.min ?? shader.uniforms.heightMin.value;
    shader.uniforms.heightMax.value = heightRange?.max ?? shader.uniforms.heightMax.value;
    shader.uniforms.textureScale.value = textureScale;
    
    if (heightColors) {
      shader.uniforms.lowColor.value.set(heightColors.low);
      shader.uniforms.midColor.value.set(heightColors.mid);
      shader.uniforms.highColor.value.set(heightColors.high);
    }
    if (shader.uniforms.slopeColor) shader.uniforms.slopeColor.value.set(slopeTint);
    if (shader.uniforms.moistureColor) shader.uniforms.moistureColor.value.set(moistureTint);
    
    // Update texture weights
    shader.uniforms.grassWeight.value = textureWeights.grassWeight;
    shader.uniforms.dirtWeight.value = textureWeights.dirtWeight;
    shader.uniforms.mossWeight.value = textureWeights.mossWeight;
    shader.uniforms.sandWeight.value = textureWeights.sandWeight;
    shader.uniforms.mudWeight.value = textureWeights.mudWeight;
    shader.uniforms.rockWeight.value = textureWeights.rockWeight;
  }, [gridSizeFt, heightColors, heightRange, moistureTint, showGrid, slopeTint, textureScale, textureWeights]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial 
        ref={materialRef} 
        color={color} 
        roughness={0.8}
        metalness={0.05}
        map={null} 
      />
    </mesh>
  );
};

export default TextureSplatting;
