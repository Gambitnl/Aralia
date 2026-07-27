import type { Color } from 'three';
interface EnhancedWaterPlaneProps {
    size: number;
    level: number;
    color: Color;
    opacity?: number;
    waveIntensity?: number;
    gameTime?: Date;
}
declare const EnhancedWaterPlane: ({ size, level, color, opacity, waveIntensity, gameTime }: EnhancedWaterPlaneProps) => import("react").JSX.Element;
export default EnhancedWaterPlane;
