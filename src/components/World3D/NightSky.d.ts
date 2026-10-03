/**
 * @file NightSky.tsx
 * @description Physically-based NIGHT sky for World3D (stars/moon/Bruneton
 * dome). Renders nothing above the horizon so the daytime path stays
 * byte-identical; see NightSky.tsx for the full contract.
 */
import React from 'react';
declare const NightSky: React.FC<{
    timeOfDayHours?: number;
}>;
export declare const NIGHT_SKY_SUN_Y: number;
export default NightSky;
