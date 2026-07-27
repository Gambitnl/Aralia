import type { MutableRefObject, RefObject } from 'react';
import type { Mesh, Object3D } from 'three';
interface PartyUnitProps {
    playerRef: RefObject<Object3D | Mesh | null>;
    positionsRef: MutableRefObject<Array<{
        x: number;
        y: number;
        z: number;
    } | null>>;
    unitIndex: number;
    offset: {
        x: number;
        z: number;
    };
    heightSampler: (x: number, z: number) => number;
    submapHalfSize: number;
    showOutline: boolean;
    playerSpeed: number;
    enemyPositions: Array<{
        x: number;
        z: number;
    }>;
    behaviorMode: 'explore' | 'combat';
    preferredRange: number;
    bodyColor?: number;
    outlineColor?: number;
}
declare const PartyUnit: ({ playerRef, positionsRef, unitIndex, offset, heightSampler, submapHalfSize, showOutline, playerSpeed, enemyPositions, behaviorMode, preferredRange, bodyColor, outlineColor, }: PartyUnitProps) => import("react").JSX.Element;
export default PartyUnit;
