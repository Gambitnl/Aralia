import type { ExtraMovementSpeeds } from '../../types/core.js';
/**
 * Walking speed in feet. Handles numeric `speed`, object `.walk`, and 5etools
 * conditional walk objects. Defaults to 30 when nothing usable is present.
 */
export declare function parseWalkSpeedFeet(speed: unknown): number;
/**
 * Extracts fly/swim/climb/burrow speeds in feet. Omits undefined when no extra
 * modes exist so generated JSON stays small.
 */
export declare function parseExtraMovementSpeedsFeet(speed: unknown): ExtraMovementSpeeds | undefined;
