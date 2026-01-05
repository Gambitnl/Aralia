// TODO(lint-intent): 'Location' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Location as _Location } from '../../types/world';
import { GameState } from '../../types';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';
import { TradeRoute, MarketEventType, MarketEvent } from '../../types/economy';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';
import { getEventPriceModifier } from '../../utils/economy/marketEvents';

/**
 * System for managing trade routes between locations
 */
export class TradeRouteSystem {
  // Logger is exported as a singleton instance 'logger', not a class 'Logger'
  private static log = logger;

  /**
   * Calculates the profitability of a route based on supply/demand and events.
   * Logic:
   * 1. Check if goods are Exported by Origin (Cheap buying price)
   * 2. Check if goods are Imported by Destination (Expensive selling price)
   * 3. Apply Market Event modifiers (e.g. War increases Weapon demand)
   * 4. Deduct risk factor
   *
   * @param route The trade route to evaluate
   * @param marketEvents Active global market events
   * @returns A score from 0-100 representing profit margin
   */
  static calculateProfitability(route: TradeRoute, marketEvents: MarketEvent[] = []): number {
    const origin = REGIONAL_ECONOMIES[route.originId];
    const destination = REGIONAL_ECONOMIES[route.destinationId];

    if (!origin || !destination) {
      this.log.warn(`Invalid regions for route ${route.id}: ${route.originId} -> ${route.destinationId}`);
      return 50; // Default if data missing
    }

    let totalScore = 0;

    // Evaluate each good category on the route
    for (const goodCategory of route.goods) {
      let score = 50; // Base baseline

      // SUPPLY: Is it cheap at origin?
      if (origin.exports.includes(goodCategory)) {
        score += 20; // Buying cheap
      } else if (origin.imports.includes(goodCategory)) {
        score -= 20; // Buying expensive
      }

      // DEMAND: Is it wanted at destination?
      if (destination.imports.includes(goodCategory)) {
        score += 30; // Selling high
      } else if (destination.exports.includes(goodCategory)) {
        score -= 10; // Selling to a producer
      }

      // EVENTS: Check for global events affecting this category
      const eventMod = getEventPriceModifier(goodCategory, marketEvents);
      // If eventMod > 1 (High Price), it's good for the seller (Destination)
      if (eventMod > 1.0) {
        score += (eventMod - 1.0) * 40; // Significant boost
      } else if (eventMod < 1.0) {
        score -= (1.0 - eventMod) * 20; // Dampened profit
      }

      totalScore += score;
    }

    // Average across goods
    let avgScore = route.goods.length > 0 ? totalScore / route.goods.length : 50;

    // RISK FACTOR deduction
    avgScore -= (route.riskLevel * 20);

    // Clamp 0-100
    return Math.max(0, Math.min(100, Math.round(avgScore)));
  }

  /**
   * Calculates the risk level of a route
   */
  static calculateRisk(route: TradeRoute, marketEvents: MarketEvent[] = []): number {
    let risk = route.riskLevel;

    // Use MarketEventType and name/desc keywords for risk
    for (const event of marketEvents) {
      // War or Bandit activity increases risk
      if (event.type === MarketEventType.WAR_TAX ||
          (event.name && event.name.toLowerCase().includes('bandit')) ||
          (event.name && event.name.toLowerCase().includes('war'))) {
        risk += 0.2;
      }

      if (event.type === MarketEventType.FESTIVAL) {
        risk -= 0.1;
      }
    }

    return Math.max(0, Math.min(1.0, risk));
  }

  /**
   * Generates a new trade route between two regions
   */
  static createRoute(originId: string, destinationId: string, goods: string[], baseRisk: number = 0.2): TradeRoute {
    const routeId = (generateId as unknown as (prefix?: string) => string)('route');
    return {
      id: routeId,
      name: `Trade Route ${originId}-${destinationId}`,
      originId,
      destinationId,
      goods,
      status: 'active',
      riskLevel: baseRisk,
      profitability: 50 // Will be recalculated
    };
  }

  /**
   * Simulates a caravan journey along a trade route
   * @returns true if successful, false if attacked/lost
   */
  static simulateCaravan(route: TradeRoute, gameState: GameState): boolean {
    const risk = this.calculateRisk(route, gameState.economy.marketEvents);
    const roll = Math.random();

    if (roll < risk) {
      this.log.info(`Caravan on route ${route.id} was attacked! (Risk: ${risk.toFixed(2)}, Roll: ${roll.toFixed(2)})`);
      return false;
    }

    this.log.info(`Caravan on route ${route.id} arrived safely.`);
    return true;
  }
}
