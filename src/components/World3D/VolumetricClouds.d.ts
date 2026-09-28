/**
 * @file VolumetricClouds.d.ts
 * @description Physically-based volumetric clouds hosted inside the scene post
 * chain (see VolumetricClouds.tsx for the full design contract).
 */
import type { CloudsQualityPreset } from '@takram/three-clouds';
declare const VolumetricClouds: React.FC<{
    timeOfDayHours?: number;
    /** 0–1 cloud density, forwarded to Clouds.coverage. */
    cloudCoverage?: number;
    /** Takram quality preset — 'low' during development; 'high' for screenshots. */
    qualityPreset?: CloudsQualityPreset;
}>;
export default VolumetricClouds;
