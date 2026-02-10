import { Color, Vector3 } from 'three';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseRgba = (rgba: string | undefined, fallback = '#1f2937'): Color => {
  if (!rgba) return new Color(fallback);
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return new Color(fallback);
  const [r, g, b] = match.slice(1, 4).map((channel) => Number.parseInt(channel, 10));
  return new Color(r / 255, g / 255, b / 255);
};

const getFogDensity = (biomeId: string | null | undefined, sunHeight: number): number => {
  const base = 0.00035;
  let density = base;
  
  switch (biomeId) {
    case 'swamp':
      density = base * 3.5;
      break;
    case 'forest':
      density = base * 2.2;
      break;
    case 'desert':
      density = base * 0.8;
      break;
    case 'ocean':
      density = base * 1.6;
      break;
    case 'cave':
    case 'dungeon':
      density = base * 4.5;
      break;
    default:
      density = base;
  }
  
  // Modulate fog density based on time of day
  // More fog at dawn/dusk, less during midday
  const timeModulation = 0.7 + 0.6 * Math.abs(sunHeight);
  return density * timeModulation;
};

export const getLightingForTime = (gameTime: Date, biomeId: string | null | undefined, biomeRgba?: string) => {
  const hours = gameTime.getHours() + gameTime.getMinutes() / 60 + gameTime.getSeconds() / 3600;
  const dayProgress = hours / 24;
  const sunAngle = (dayProgress - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  const sunStrength = clamp01(sunHeight);
  const nightStrength = clamp01(-sunHeight);

  const warmBlend = clamp01(1 - Math.abs(sunHeight));
  const biomeColor = parseRgba(biomeRgba);
  const dayFog = biomeColor.clone().lerp(new Color(0xbfd4ff), 0.25);
  const nightFog = biomeColor.clone().lerp(new Color(0x080b16), 0.65);

  const sunColor = new Color(0xfff3d6).lerp(new Color(0xffb37a), warmBlend);
  const ambientColor = new Color(0xbcc8e3).lerp(new Color(0x1b2233), nightStrength * 0.8);

  // Enhanced lighting with ambient occlusion simulation
  const sunIntensity = 0.25 + sunStrength * 0.95;
  const ambientIntensity = 0.18 + sunStrength * 0.5;
  
  // Simulate ambient occlusion based on time of day
  const ambientOcclusion = {
    intensity: 0.3 + nightStrength * 0.4, // Stronger AO at night
    color: new Color(0x1a1a2e).lerp(new Color(0x3a3a4a), sunStrength)
  };

  const fogColor = dayFog.lerp(nightFog, nightStrength);
  const fogDensity = getFogDensity(biomeId, sunHeight);

  const sunDirection = new Vector3(
    Math.cos(sunAngle),
    Math.max(0.15, sunHeight + 0.25),
    Math.sin(sunAngle)
  ).normalize();

  return {
    sunColor,
    ambientColor,
    sunIntensity,
    ambientIntensity,
    fogColor,
    fogDensity,
    sunDirection,
    biomeColor,
    ambientOcclusion // New AO properties
  };
};
