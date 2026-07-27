import type { RefObject } from 'react';
import type { Mesh, Object3D } from 'three';
interface CameraRigProps {
    playerRef: RefObject<Object3D | Mesh | null>;
    maxDistance: number;
    minDistance?: number;
    /**
     * OrbitControls maxPolarAngle (radians). Polar angle 0 = camera directly above
     * target; π/2 = horizontal; >π/2 = camera below target (looks upward at sky).
     * Default Math.PI * 0.48 keeps camera above horizontal (normal gameplay).
     * Set to e.g. Math.PI * 0.85 in sky-debug modes to allow tilting up at clouds.
     */
    maxPolarAngle?: number;
    /**
     * Sky-cam mode: snaps the OrbitControls target to a point high in the sky
     * (above the player at skyCamAltitude units) so the camera can orbit around it
     * and look upward at volumetric clouds. Toggled from the Sky Lab debug panel.
     */
    skyCam?: boolean;
    /** Y-axis height for the sky-cam orbit target (default 400). */
    skyCamAltitude?: number;
    focusTarget?: {
        x: number;
        y: number;
        z: number;
    } | null;
    focusRequestId?: number;
    focusDistance?: number;
    lockOnFocus?: boolean;
}
declare const CameraRig: ({ playerRef, maxDistance, minDistance, maxPolarAngle, skyCam, skyCamAltitude, focusTarget, focusRequestId, focusDistance, lockOnFocus, }: CameraRigProps) => any;
export default CameraRig;
