
/**
 * @file src/hooks/actions/actionHandlerTypes.ts
 * Defines shared function signature types for action handlers.
 */
import { GeminiLogEntry, Location, MapTile, NPC } from '../../types';

export type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;
export type PlayPcmAudioFn = (base64PcmData: string) => Promise<void>;
export type AddGeminiLogFn = (functionName: string, prompt: string, response: string) => void;
export type LogDiscoveryFn = (newLocation: Location) => void;
export type GetTileTooltipTextFn = (worldMapTile: MapTile) => string;
export type GetCurrentLocationFn = () => Location;
export type GetCurrentNPCsFn = () => NPC[];
