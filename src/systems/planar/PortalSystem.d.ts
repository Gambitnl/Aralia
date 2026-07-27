import { Portal } from '../../types/planes';
import { GameState } from '../../types/index';
export interface PortalActivationResult {
    success: boolean;
    message: string;
    consumedItems?: string[];
}
export declare class PortalSystem {
    static checkRequirements(portal: Portal, gameState: GameState): {
        canActivate: boolean;
        reason?: string;
    };
    private static checkSingleRequirement;
    static activate(portal: Portal, gameState: GameState): PortalActivationResult;
}
