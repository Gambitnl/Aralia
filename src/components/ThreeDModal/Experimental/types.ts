export type EnvironmentalEffectType = 'fire' | 'grease' | 'ice' | 'water' | 'fog';

export interface EnvironmentalOverlay {
  id: string;
  type: EnvironmentalEffectType;
  x: number;
  z: number;
  radius: number; // For circular effects
  duration?: number; // In rounds/seconds
  intensity: number; // 0-1 for visualization
}

// Register custom element for TS/JSX globally
declare global {
  namespace JSX {
    interface IntrinsicElements {
      biomeShaderMaterial: any;
    }
  }
}
