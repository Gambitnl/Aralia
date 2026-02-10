export interface ScatterRule {
  id: string;
  assetType: 'tree' | 'rock' | 'grass';
  preset?: string;
  density: number;
  minSlope?: number;
  maxSlope?: number;
  minHeight?: number;
  maxHeight?: number;
  scaleMean: number;
  scaleVar: number;
  clusterScale?: number;
  clusterThreshold?: number;
}

export interface BiomeDNA {
  id: string;
  name: string;
  descriptor: string;
  primaryColor: string;
  secondaryColor: string;
  roughness: number;
  scatter: ScatterRule[];

  waterColor?: string;
  waterClarity?: number;
  waveIntensity?: number;
  fogDensity?: number;
  fogHeight?: number;

  weatherType?: 'clear' | 'rain' | 'snow' | 'ash' | 'spores';
  weatherIntensity?: number;
  windSpeed?: [number, number];
}

