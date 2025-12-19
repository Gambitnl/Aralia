
import {
  InfernalContract,
  ContractType,
  ContractStatus,
  ContractClause,
  ContractGenerationParams
} from '../../types/infernal';
import { GameState, PlayerCharacter } from '../../types/index';
import { generateId } from '../../utils/idGenerator';
import { logger } from '../../utils/logger';

export class InfernalMechanics {

  /**
   * Generates a new Infernal Contract draft.
   */
  static draftContract(params: ContractGenerationParams): InfernalContract {
    const { type, grantorId, grantorName, signeeId, signeeName, tier } = params;

    const id = generateId();
    const clauses: ContractClause[] = this.generateClauses(type, tier);

    let description = '';
    let title = '';

    switch (type) {
        case 'soul_pact':
            title = 'Pact of Eternal Bindings';
            description = `An agreement wherein ${signeeName} pledges their immortal soul to ${grantorName} in exchange for power.`;
            break;
        case 'service_agreement':
            title = 'Indenture of Infernal Service';
            description = `A binding agreement for services rendered by ${signeeName} to ${grantorName}.`;
            break;
        case 'power_exchange':
            title = 'Barter of Arcane Might';
            description = `${signeeName} receives forbidden power in exchange for specific sacrifices.`;
            break;
        case 'forbidden_knowledge':
            title = 'Codex of Hidden Truths';
            description = `Access to secret knowledge granted by ${grantorName} for a terrible price.`;
            break;
    }

    return {
      id,
      title,
      description,
      type,
      grantorId,
      grantorName,
      signeeId,
      signeeName,
      status: 'draft',
      clauses,
      signatureBlood: false
    };
  }

  /**
   * Signs the contract, making it active and applying immediate effects.
   */
  static signContract(contract: InfernalContract, gameState: GameState): void {
    if (contract.status !== 'draft') {
        logger.warn(`Attempted to sign non-draft contract ${contract.id}`);
        return;
    }

    // Update status
    contract.status = 'active';
    contract.dateSigned = gameState.gameTime.getTime();
    contract.signatureBlood = true; // Always signed in blood for drama

    // Add to game state
    if (!gameState.activeContracts) {
        gameState.activeContracts = [];
    }
    gameState.activeContracts.push(contract);

    // Apply immediate boons
    this.applyImmediateClauses(contract, gameState);

    logger.info(`Contract ${contract.id} signed by ${contract.signeeName}.`);

    gameState.notifications.push({
        id: generateId(),
        message: `The parchment bursts into harmless blue flame as you sign. The deal is struck.`,
        type: 'warning',
        duration: 6000
    });
  }

  /**
   * Checks for breached contracts in the game state.
   */
  static checkBreach(gameState: GameState): void {
    if (!gameState.activeContracts) return;

    for (const contract of gameState.activeContracts) {
        if (contract.status === 'active') {
            const breach = this.detectBreach(contract, gameState);
            if (breach) {
                this.breachContract(contract, gameState, breach);
            }
        }
    }
  }

  /**
   * Marks a contract as breached and applies penalties.
   */
  static breachContract(contract: InfernalContract, gameState: GameState, reason: string): void {
      contract.status = 'breached';

      logger.info(`Contract ${contract.id} breached: ${reason}`);

      gameState.notifications.push({
          id: generateId(),
          message: `CONTRACT BREACHED: ${reason}. The Hells demand their due.`,
          type: 'error',
          duration: 10000
      });

      // Apply penalty clauses
      const penalties = contract.clauses.filter(c => c.type === 'penalty');
      for (const penalty of penalties) {
          // Logic to apply mechanical penalty would go here
          // For now, we just log it
          logger.info(`Applying penalty: ${penalty.description}`);
      }
  }

  private static generateClauses(type: ContractType, tier: string): ContractClause[] {
      const clauses: ContractClause[] = [];

      // Example logic for generating clauses based on type/tier
      if (type === 'soul_pact') {
          clauses.push({
              id: generateId(),
              description: 'Upon death, the Signee\'s soul is forfeit to the Nine Hells.',
              type: 'obligation',
              mechanics: 'Cannot be resurrected except by Wish or True Resurrection.'
          });
          clauses.push({
              id: generateId(),
              description: 'Grantor provides +2 to an Ability Score of choice.',
              type: 'boon',
              mechanics: '+2 Ability Score'
          });
      }

      // Default penalty for all contracts
      clauses.push({
          id: generateId(),
          description: 'Breach of contract results in immediate forfeiture of all assets and life.',
          type: 'penalty',
          mechanics: '10d10 Psychic Damage and immediate collection by Erinyes.'
      });

      return clauses;
  }

  private static applyImmediateClauses(contract: InfernalContract, gameState: GameState): void {
      // Placeholder for applying immediate benefits (e.g. giving items, gold, stats)
      const boons = contract.clauses.filter(c => c.type === 'boon');
      // Implementation depends on the specific boon mechanics
  }

  private static detectBreach(contract: InfernalContract, gameState: GameState): string | null {
      // Logic to detect if conditions are violated
      // e.g. "Don't kill innocents" -> check notoriety

      // Stub: return null for now
      return null;
  }
}
