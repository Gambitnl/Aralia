import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
/**
 * A given gossip item may be overheard at most once per this many GAME hours.
 * Prevents a tiny gossip pool (e.g. two coming-of-age lines) from alternating
 * endlessly every tick — once everything is on cooldown, nothing is overheard.
 */
export declare const GOSSIP_REPEAT_COOLDOWN_GAME_HOURS = 6;
export declare const useOverheardGossip: (gameState: GameState, dispatch: React.Dispatch<AppAction>) => void;
