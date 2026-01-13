import { useMemo, useEffect } from 'react';
import type { Color, Vector3 } from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

interface SkyDomeProps {
  sunDirection: Vector3;
  biomeId: string;
  tint: Color;
  visible: boolean;
}

const getSkySettings = (biomeId: string) => {
  switch (biomeId) {
    case 'desert':
      return { turbidity: 8, rayleigh: 1.4, mieCoefficient: 0.01, mieDirectionalG: 0.76 };
    case 'forest':
      return { turbidity: 4.5, rayleigh: 1.9, mieCoefficient: 0.008, mieDirectionalG: 0.72 };
    case 'ocean':
      return { turbidity: 5.5, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.7 };
    case 'swamp':
      return { turbidity: 7.5, rayleigh: 1.2, mieCoefficient: 0.02, mieDirectionalG: 0.82 };
    default:
      return { turbidity: 4.2, rayleigh: 1.8, mieCoefficient: 0.006, mieDirectionalG: 0.7 };
  }
};

const SkyDome = ({ sunDirection, biomeId, tint, visible }: SkyDomeProps) => {
  const sky = useMemo(() => {
    const dome = new Sky();
    dome.scale.setScalar(20000);
    return dome;
  }, []);

  useEffect(() => {
    const uniforms = sky.material.uniforms;
    const settings = getSkySettings(biomeId);
    uniforms.turbidity.value = settings.turbidity;
    uniforms.rayleigh.value = settings.rayleigh;
    uniforms.mieCoefficient.value = settings.mieCoefficient;
    uniforms.mieDirectionalG.value = settings.mieDirectionalG;
    uniforms.sunPosition.value.copy(sunDirection.clone().multiplyScalar(10000));

    const hsl = { h: 0, s: 0, l: 0 };
    tint.getHSL(hsl);
    sky.material.uniforms.rayleigh.value = settings.rayleigh + hsl.l * 0.3;
  }, [biomeId, sky, sunDirection, tint]);

  if (!visible) return null;

  return <primitive object={sky} />;
};

export default SkyDome;
