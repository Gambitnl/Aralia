import type { PlayerCharacter } from '../../types';
import { type TreeStats } from './PropsLayer';
import type { SceneEntity } from './sceneEntities';
interface Scene3DProps {
    biomeId: string;
    gameTime: Date;
    playerSpeed: number;
    submapSeed: number;
    submapFootprintFt: number;
    /** Rendering safety switch for debugging. */
    renderQuality?: 'safe' | 'enhanced';
    environmentMode?: 'submap' | 'tree-lab';
    showGrid: boolean;
    partyMembers: PlayerCharacter[];
    isCombatMode: boolean;
    onPlayerPosition?: (position: {
        x: number;
        y: number;
        z: number;
    }) => void;
    onPlayerSpeed?: (speedFeetPerRound: number) => void;
    onFrameTime?: (ms: number) => void;
    onEntityHover?: (entity: SceneEntity | null) => void;
    onEntitySelect?: (entity: SceneEntity | null) => void;
    hoveredEntityId?: string | null;
    selectedEntityId?: string | null;
    pauseRender?: boolean;
    treeCountMultiplier?: number;
    rockCountMultiplier?: number;
    heroLineEnabled?: boolean;
    heroLineSpacing?: number;
    heroLineOffset?: {
        x: number;
        z: number;
    };
    customTreeOptions?: Record<string, unknown> | null;
    customTreeEnabled?: boolean;
    customTreeOffset?: {
        x: number;
        z: number;
    };
    customTreeScale?: number;
    comparisonTreeOptions?: Record<string, unknown> | null;
    comparisonTreeEnabled?: boolean;
    comparisonTreeOffset?: {
        x: number;
        z: number;
    };
    comparisonTreeScale?: number;
    onCustomTreeStats?: (stats: TreeStats | null) => void;
    onComparisonTreeStats?: (stats: TreeStats | null) => void;
    lightingOverrides?: {
        sunAzimuth?: number;
        sunElevation?: number;
        sunIntensity?: number;
        ambientIntensity?: number;
        fogDensity?: number;
    };
    cameraFocusTarget?: {
        x: number;
        z: number;
    } | null;
    cameraFocusHeightOffset?: number;
    cameraFocusRequestId?: number;
    cameraFocusDistance?: number;
    cameraFocusLock?: boolean;
    /**
     * 'legacy'  — current EnhancedSkyDome + LabClouds + PostProcessingPipeline (default)
     * 'takram'  — @takram/three-atmosphere sky + @takram/three-clouds volumetric clouds
     *             (disables PostProcessingPipeline to avoid double-render conflict)
     */
    skyMode?: 'legacy' | 'takram';
    takramCloudCoverage?: number;
    /** Sky Lab debug toggles — only used when skyMode='takram' */
    takramCorrectAltitude?: boolean;
    takramGround?: boolean;
    takramStars?: boolean;
    /** When false, disables the @react-three/postprocessing EffectComposer in takram mode. */
    takramEffectComposer?: boolean;
    /** Exposure multiplier for the Takram sky's ACES tone mapping pass (default 6). */
    takramExposure?: number;
    /** Show procedural moon (opposite sun) in Takram mode. */
    takramMoon?: boolean;
    /** Altitude multiplier for cloud layers (default 1.0). */
    takramCloudAltitude?: number;
    /** Sky-cam debug mode: snaps the camera to orbit a point in the cloud layer so clouds are visible looking upward. */
    takramSkyCam?: boolean;
    labGrassEnabled?: boolean;
    labGrassCount?: number;
    labFlowersEnabled?: boolean;
    labFlowerCount?: number;
    labRocksEnabled?: boolean;
    labRocksPerType?: number;
}
declare const Scene3D: ({ pauseRender, ...props }: Scene3DProps) => import("react").JSX.Element;
export default Scene3D;
