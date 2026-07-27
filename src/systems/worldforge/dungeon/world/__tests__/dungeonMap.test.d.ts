/**
 * This file proves that dungeon movement inks a concealed sheet from the canonical plan.
 *
 * A fixed world-attached dungeon starts with only the entrance area visible. The test then walks
 * the existing legal path to an authored treasure room, accumulating exactly the same cell reveal
 * events the mounted 3D controls emit. The resulting parchment must remember that landmark while
 * never drawing undiscovered floor. A second assertion proves vertical annotations stay concealed
 * until their real transition or deepest-objective cell is inked.
 */
export {};
