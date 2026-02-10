import { useMemo, useEffect, useRef } from 'react';
import type { Color, Vector3 } from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EnhancedSkyDomeProps {
  sunDirection: Vector3;
  biomeId: string;
  tint: Color;
  visible: boolean;
  gameTime: Date;
  cloudCoverage?: number; // 0-1 scale for cloud density
  windSpeed?: number;    // Wind speed affecting cloud movement
}

// Enhanced sky settings with more detailed atmospheric parameters
const getEnhancedSkySettings = (biomeId: string, timeOfDay: number) => {
  // Time of day factor (0 = midnight, 0.5 = noon, 1 = midnight)
  const dayFactor = Math.sin(timeOfDay * Math.PI);
  const nightFactor = 1 - dayFactor;

  switch (biomeId) {
    case 'desert':
      return {
        turbidity: 6 + dayFactor * 4,
        rayleigh: 1.2 + nightFactor * 0.8,
        mieCoefficient: 0.005 + nightFactor * 0.015,
        mieDirectionalG: 0.7 + nightFactor * 0.1,
        brightness: 1.2 + dayFactor * 0.3
      };
    case 'forest':
      return {
        turbidity: 3.5 + nightFactor * 2,
        rayleigh: 2.1 + nightFactor * 0.5,
        mieCoefficient: 0.008 + nightFactor * 0.012,
        mieDirectionalG: 0.72 + nightFactor * 0.08,
        brightness: 0.9 + dayFactor * 0.4
      };
    case 'ocean':
      return {
        turbidity: 4.5 + nightFactor * 3,
        rayleigh: 2.6 + nightFactor * 0.8,
        mieCoefficient: 0.004 + nightFactor * 0.02,
        mieDirectionalG: 0.68 + nightFactor * 0.12,
        brightness: 1.3 + dayFactor * 0.4
      };
    case 'swamp':
      return {
        turbidity: 8 + nightFactor * 2,
        rayleigh: 1.0 + nightFactor * 0.8,
        mieCoefficient: 0.025 + nightFactor * 0.03,
        mieDirectionalG: 0.85 + nightFactor * 0.05,
        brightness: 0.7 + dayFactor * 0.5
      };
    case 'mountain':
      return {
        turbidity: 2.5 + nightFactor * 2,
        rayleigh: 2.8 + nightFactor * 0.6,
        mieCoefficient: 0.003 + nightFactor * 0.01,
        mieDirectionalG: 0.65 + nightFactor * 0.15,
        brightness: 1.1 + dayFactor * 0.5
      };
    default:
      return {
        turbidity: 4.0 + nightFactor * 2,
        rayleigh: 1.9 + nightFactor * 0.5,
        mieCoefficient: 0.006 + nightFactor * 0.014,
        mieDirectionalG: 0.7 + nightFactor * 0.1,
        brightness: 1.0 + dayFactor * 0.4
      };
  }
};

// Cloud configuration based on biome and weather
const getCloudConfig = (biomeId: string, cloudCoverage: number) => {
  switch (biomeId) {
    case 'desert':
      return {
        count: Math.floor(cloudCoverage * 8), // Fewer clouds in desert
        size: 800 + Math.random() * 400,
        opacity: 0.3 + cloudCoverage * 0.4,
        speed: 0.2 + Math.random() * 0.3
      };
    case 'forest':
      return {
        count: Math.floor(cloudCoverage * 20), // More broken clouds
        size: 400 + Math.random() * 300,
        opacity: 0.4 + cloudCoverage * 0.5,
        speed: 0.1 + Math.random() * 0.2
      };
    case 'ocean':
      return {
        count: Math.floor(cloudCoverage * 15),
        size: 1000 + Math.random() * 600,
        opacity: 0.5 + cloudCoverage * 0.4,
        speed: 0.3 + Math.random() * 0.4
      };
    case 'swamp':
      return {
        count: Math.floor(cloudCoverage * 12),
        size: 600 + Math.random() * 400,
        opacity: 0.6 + cloudCoverage * 0.3,
        speed: 0.05 + Math.random() * 0.15
      };
    default:
      return {
        count: Math.floor(cloudCoverage * 12),
        size: 500 + Math.random() * 400,
        opacity: 0.4 + cloudCoverage * 0.4,
        speed: 0.15 + Math.random() * 0.25
      };
  }
};

const EnhancedSkyDome = ({
  sunDirection,
  biomeId,
  tint,
  visible,
  gameTime,
  cloudCoverage = 0.5,
  windSpeed = 1.0
}: EnhancedSkyDomeProps) => {
  const skyRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh[]>([]);

  // Calculate time of day (0-1 cycle)
  const timeOfDay = useMemo(() => {
    const hours = gameTime.getHours();
    const minutes = gameTime.getMinutes();
    return (hours + minutes / 60) / 24;
  }, [gameTime]);

  const skySettings = useMemo(() =>
    getEnhancedSkySettings(biomeId, timeOfDay),
    [biomeId, timeOfDay]
  );

  const cloudConfig = useMemo(() =>
    getCloudConfig(biomeId, cloudCoverage),
    [biomeId, cloudCoverage]
  );

  // Create enhanced sky dome
  const sky = useMemo(() => {
    const dome = new Sky();
    dome.scale.setScalar(25000); // Larger scale for better cloud integration
    return dome;
  }, []);

  // Create dynamic cloud system
  const clouds = useMemo(() => {
    const cloudArray: THREE.Mesh[] = [];
    const cloudGeometry = new THREE.SphereGeometry(1, 8, 6);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: cloudConfig.opacity
    });

    for (let i = 0; i < cloudConfig.count; i++) {
      const cloud = new THREE.Mesh(cloudGeometry.clone(), cloudMaterial.clone());
      cloud.scale.set(
        cloudConfig.size * (0.7 + Math.random() * 0.6),
        cloudConfig.size * (0.3 + Math.random() * 0.4),
        cloudConfig.size * (0.7 + Math.random() * 0.6)
      );
      cloud.position.set(
        (Math.random() - 0.5) * 15000,
        3000 + Math.random() * 2000,
        (Math.random() - 0.5) * 15000
      );
      cloud.rotation.y = Math.random() * Math.PI * 2;
      cloudArray.push(cloud);
    }
    return cloudArray;
  }, [cloudConfig.count, cloudConfig.size, cloudConfig.opacity]);

  // Update sky parameters
  useEffect(() => {
    if (!skyRef.current) return;

    const uniforms = (skyRef.current.material as THREE.ShaderMaterial).uniforms;
    uniforms.turbidity.value = skySettings.turbidity;
    uniforms.rayleigh.value = skySettings.rayleigh;
    uniforms.mieCoefficient.value = skySettings.mieCoefficient;
    uniforms.mieDirectionalG.value = skySettings.mieDirectionalG;
    uniforms.sunPosition.value.copy(sunDirection.clone().multiplyScalar(10000));

    // Apply biome tint adjustments
    const hsl = { h: 0, s: 0, l: 0 };
    tint.getHSL(hsl);
    uniforms.rayleigh.value = skySettings.rayleigh + hsl.l * 0.4;
  }, [skySettings, sunDirection, tint]);

  // Update cloud properties
  useEffect(() => {
    clouds.forEach((cloud) => {
      const material = cloud.material as THREE.MeshBasicMaterial;
      if (material) {
        material.opacity = cloudConfig.opacity;
        material.color.copy(tint);
      }
    });
  }, [clouds, cloudConfig.opacity, tint]);

  // Animate clouds
  useFrame((_, delta) => {
    if (!visible) return;

    clouds.forEach((cloud) => {
      // Move clouds with wind
      cloud.position.x += delta * cloudConfig.speed * windSpeed * 20;
      cloud.position.z += delta * cloudConfig.speed * windSpeed * 10;

      // Wrap clouds around the scene
      if (cloud.position.x > 10000) cloud.position.x -= 20000;
      if (cloud.position.x < -10000) cloud.position.x += 20000;
      if (cloud.position.z > 10000) cloud.position.z -= 20000;
      if (cloud.position.z < -10000) cloud.position.z += 20000;

      // Gentle rotation for natural movement
      cloud.rotation.y += delta * 0.05 * cloudConfig.speed;
    });
  });

  // Cleanup
  useEffect(() => {
    return () => {
      clouds.forEach(cloud => {
        if (cloud.geometry) cloud.geometry.dispose();
        if (cloud.material) {
          const material = cloud.material as THREE.Material;
          material.dispose();
        }
      });
    };
  }, [clouds]);

  if (!visible) return null;

  return (
    <>
      <primitive object={sky} ref={skyRef} />
      {clouds.map((cloud, index) => (
        <primitive key={index} object={cloud} />
      ))}
    </>
  );
};

export default EnhancedSkyDome;