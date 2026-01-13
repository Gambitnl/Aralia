import { Color, Vector3 } from 'three';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseRgba = (rgba: string | undefined, fallback = '#1f2937'): Color => {
  if (!rgba) return new Color(fallback);
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return new Color(fallback);
  const [r, g, b] = match.slice(1, 4).map((channel) => Number.parseInt(channel, 10));
  return new Color(r / 255, g / 255, b / 255);
};

const getFogDensity = (biomeId: string | null | undefined): number => {
  const base = 0.00035;
  switch (biomeId) {
    case 'swamp':
      return base * 3.5;
    case 'forest':
      return base * 2.2;
    case 'desert':
      return base * 0.8;
    case 'ocean':
      return base * 1.6;
    case 'cave':
    case 'dungeon':
      return base * 4.5;
    default:
      return base;
  }
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

  const sunIntensity = 0.25 + sunStrength * 0.95;
  const ambientIntensity = 0.18 + sunStrength * 0.5;
  const fogColor = dayFog.lerp(nightFog, nightStrength);
  const fogDensity = getFogDensity(biomeId);

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
  };
};
