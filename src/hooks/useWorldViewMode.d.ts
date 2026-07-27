import { WorldViewMode, MapSurface, PlayerWorldPosition } from '../types';
/**
 * Hook for managing the 3D world view mode.
 * Returns the current mode and a setter that dispatches SET_WORLD_VIEW_MODE.
 */
export declare function useWorldViewMode(): {
    mode: WorldViewMode;
    setMode: (newMode: WorldViewMode) => void;
};
/**
 * Hook for reading and switching the 2D cartographic surface:
 * 'classic' (legacy GameLayout) ↔ 'worldforge' (native cartographer).
 * Falls back to 'classic' for legacy states without the field.
 */
export declare function useMapSurface(): {
    surface: MapSurface;
    setSurface: (next: MapSurface) => void;
    toggleSurface: () => void;
};
/**
 * Hook for reading and updating the player's 3D world position.
 * Returns the current position and a setter that dispatches SET_PLAYER_WORLD_POS.
 */
export declare function usePlayerWorldPos(): {
    position: PlayerWorldPosition;
    setPosition: (newPos: PlayerWorldPosition) => void;
    clearPosition: () => void;
};
