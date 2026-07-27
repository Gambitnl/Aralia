import { Color, Vector3 } from 'three';
export declare const getLightingForTime: (gameTime: Date, biomeId: string | null | undefined, biomeRgba?: string) => {
    sunColor: Color;
    ambientColor: Color;
    sunIntensity: number;
    ambientIntensity: number;
    fogColor: Color;
    fogDensity: number;
    sunDirection: Vector3;
    trueSunDirection: Vector3;
    biomeColor: Color;
    ambientOcclusion: {
        intensity: number;
        color: Color;
    };
};
