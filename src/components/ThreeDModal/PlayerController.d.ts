import type { RefObject } from 'react';
import type { Mesh } from 'three';
interface PlayerControllerProps {
    playerRef: RefObject<Mesh | null>;
    speedFeetPerRound: number;
    submapHalfSize: number;
    heightSampler: (x: number, z: number) => number;
    heightOffset?: number;
    onPositionChange?: (position: {
        x: number;
        y: number;
        z: number;
    }) => void;
    onSpeedChange?: (speedFeetPerRound: number) => void;
}
declare const PlayerController: ({ playerRef, speedFeetPerRound, submapHalfSize, heightSampler, heightOffset, onPositionChange, onSpeedChange, }: PlayerControllerProps) => any;
export default PlayerController;
