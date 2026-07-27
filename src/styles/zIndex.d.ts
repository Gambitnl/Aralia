/**
 * Centralized Z-Index Registry
 *
 * This file defines standardized z-index values for consistent UI layering across the application.
 * All z-index usage should reference these named constants instead of magic numbers.
 *
 * ## Layering Hierarchy
 *
 * ### 0-99: Base Content & Infrastructure
 * - `BASE` (0): Default content layer
 * - `CONTENT` (1): Content above base
 * - `CONTENT_OVERLAY_BASE` (5): Low-priority content overlays
 * - `CONTENT_OVERLAY_LOW` (10): Local UI elements above content
 * - `SUBMAP_OVERLAY` (20): SVG overlays on submaps
 * - `MINIMAP` (30): Minimap component (above game content, below modals)
 * - `CONTENT_OVERLAY_MEDIUM` (40): Content overlays above standard UI
 * - `CONTENT_OVERLAY_HIGH` (60): Prominent content overlays
 * - `CONTENT_OVERLAY_TOP` (70): Topmost content overlays below modals
 *
 * ### 100-299: Modal System
 * - `MODAL_BACKGROUND` (100): Modal backdrop (blocks interaction)
 * - `MODAL_CONTENT` (110): Standard modal content
 * - `MODAL_INTERACTIVE` (120): Modals with form inputs
 * - `MODAL_IMMERSIVE_*` (150-200): Full-screen immersive modals (3D, etc.)
 * - `MODAL_SPECIALIZED_OVERLAY` (220): Specialized modal overlays
 *
 * ### 300-499: Feature Overlays
 * - `PARTY_OVERLAY` (350): Party member indicators
 * - `COMBAT_OVERLAY` (400): Combat system overlays
 *
 * (`DICE_OVERLAY` lives at 1050: an active roll is a blocking moment and must
 * render above always-on-top panels like the conversation panel, which sits at
 * TOOLTIP level — at its old 300 slot the tray drew BEHIND the very panel whose
 * skill check triggered it.)
 *
 * ### 500-799: Interactive Elements
 * - `RESIZE_HANDLES_*` (500-510): Window resize handles
 * - `DRAG_INDICATORS` (600): Visual drag feedback
 *
 * ### 800-999: Advanced UI Features
 * - `WINDOW_FRAME` (800): Resizable window frames
 * - `LOADING_TRANSITION` (850): Loading screens
 * - `CONFIRMATION_MODAL` (875): Blocking confirmations above active windows
 * - `ERROR_OVERLAY` (900): Error notifications
 *
 * ### 1000+: Always-on-Top
 * - `TOOLTIP` (1000): Contextual help
 * - `NOTIFICATION` (1100): System notifications
 * - `DEBUG_OVERLAY` (1200): Development tools
 *
 * ### 9999: Emergency Override
 * - `MAXIMUM` (9999): Nuclear option - use only when absolutely necessary
 *
 * ## Usage Examples
 *
 * ### Basic Modal
 * ```tsx
 * import { Z_INDEX } from '../styles/zIndex';
 *
 * <div className={`fixed inset-0 z-[${Z_INDEX.MODAL_BACKGROUND}]`}>
 *   <div className={`relative z-[${Z_INDEX.MODAL_CONTENT}]`}>
 *     Modal content here
 *   </div>
 * </div>
 * ```
 *
 * ### Using Utility Functions
 * ```tsx
 * import { getZIndexClass, getZIndexValue } from '../styles/zIndex';
 *
 * // Get complete class string
 * <div className={getZIndexClass('MODAL_BACKGROUND')}>
 *
 * // Get just the numeric value
 * const myZIndex = getZIndexValue('TOOLTIP');
 * ```
 *
 * ## Migration Guide
 *
 * Replace hardcoded values:
 * ```tsx
 * // Before
 * <div className="z-[100]">
 *
 * // After
 * <div className={`z-[${Z_INDEX.MODAL_BACKGROUND}]`}>
 * ```
 *
 * ## Adding New Layers
 *
 * 1. Add new constant to Z_INDEX object
 * 2. Update this documentation
 * 3. Ensure it fits the layering hierarchy
 * 4. Test for conflicts with existing layers
 */
export declare const Z_INDEX: {
    /** Base content layer */
    readonly BASE: 0;
    /** Regular content above base */
    readonly CONTENT: 1;
    /** Low-priority content overlays (background effects) */
    readonly CONTENT_OVERLAY_BASE: 5;
    /** Local UI elements above base content */
    readonly CONTENT_OVERLAY_LOW: 10;
    /** Submap content overlay */
    readonly SUBMAP_OVERLAY: 20;
    /** Minimap component (shows above game content but below modals/windows) */
    readonly MINIMAP: 30;
    /** Content overlays above standard UI */
    readonly CONTENT_OVERLAY_MEDIUM: 40;
    /** Prominent content overlays */
    readonly CONTENT_OVERLAY_HIGH: 60;
    /** Topmost content overlays below modals */
    readonly CONTENT_OVERLAY_TOP: 70;
    /** Modal background overlay (blocks interaction with content below) */
    readonly MODAL_BACKGROUND: 100;
    /** Standard modal content */
    readonly MODAL_CONTENT: 110;
    /** Modal with form inputs or complex interactions */
    readonly MODAL_INTERACTIVE: 120;
    /** Modal background for immersive experiences (3D, full-screen) */
    readonly MODAL_IMMERSIVE_BACKGROUND: 150;
    /** Modal content for immersive experiences */
    readonly MODAL_IMMERSIVE_CONTENT: 200;
    /** Specialized modal overlays (spellbook, character sheets) */
    readonly MODAL_SPECIALIZED_OVERLAY: 220;
    /** Party member overlays and indicators */
    readonly PARTY_OVERLAY: 350;
    /** Combat system overlays */
    readonly COMBAT_OVERLAY: 400;
    /** Resize handles (horizontal) */
    readonly RESIZE_HANDLES_HORIZONTAL: 500;
    /** Resize handles (corners) */
    readonly RESIZE_HANDLES_CORNERS: 510;
    /** Drag indicators and visual feedback */
    readonly DRAG_INDICATORS: 600;
    /** Window frames and UI infrastructure */
    readonly WINDOW_FRAME: 800;
    /** Loading transitions and progress indicators */
    readonly LOADING_TRANSITION: 850;
    /** Blocking confirmation dialogs that must sit above resizable WindowFrames */
    readonly CONFIRMATION_MODAL: 875;
    /** Error states and notifications */
    readonly ERROR_OVERLAY: 900;
    /** Page header bars (below window frames so WindowFrame controls remain accessible) */
    readonly PAGE_HEADER: 750;
    /** Tooltips and contextual help */
    readonly TOOLTIP: 1000;
    /** Dice rolling overlay — a roll in progress must draw above always-on-top
     *  panels (the conversation panel sits at TOOLTIP level and triggers rolls). */
    readonly DICE_OVERLAY: 1050;
    /** System notifications and alerts */
    readonly NOTIFICATION: 1100;
    /** Debug overlays and development tools */
    readonly DEBUG_OVERLAY: 1200;
    /** Emergency override - use only when absolutely necessary */
    readonly MAXIMUM: 9999;
};
/**
 * Type representing all valid z-index layer names
 */
export type ZIndexLayer = keyof typeof Z_INDEX;
/**
 * Type representing all valid z-index values
 */
export type ZIndexValue = typeof Z_INDEX[ZIndexLayer];
/**
 * Utility function to get the z-index class string for a given layer
 *
 * @param layer - The z-index layer name
 * @returns Tailwind CSS z-index class string
 *
 * @example
 * ```tsx
 * <div className={getZIndexClass('MODAL_BACKGROUND')}>
 * ```
 */
export declare function getZIndexClass(layer: ZIndexLayer): string;
/**
 * Utility function to get the numeric z-index value for a given layer
 *
 * @param layer - The z-index layer name
 * @returns The numeric z-index value
 */
export declare function getZIndexValue(layer: ZIndexLayer): number;
/**
 * Validation function to check if a numeric value corresponds to a defined layer
 *
 * @param value - The numeric z-index value to check
 * @returns The layer name if found, undefined otherwise
 */
export declare function getLayerByValue(value: number): ZIndexLayer | undefined;
/**
 * Checks if a given z-index value is valid (exists in registry)
 *
 * @param value - The numeric z-index value to validate
 * @returns True if the value exists in the registry
 */
export declare function isValidZIndex(value: number): boolean;
/**
 * Gets all layers within a specific range for debugging layering conflicts
 *
 * @param min - Minimum z-index value (inclusive)
 * @param max - Maximum z-index value (inclusive)
 * @returns Array of layer names in the specified range
 */
export declare function getLayersInRange(min: number, max: number): ZIndexLayer[];
/**
 * Gets the next available z-index value after a given layer
 * Useful for creating new layers that don't conflict
 *
 * @param layer - The reference layer
 * @param offset - How much to offset from the reference layer (default: 1)
 * @returns The next available z-index value
 */
export declare function getNextZIndex(layer: ZIndexLayer, offset?: number): number;
/**
 * Type guard to check if a string is a valid ZIndexLayer
 *
 * @param value - The string to check
 * @returns True if the string is a valid layer name
 */
export declare function isZIndexLayer(value: string): value is ZIndexLayer;
/**
 * Gets debugging information about the z-index registry
 * Useful for development and testing
 *
 * @returns Object with registry statistics and validation info
 */
export declare function getZIndexDebugInfo(): {
    totalLayers: number;
    layersByValue: ["BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM", number][];
    layerNames: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
    valueRange: {
        min: number;
        max: number;
    };
    layersByCategory: {
        base: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        modal: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        overlays: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        interactive: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        advanced: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        alwaysOnTop: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
        emergency: ("BASE" | "CONTENT" | "CONTENT_OVERLAY_BASE" | "CONTENT_OVERLAY_LOW" | "SUBMAP_OVERLAY" | "MINIMAP" | "CONTENT_OVERLAY_MEDIUM" | "CONTENT_OVERLAY_HIGH" | "CONTENT_OVERLAY_TOP" | "MODAL_BACKGROUND" | "MODAL_CONTENT" | "MODAL_INTERACTIVE" | "MODAL_IMMERSIVE_BACKGROUND" | "MODAL_IMMERSIVE_CONTENT" | "MODAL_SPECIALIZED_OVERLAY" | "PARTY_OVERLAY" | "COMBAT_OVERLAY" | "RESIZE_HANDLES_HORIZONTAL" | "RESIZE_HANDLES_CORNERS" | "DRAG_INDICATORS" | "WINDOW_FRAME" | "LOADING_TRANSITION" | "CONFIRMATION_MODAL" | "ERROR_OVERLAY" | "PAGE_HEADER" | "TOOLTIP" | "DICE_OVERLAY" | "NOTIFICATION" | "DEBUG_OVERLAY" | "MAXIMUM")[];
    };
};
/**
 * Apply Z-Index registry values as CSS variables on the document root.
 * This allows non-TS stylesheets to stay aligned with the registry.
 */
export declare function applyZIndexCssVariables(target?: HTMLElement): void;
