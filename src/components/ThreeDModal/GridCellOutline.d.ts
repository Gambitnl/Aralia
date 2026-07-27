import type { RefObject } from 'react';
import type { Mesh, Object3D } from 'three';
interface GridCellOutlineProps {
    playerRef: RefObject<Object3D | Mesh | null>;
    gridSize: number;
    heightSampler: (x: number, z: number) => number;
    color?: number;
    offset?: number;
    visible?: boolean;
}
declare const GridCellOutline: ({ playerRef, gridSize, heightSampler, color, offset, visible, }: GridCellOutlineProps) => import("react").JSX.Element;
export default GridCellOutline;
