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
 * - `SUBMAP_OVERLAY` (20): SVG overlays on submaps
 * - `MINIMAP` (30): Minimap component (above game content, below modals)
 *
 * ### 100-299: Modal System
 * - `MODAL_BACKGROUND` (100): Modal backdrop (blocks interaction)
 * - `MODAL_CONTENT` (110): Standard modal content
 * - `MODAL_INTERACTIVE` (120): Modals with form inputs
 * - `MODAL_IMMERSIVE_*` (150-200): Full-screen immersive modals (3D, etc.)
 * - `MODAL_SPECIALIZED_OVERLAY` (220): Specialized modal overlays
 *
 * ### 300-499: Feature Overlays
 * - `DICE_OVERLAY` (300): Dice rolling animations
 * - `PARTY_OVERLAY` (350): Party member indicators
 * - `COMBAT_OVERLAY` (400): Combat system overlays
 *
 * ### 500-799: Interactive Elements
 * - `RESIZE_HANDLES_*` (500-510): Window resize handles
 * - `DRAG_INDICATORS` (600): Visual drag feedback
 *
 * ### 800-999: Advanced UI Features
 * - `WINDOW_FRAME` (800): Resizable window frames
 * - `LOADING_TRANSITION` (850): Loading screens
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

export const Z_INDEX = {
  // ============================================================================
  // BASE LAYERS (0-99)
  // ============================================================================

  /** Base content layer */
  BASE: 0,

  /** Regular content above base */
  CONTENT: 1,

  /** Submap content overlay */
  SUBMAP_OVERLAY: 20,

  /** Minimap component (shows above game content but below modals/windows) */
  MINIMAP: 30,

  // ============================================================================
  // MODAL SYSTEM (100-299)
  // ============================================================================

  /** Modal background overlay (blocks interaction with content below) */
  MODAL_BACKGROUND: 100,

  /** Standard modal content */
  MODAL_CONTENT: 110,

  /** Modal with form inputs or complex interactions */
  MODAL_INTERACTIVE: 120,

  /** Modal background for immersive experiences (3D, full-screen) */
  MODAL_IMMERSIVE_BACKGROUND: 150,

  /** Modal content for immersive experiences */
  MODAL_IMMERSIVE_CONTENT: 200,

  /** Specialized modal overlays (spellbook, character sheets) */
  MODAL_SPECIALIZED_OVERLAY: 220,

  // ============================================================================
  // FEATURE OVERLAYS (300-499)
  // ============================================================================

  /** Dice rolling overlay */
  DICE_OVERLAY: 300,

  /** Party member overlays and indicators */
  PARTY_OVERLAY: 350,

  /** Combat system overlays */
  COMBAT_OVERLAY: 400,

  // ============================================================================
  // INTERACTIVE ELEMENTS (500-799)
  // ============================================================================

  /** Resize handles (horizontal) */
  RESIZE_HANDLES_HORIZONTAL: 500,

  /** Resize handles (corners) */
  RESIZE_HANDLES_CORNERS: 510,

  /** Drag indicators and visual feedback */
  DRAG_INDICATORS: 600,

  // ============================================================================
  // ADVANCED UI FEATURES (800-999)
  // ============================================================================

  /** Window frames and UI infrastructure */
  WINDOW_FRAME: 800,

  /** Loading transitions and progress indicators */
  LOADING_TRANSITION: 850,

  /** Error states and notifications */
  ERROR_OVERLAY: 900,

  /** Page header bars (below window frames so WindowFrame controls remain accessible) */
  PAGE_HEADER: 750,

  // ============================================================================
  // ALWAYS-ON-TOP ELEMENTS (1000+)
  // ============================================================================

  /** Tooltips and contextual help */
  TOOLTIP: 1000,

  /** System notifications and alerts */
  NOTIFICATION: 1100,

  /** Debug overlays and development tools */
  DEBUG_OVERLAY: 1200,

  // ============================================================================
  // EMERGENCY OVERRIDE (9999)
  // ============================================================================

  /** Emergency override - use only when absolutely necessary */
  MAXIMUM: 9999,
} as const;

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
export function getZIndexClass(layer: ZIndexLayer): string {
  return `z-[${Z_INDEX[layer]}]`;
}

/**
 * Utility function to get the numeric z-index value for a given layer
 *
 * @param layer - The z-index layer name
 * @returns The numeric z-index value
 */
export function getZIndexValue(layer: ZIndexLayer): number {
  return Z_INDEX[layer];
}

/**
 * Validation function to check if a numeric value corresponds to a defined layer
 *
 * @param value - The numeric z-index value to check
 * @returns The layer name if found, undefined otherwise
 */
export function getLayerByValue(value: number): ZIndexLayer | undefined {
  const entries = Object.entries(Z_INDEX) as [ZIndexLayer, number][];
  const found = entries.find(([, zValue]) => zValue === value);
  return found?.[0];
}

/**
 * Checks if a given z-index value is valid (exists in registry)
 *
 * @param value - The numeric z-index value to validate
 * @returns True if the value exists in the registry
 */
export function isValidZIndex(value: number): boolean {
  return getLayerByValue(value) !== undefined;
}

/**
 * Gets all layers within a specific range for debugging layering conflicts
 *
 * @param min - Minimum z-index value (inclusive)
 * @param max - Maximum z-index value (inclusive)
 * @returns Array of layer names in the specified range
 */
export function getLayersInRange(min: number, max: number): ZIndexLayer[] {
  const entries = Object.entries(Z_INDEX) as [ZIndexLayer, number][];
  return entries
    .filter(([, zValue]) => zValue >= min && zValue <= max)
    .map(([layer]) => layer)
    .sort((a, b) => Z_INDEX[a] - Z_INDEX[b]);
}

/**
 * Gets the next available z-index value after a given layer
 * Useful for creating new layers that don't conflict
 *
 * @param layer - The reference layer
 * @param offset - How much to offset from the reference layer (default: 1)
 * @returns The next available z-index value
 */
export function getNextZIndex(layer: ZIndexLayer, offset: number = 1): number {
  return Z_INDEX[layer] + offset;
}

/**
 * Type guard to check if a string is a valid ZIndexLayer
 *
 * @param value - The string to check
 * @returns True if the string is a valid layer name
 */
export function isZIndexLayer(value: string): value is ZIndexLayer {
  return value in Z_INDEX;
}

/**
 * Gets debugging information about the z-index registry
 * Useful for development and testing
 *
 * @returns Object with registry statistics and validation info
 */
export function getZIndexDebugInfo() {
  const entries = Object.entries(Z_INDEX) as [ZIndexLayer, number][];
  const sortedLayers = entries.sort(([, a], [, b]) => a - b);

  return {
    totalLayers: entries.length,
    layersByValue: sortedLayers,
    layerNames: entries.map(([name]) => name),
    valueRange: {
      min: Math.min(...entries.map(([, value]) => value)),
      max: Math.max(...entries.map(([, value]) => value)),
    },
    layersByCategory: {
      base: getLayersInRange(0, 99),
      modal: getLayersInRange(100, 299),
      overlays: getLayersInRange(300, 499),
      interactive: getLayersInRange(500, 799),
      advanced: getLayersInRange(800, 999),
      alwaysOnTop: getLayersInRange(1000, 9998),
      emergency: getLayersInRange(9999, 9999),
    },
  };
}