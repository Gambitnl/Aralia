
import {
  InfernalContract,
  ContractType,
  ContractClause,
  ContractEffect,
  ContractGenerationParams
} from '../../types/infernal';
import { GameState, PlayerCharacter } from '../../types/index';
import { CrimeType } from '../../types/crime';
import { ItemType } from '../../types/items';
import { generateId } from '../../utils/core';
import { logger } from '../../utils/core';
import { createSeededRandom } from '../../utils/random';
import { rollDice } from '../dice/rollers';

/** Milliseconds in one game day, used by the time-bound breach conditions. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How hard a grantor bargains. A devil of higher rank pays more and demands more,
 * so the same clause template scales instead of needing a table per tier.
 */
const TIER_MULTIPLIER: Record<ContractGenerationParams['tier'], number> = {
  minor: 1,
  lesser: 2,
  greater: 4,
  archduke: 8
};

export class InfernalMechanics {

  /**
   * Generates a new Infernal Contract draft.
   */
  static draftContract(params: ContractGenerationParams): InfernalContract {
    const { type, grantorId, grantorName, signeeId, signeeName, tier } = params;

    const id = generateId();
    const clauses: ContractClause[] = this.generateClauses(type, tier);
    const multiplier = TIER_MULTIPLIER[tier];

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

    const contract: InfernalContract = {
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

    // Quota counters back the time-bound breach conditions generated below. They are
    // set here (not in the clause generator) so the clause list stays plain data.
    if (type === 'service_agreement') {
      contract.servicesRequired = multiplier;
      contract.servicesRendered = 0;
    }
    if (type === 'power_exchange') {
      contract.soulsRequired = multiplier;
      contract.soulsCollected = 0;
    }

    return contract;
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
    const rawContracts = gameState.activeContracts;
    if (!Array.isArray(rawContracts)) return;

    const activeContracts = rawContracts.filter((contract): contract is InfernalContract => {
      return (
        typeof contract === 'object' &&
        contract !== null &&
        typeof (contract as { status: unknown }).status === 'string' &&
        typeof (contract as { id: unknown }).id === 'string' &&
        typeof (contract as { type: unknown }).type === 'string' &&
        typeof (contract as { signeeName: unknown }).signeeName === 'string'
      );
    });

    for (const contract of activeContracts) {
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

      // Apply penalty clauses. A penalty with no structured effect is flavor text:
      // it is logged loudly rather than silently guessed at from its prose.
      const penalties = contract.clauses.filter(c => c.type === 'penalty');
      for (const penalty of penalties) {
          if (!penalty.effect) {
              logger.warn(`Penalty clause ${penalty.id} carries no structured effect; nothing applied: ${penalty.description}`);
              continue;
          }
          this.applyEffect(penalty.effect, contract, gameState, penalty.id);
          logger.info(`Applied penalty: ${penalty.description}`);
      }
  }
  private static generateClauses(type: ContractType, tier: ContractGenerationParams['tier']): ContractClause[] {
      const clauses: ContractClause[] = [];
      const multiplier = TIER_MULTIPLIER[tier];

      // Every contract type now yields at least one boon with a structured effect and one
      // obligation with a machine-checkable breach condition, so signing and breaching are
      // both real mechanics rather than prose.
      if (type === 'soul_pact') {
          clauses.push({
              id: generateId(),
              description: 'Upon death, the Signee\'s soul is forfeit to the Nine Hells.',
              type: 'obligation',
              mechanics: 'Cannot be resurrected except by Wish or True Resurrection.',
              triggerCondition: 'on_death'
          });
          clauses.push({
              id: generateId(),
              description: 'The Signee shall spill no innocent blood without the Grantor\'s leave.',
              type: 'obligation',
              mechanics: 'A known Murder on the Signee\'s record breaches the pact.',
              breachCondition: { kind: 'forbidden_crime', crimeType: CrimeType.Murder }
          });
          clauses.push({
              id: generateId(),
              description: 'Grantor steeps the Signee in infernal presence.',
              type: 'boon',
              mechanics: '+2 Charisma',
              effect: { kind: 'ability_score', ability: 'Charisma', amount: 2 }
          });
      }

      if (type === 'service_agreement') {
          clauses.push({
              id: generateId(),
              description: `Grantor advances ${500 * multiplier} gold against services yet to be rendered.`,
              type: 'boon',
              mechanics: `+${500 * multiplier} gold`,
              effect: { kind: 'gold', amount: 500 * multiplier }
          });
          clauses.push({
              id: generateId(),
              description: 'The advance buys service, and service has a season.',
              type: 'obligation',
              mechanics: 'All required services must be rendered within 30 days of signing.',
              breachCondition: { kind: 'services_due', withinDays: 30 }
          });
      }

      if (type === 'power_exchange') {
          clauses.push({
              id: generateId(),
              description: 'Grantor floods the Signee\'s sinews with borrowed might.',
              type: 'boon',
              mechanics: '+2 Strength',
              effect: { kind: 'ability_score', ability: 'Strength', amount: 2 }
          });
          clauses.push({
              id: generateId(),
              description: 'Might is bartered, never given. Souls are the coin.',
              type: 'obligation',
              mechanics: 'The promised souls must be delivered within 90 days of signing.',
              breachCondition: { kind: 'souls_due', withinDays: 90 }
          });
      }

      if (type === 'forbidden_knowledge') {
          clauses.push({
              id: generateId(),
              description: 'Grantor surrenders a codex of truths mortals were not meant to hold.',
              type: 'boon',
              mechanics: 'Gain the Codex of Hidden Truths.',
              effect: {
                  kind: 'item',
                  item: {
                      id: generateId(),
                      name: 'Codex of Hidden Truths',
                      description: 'A ledger of secrets bound in something that was recently warm.',
                      type: ItemType.Book,
                      quantity: 1,
                      weight: 3,
                      value: 250 * multiplier
                  }
              }
          });
          clauses.push({
              id: generateId(),
              description: 'The Signee shall keep the Grantor\'s name out of mortal ledgers.',
              type: 'obligation',
              mechanics: 'Notoriety above 75 global heat breaches the codex terms.',
              breachCondition: { kind: 'max_global_heat', value: 75 }
          });
      }

      // Default penalties for all contracts: the assets first, then the life.
      clauses.push({
          id: generateId(),
          description: 'Breach of contract results in immediate forfeiture of all assets.',
          type: 'penalty',
          mechanics: 'Every coin the party carries is collected by the Grantor.',
          effect: { kind: 'forfeit_gold' }
      });
      clauses.push({
          id: generateId(),
          description: 'Breach of contract results in immediate forfeiture of life.',
          type: 'penalty',
          mechanics: '10d10 Psychic Damage and immediate collection by Erinyes.',
          effect: { kind: 'psychic_damage', dice: '10d10' }
      });

      return clauses;
  }
  /**
   * Applies every boon clause the moment the contract is signed.
   *
   * Only clauses carrying a structured `effect` do anything; a boon written as prose
   * alone is reported, never guessed at.
   */
  private static applyImmediateClauses(contract: InfernalContract, gameState: GameState): void {
      for (const clause of contract.clauses) {
          if (clause.type !== 'boon') continue;
          if (!clause.effect) {
              logger.warn(`Boon clause ${clause.id} carries no structured effect; nothing applied: ${clause.description}`);
              continue;
          }
          this.applyEffect(clause.effect, contract, gameState, clause.id);
      }
  }

  /**
   * Resolves one structured clause effect against the running game.
   *
   * `clauseId` only salts the dice so a given contract's penalty roll is reproducible
   * from the world seed (SeededRandom, never Math.random).
   */
  private static applyEffect(
      effect: ContractEffect,
      contract: InfernalContract,
      gameState: GameState,
      clauseId: string
  ): void {
      switch (effect.kind) {
          case 'ability_score': {
              const signee = this.findSignee(contract, gameState);
              if (!signee) return;
              // Both stores move: `abilityScores` is the character's own record and
              // `finalAbilityScores` is what the rest of the game reads. Each is replaced
              // rather than mutated in place, so a character whose two score objects share
              // one reference (as mock factories build them) still gains the bonus once.
              signee.abilityScores = {
                  ...signee.abilityScores,
                  [effect.ability]: signee.abilityScores[effect.ability] + effect.amount
              };
              signee.finalAbilityScores = {
                  ...signee.finalAbilityScores,
                  [effect.ability]: signee.finalAbilityScores[effect.ability] + effect.amount
              };
              logger.info(`Contract ${contract.id}: ${signee.name} gains ${effect.amount} ${effect.ability}.`);
              return;
          }
          case 'gold': {
              gameState.gold += effect.amount;
              logger.info(`Contract ${contract.id}: party purse changes by ${effect.amount} gold.`);
              return;
          }
          case 'item': {
              gameState.inventory.push(effect.item);
              logger.info(`Contract ${contract.id}: ${effect.item.name} placed in the party inventory.`);
              return;
          }
          case 'psychic_damage': {
              const signee = this.findSignee(contract, gameState);
              if (!signee) return;
              const rng = createSeededRandom(gameState.worldSeed, undefined, `infernal:${contract.id}:${clauseId}`);
              const damage = rollDice(effect.dice, { rng });
              signee.hp = Math.max(0, signee.hp - damage);
              logger.info(`Contract ${contract.id}: ${signee.name} takes ${damage} psychic damage (${effect.dice}).`);
              return;
          }
          case 'forfeit_gold': {
              const forfeited = gameState.gold;
              gameState.gold = 0;
              logger.info(`Contract ${contract.id}: ${forfeited} gold forfeited to ${contract.grantorName}.`);
              return;
          }
      }
  }

  /**
   * The party member who signed. A contract whose signee is not in the party cannot
   * have its personal clauses applied to anyone else, so this reports and returns null
   * rather than silently retargeting.
   */
  private static findSignee(contract: InfernalContract, gameState: GameState): PlayerCharacter | null {
      const signee = gameState.party.find(pc => pc.id === contract.signeeId);
      if (!signee) {
          logger.warn(`Contract ${contract.id}: signee ${contract.signeeName} (${contract.signeeId}) is not in the party; clause not applied.`);
          return null;
      }
      return signee;
  }

  /**
   * Returns the reason the contract is breached, or null while its terms hold.
   *
   * Each obligation clause may carry one machine-checkable `breachCondition`; the first
   * violated condition wins so the notification names a single, specific broken term.
   */
  private static detectBreach(contract: InfernalContract, gameState: GameState): string | null {
      for (const clause of contract.clauses) {
          const condition = clause.breachCondition;
          if (!condition) continue;

          switch (condition.kind) {
              case 'max_global_heat': {
                  const heat = gameState.notoriety?.globalHeat ?? 0;
                  if (heat > condition.value) {
                      return `${clause.description} (notoriety ${heat} exceeds the agreed ceiling of ${condition.value})`;
                  }
                  break;
              }
              case 'forbidden_crime': {
                  const crimes = gameState.notoriety?.knownCrimes ?? [];
                  if (crimes.some(crime => crime.type === condition.crimeType)) {
                      return `${clause.description} (a known ${condition.crimeType} stands on the Signee's record)`;
                  }
                  break;
              }
              case 'souls_due': {
                  const overdue = this.isQuotaOverdue(
                      contract,
                      gameState,
                      condition.withinDays,
                      contract.soulsCollected ?? 0,
                      contract.soulsRequired ?? 0
                  );
                  if (overdue) {
                      return `${clause.description} (${contract.soulsCollected ?? 0} of ${contract.soulsRequired ?? 0} souls delivered after ${condition.withinDays} days)`;
                  }
                  break;
              }
              case 'services_due': {
                  const overdue = this.isQuotaOverdue(
                      contract,
                      gameState,
                      condition.withinDays,
                      contract.servicesRendered ?? 0,
                      contract.servicesRequired ?? 0
                  );
                  if (overdue) {
                      return `${clause.description} (${contract.servicesRendered ?? 0} of ${contract.servicesRequired ?? 0} services rendered after ${condition.withinDays} days)`;
                  }
                  break;
              }
          }
      }

      return null;
  }

  /**
   * True once the deadline has passed with the quota unmet. An unsigned contract has no
   * clock, and a quota of zero can never fall short.
   */
  private static isQuotaOverdue(
      contract: InfernalContract,
      gameState: GameState,
      withinDays: number,
      delivered: number,
      required: number
  ): boolean {
      if (contract.dateSigned === undefined) return false;
      if (required <= 0) return false;
      const deadline = contract.dateSigned + withinDays * MS_PER_DAY;
      return gameState.gameTime.getTime() >= deadline && delivered < required;
  }
}
