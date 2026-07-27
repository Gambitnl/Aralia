import type { Color, Vector3 } from 'three';
interface EnhancedSkyDomeProps {
    sunDirection: Vector3;
    biomeId: string;
    tint: Color;
    visible: boolean;
    gameTime: Date;
    cloudCoverage?: number;
    windSpeed?: number;
}
declare const EnhancedSkyDome: ({ sunDirection, biomeId, tint, visible, gameTime, cloudCoverage, windSpeed }: EnhancedSkyDomeProps) => import("react").JSX.Element;
export default EnhancedSkyDome;
