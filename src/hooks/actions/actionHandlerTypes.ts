
/**
 * @file src/hooks/actions/actionHandlerTypes.ts
 * Defines shared function signature types for action handlers.
 */
// TODO(lint-intent): 'GeminiLogEntry' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GeminiLogEntry as _GeminiLogEntry, Location, MapTile, NPC } from '../../types';

export type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;
export type PlayPcmAudioFn = (base64PcmData: string) => Promise<void>;
export type AddGeminiLogFn = (functionName: string, prompt: string, response: string) => void;
export type LogDiscoveryFn = (newLocation: Location) => void;
export type GetTileTooltipTextFn = (worldMapTile: MapTile) => string;
export type GetCurrentLocationFn = () => Location;
export type GetCurrentNPCsFn = () => NPC[];
