import { InfernalContract, ContractGenerationParams } from '../../types/infernal';
import { GameState } from '../../types/index';
export declare class InfernalMechanics {
    /**
     * Generates a new Infernal Contract draft.
     */
    static draftContract(params: ContractGenerationParams): InfernalContract;
    /**
     * Signs the contract, making it active and applying immediate effects.
     */
    static signContract(contract: InfernalContract, gameState: GameState): void;
    /**
     * Checks for breached contracts in the game state.
     */
    static checkBreach(gameState: GameState): void;
    /**
     * Marks a contract as breached and applies penalties.
     */
    static breachContract(contract: InfernalContract, gameState: GameState, reason: string): void;
    private static generateClauses;
    private static applyImmediateClauses;
    private static detectBreach;
}
