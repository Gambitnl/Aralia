
/**
 * @file src/hooks/actions/actionHandlerTypes.ts
 * Defines shared function signature types for action handlers.
 */
import { Location, WorldCellView, NPC } from '../../types';

export type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;
export type PlayPcmAudioFn = (base64PcmData: string) => Promise<void>;
export type AddGeminiLogFn = (functionName: string, prompt: string, response: string) => void;
export type LogDiscoveryFn = (newLocation: Location) => void;
/** Grid retirement (agora-608b): the tooltip formatter takes a cell-native
 * `WorldCellView` (carrying its atlas cellId), not a legacy grid `MapTile`. */
export type GetTileTooltipTextFn = (worldCell: WorldCellView) => string;
export type GetCurrentLocationFn = () => Location;
export type GetCurrentNPCsFn = () => NPC[];
