import type { RefObject } from 'react';
import type { Mesh, Object3D } from 'three';
interface EnemyUnitProps {
    id: string;
    label: string;
    position: {
        x: number;
        z: number;
    };
    heightSampler: (x: number, z: number) => number;
    showOutline: boolean;
    playerRef?: RefObject<Object3D | Mesh | null>;
    isHovered?: boolean;
    isSelected?: boolean;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
    onSelect?: () => void;
    bodyColor?: number;
    outlineColor?: number;
}
declare const EnemyUnit: ({ id: _id, label: _label, position, heightSampler, showOutline, playerRef, isHovered, isSelected, onHoverStart, onHoverEnd, onSelect, bodyColor, outlineColor, }: EnemyUnitProps) => import("react").JSX.Element;
export default EnemyUnit;
