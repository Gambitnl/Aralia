import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
/**
 * Populates `naval.knownPorts` from the FMG world pack for the given seed.
 *
 * Idempotency: fires once per seed change and only when `knownPorts` is empty.
 * If the list is already populated this hook does nothing, preventing redundant
 * dispatches on re-renders or hot-reloads.
 *
 * No fallback/try-catch: if `getBridgeAtlas` throws (e.g. the world hasn't been
 * generated yet) the error propagates — one real path, fail honestly.
 */
export declare function useKnownPortsSync(worldSeed: number | null | undefined, knownPorts: string[], dispatch: Dispatch<AppAction>): void;
