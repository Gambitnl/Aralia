import type { Vector3 } from 'three';
import type { CloudsQualityPreset } from '@takram/three-clouds';
interface TakramSkySystemProps {
    /** Aralia's computed sun direction (normalised). */
    sunDirection: Vector3;
    /** Hides all sky rendering without unmounting (e.g. cave/dungeon biomes). */
    visible?: boolean;
    /** 0–1 cloud density. Forwarded to Clouds.coverage. */
    cloudCoverage?: number;
    /** Takram quality preset — use 'low' during development; 'high' for screenshots. */
    qualityPreset?: CloudsQualityPreset;
    /** Show stars at night. */
    starsEnabled?: boolean;
    /** Show a procedural moon opposite the sun. */
    moonEnabled?: boolean;
    /**
     * correctAltitude — moves the Bruneton camera position from the WGS84 surface
     * (~6378 km) down to the Bruneton bottomRadius (~6360 km).
     * Default true; set false to debug "stratosphere" sky appearance.
     */
    correctAltitude?: boolean;
    /**
     * ground — enables Bruneton ground-intersection test. When true, any ray with
     * mu < 0 (slightly downward) gets transmittance=0 → black pixels at horizon.
     * Default false (our scene has its own terrain geometry).
     */
    ground?: boolean;
    /**
     * When false, disables the EffectComposer (and therefore Clouds + ToneMapping).
     * Useful for debugging raw Bruneton output without post-processing.
     */
    effectComposerEnabled?: boolean;
    /** Exposure multiplier for the ACES ToneMapping pass (default 6). */
    exposure?: number;
    /**
     * Altitude multiplier for cloud layers (default 1.0).
     * Values < 1 bring clouds closer to the camera, > 1 push them higher.
     * The base altitudes are 750m, 1000m, and 7500m (from @takram/three-clouds defaults).
     */
    cloudAltitude?: number;
}
declare const TakramSkySystem: ({ sunDirection, visible, cloudCoverage, qualityPreset, starsEnabled, moonEnabled, correctAltitude, ground, effectComposerEnabled, exposure, cloudAltitude, }: TakramSkySystemProps) => import("react").JSX.Element;
export default TakramSkySystem;
