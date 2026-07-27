import type { Color } from 'three';
interface LabGroundProps {
    size: number;
    tint?: Color;
    noiseScale?: number;
    patchiness?: number;
}
declare const LabGround: ({ size, tint, noiseScale, patchiness }: LabGroundProps) => import("react").JSX.Element;
export default LabGround;
