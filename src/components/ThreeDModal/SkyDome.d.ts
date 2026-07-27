import type { Color, Vector3 } from 'three';
interface SkyDomeProps {
    sunDirection: Vector3;
    biomeId: string;
    tint: Color;
    visible: boolean;
}
declare const SkyDome: ({ sunDirection, biomeId, tint, visible }: SkyDomeProps) => import("react").JSX.Element;
export default SkyDome;
