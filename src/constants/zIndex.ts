// Standardized Z-Index values to avoid "Z-Index wars"
// Usage: className={`z-[${Z_INDEX.MODAL}]`} or style={{ zIndex: Z_INDEX.MODAL }}
// Prefer standard Tailwind classes (z-0, z-10, z-20, z-30, z-40, z-50) when possible.

export const Z_INDEX = {
  // Standard layers (matches Tailwind default scale)
  BASE: 0,
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,
  OVERLAY: 40,
  MODAL: 50,

  // Extended layers (for when z-50 is not enough)
  // Used for Modals that need to be on top of other Modals
  MODAL_2: 60, // e.g., DevMenu, ConfirmationModal
  MODAL_3: 70, // e.g., GeminiLogViewer, GameGuideModal
  MODAL_4: 80, // e.g., MissingChoiceModal

  // Top layers
  TOP_TIER: 100, // e.g., LoadGameTransition, ImageModal, Error Banners
  TOOLTIP: 9999, // Tooltips must always be on top
} as const;
