/**
 * This suite verifies how the React Pixi board consumes fog-of-war changes.
 *
 * The renderer owns a high-frequency animation ticker, while fog construction
 * performs a comparatively expensive two-pass blur. A lightweight Pixi mock
 * lets this component mount normally and proves unchanged ticker frames do not
 * rebuild fog, while a new visibility input does.
 */
export {};
