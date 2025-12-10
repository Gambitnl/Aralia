/**
 * Standardized button styles for the application.
 * These constants ensure consistency in padding, rounding, shadow, and interaction states
 * across different components (ActionPane, Modals, CharacterCreator, etc.).
 */

// Base structural classes (no size or color)
export const BTN_BASE = "font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed";

// Sizes
export const BTN_SIZE_SM = "py-1 px-3 text-sm";
export const BTN_SIZE_MD = "py-2 px-4 text-base";
export const BTN_SIZE_LG = "py-3 px-6 text-lg";

// Color Variants
// Sky/Blue - Primary actions like "View Details", "Submit", "Next"
export const BTN_PRIMARY = "bg-sky-600 hover:bg-sky-500 text-white focus:ring-sky-400";

// Amber - "Do it" actions, often physical or affirmative
export const BTN_ACTION = "bg-amber-500 hover:bg-amber-400 text-gray-900 focus:ring-amber-300";

// Green - Positive/Safe actions
export const BTN_SUCCESS = "bg-green-600 hover:bg-green-500 text-white focus:ring-green-400";

// Red - Destructive actions
export const BTN_DANGER = "bg-red-600 hover:bg-red-500 text-white focus:ring-red-400";

// Gray - Secondary/Cancel/Back actions
export const BTN_SECONDARY = "bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600 focus:ring-gray-500";

// Ghost - Minimal
export const BTN_GHOST = "bg-transparent hover:bg-gray-700/50 text-gray-300 hover:text-white";

// Composed Helpers
export const BTN_CONFIRM = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_ACTION}`;
export const BTN_CANCEL = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_SECONDARY}`;
export const BTN_PRIMARY_MD = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_PRIMARY}`;
export const BTN_PRIMARY_SM = `${BTN_BASE} ${BTN_SIZE_SM} ${BTN_PRIMARY}`;
