import type { Color } from 'three';
interface WaterPlaneProps {
    size: number;
    level: number;
    color: Color;
    opacity?: number;
}
declare const WaterPlane: ({ size, level, color, opacity }: WaterPlaneProps) => import("react").JSX.Element;
export default WaterPlane;
