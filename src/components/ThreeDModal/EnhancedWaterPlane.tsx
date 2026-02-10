import type { Color } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EnhancedWaterPlaneProps {
  size: number;
  level: number;
  color: Color;
  opacity?: number;
  waveIntensity?: number;     // Wave animation intensity (0-1)
  gameTime?: Date;
}

const EnhancedWaterPlane = ({ 
  size, 
  level, 
  color, 
  opacity = 0.7,
  waveIntensity = 0.3,
  gameTime = new Date()
}: EnhancedWaterPlaneProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Calculate time-based animation factors
  const timeValue = useMemo(() => {
    const seconds = gameTime.getSeconds();
    const milliseconds = gameTime.getMilliseconds();
    return seconds + milliseconds / 1000;
  }, [gameTime]);

  // Create enhanced water material with shader-based waves
  const material = useMemo(() => {
    const waterMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.1,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    // Add wave animation through shader modification
    waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.waveIntensity = { value: waveIntensity };

      // Add vertex shader modifications for wave displacement
      shader.vertexShader = `
        uniform float time;
        uniform float waveIntensity;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          float wave1 = sin(position.x * 0.02 + time * 2.0) * cos(position.z * 0.015 + time * 1.5);
          float wave2 = sin(position.x * 0.01 + time * 1.2) * cos(position.z * 0.025 + time * 1.8);
          float wave3 = sin(position.x * 0.03 + time * 3.0) * sin(position.z * 0.02 + time * 2.5);
          transformed.y += (wave1 + wave2 * 0.7 + wave3 * 0.3) * waveIntensity * 3.0;
        `
      );

      materialRef.current!.userData.shader = shader;
    };

    return waterMaterial;
  }, [color, opacity, waveIntensity]);

  // Create geometry with higher resolution for better wave detail
  const geometry = useMemo(() => {
    const segments = Math.max(32, Math.round(size / 20));
    return new THREE.PlaneGeometry(size, size, segments, segments);
  }, [size]);

  // Animation loop for wave motion
  useFrame((_, delta) => {
    if (materialRef.current && materialRef.current.userData.shader) {
      materialRef.current.userData.shader.uniforms.time.value += delta;
    }
  });

  // Update material properties when props change
  useEffect(() => {
    if (material) {
      material.color.set(color);
      material.opacity = opacity;
    }
  }, [material, color, opacity]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh 
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, level, 0]} 
      receiveShadow
      castShadow
    >
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
  );
};

export default EnhancedWaterPlane;