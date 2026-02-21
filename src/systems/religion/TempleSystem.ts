// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:41:10
 * Dependents: religion/index.ts
 * Imports: 5 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Dispatch } from 'react';
import {
  TempleService,
  GameState
} from '../../types';
import { AppAction } from '../../state/actionTypes';
import { canAffordService, getDivineStanding } from '../../utils/religionUtils';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/core/idGenerator';

export interface ServiceResult {
  success: boolean;
  message: string;
  effectApplied?: string;
  costDeducted?: number;
}

/**
 * System to handle Temple interactions, service validation, and effect application.
 */
export class TempleSystem {

  /**
   * Validates if a party/character can request a service.
   */
  static validateServiceRequest(
    service: TempleService,
    gameState: GameState,
    deityId: string
  ): { allowed: boolean; reason?: string } {
    // RALPH: Divine Gatekeeper.
    // Checks both "Material Wealth" (Gold) and "Spiritual Standing" (Favor).
    // Some high-tier services (Resurrection, Greater Blessing) require specific reputation levels (e.g. 'Devoted').

    // 1. Check Gold & Favor (using utility)
    const currentFavor = gameState.divineFavor[deityId]?.score || 0;
    const affordability = canAffordService(service, gameState.gold, currentFavor);

    if (!affordability.allowed) {
      // Enhance the reason if it's about favor
      if (affordability.reason?.includes('favor')) {
        const minFavor = service.minFavor || 0;
        return {
          allowed: false,
          reason: `Requires '${getDivineStanding(minFavor)}' standing with deity (${minFavor} favor).`
        };
      }
      return affordability;
    }

    // 2. Check Complex Requirements (Items, Quests)
    if (service.requirement) {
      // Item cost check
      if (service.requirement.itemCost) {
        const { itemId, count } = service.requirement.itemCost;
        const ownedCount = gameState.inventory.filter(i => i.id === itemId).length;
        const hasItem = ownedCount >= count;
        if (!hasItem) return { allowed: false, reason: `Missing required item offering.` };
      }
      // Quest requirement check would go here
    }

    return { allowed: true };
  }

  /**
   * Performs the service transaction: deducts gold and applies effects.
   */
  static performService(
    service: TempleService,
    gameState: GameState,
    deityId: string,
    dispatch: Dispatch<AppAction>
  ): ServiceResult {
    // Re-validate just in case
    const validation = this.validateServiceRequest(service, gameState, deityId);
    if (!validation.allowed) {
      return { success: false, message: validation.reason || 'Service denied.' };
    }

    // 1. Deduct Gold
    if (service.costGp && service.costGp > 0) {
      dispatch({
        type: 'REMOVE_GOLD',
        payload: service.costGp
      });
    }

    // 2. Apply Effect
    const effectResult = this.resolveServiceEffect(service, gameState, deityId, dispatch);

    // 3. Log/Notify
    logger.info(`Temple Service Performed: ${service.name} (${service.id})`, { deityId, cost: service.costGp });

    // Handle effect logging safely
    let effectLogString: string;
    if (typeof service.effect === 'string') {
      effectLogString = service.effect;
    } else {
      effectLogString = JSON.stringify(service.effect);
    }

    return {
      success: true,
      message: effectResult.message,
      costDeducted: service.costGp,
      effectApplied: effectLogString
    };
  }

  /**
   * Resolves the effect string/object into actual game actions.
   */
  private static resolveServiceEffect(
    service: TempleService,
    gameState: GameState,
    deityId: string,
    dispatch: Dispatch<AppAction>
  ): { message: string } {
    const effect = service.effect;

    // Handle string effects (legacy/data stubs)
    if (typeof effect === 'string') {
      switch (effect) {
        case 'grant_blessing_minor':
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: generateId(),
              type: 'success',
              message: 'You feel a warm presence. (Minor Blessing granted)'
            }
          });
          // TODO: Dispatch actual ADD_BLESSING action once available
          return { message: 'You have been blessed.' };

        case 'heal_20_hp':
          // Heal all party members
          gameState.party.forEach(char => {
            dispatch({
              type: 'HEAL_CHARACTER',
              payload: { characterId: char.id, amount: 20 }
            });
          });
          return { message: 'The divine light heals your wounds.' };

        case 'remove_curse':
          // Logic to remove curses
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: generateId(),
              type: 'info',
              message: 'A cleansing wave washes over you.'
            }
          });
          return { message: 'You feel a heavy burden lift.' };

        case 'Divine Intervention':
          return { message: 'The deity acknowledges your plea. (Narrative Event Triggered)' };

        default:
          // Specific named blessings from data
          if (effect.startsWith('grant_blessing_')) {
            return { message: 'You receive a specific divine blessing.' };
          }
          logger.warn(`Unknown temple effect string: ${effect}`);
          return { message: 'The ritual concludes.' };
      }
    }

    // Handle structured effects (future proofing)
    if (typeof effect === 'object') {
      if (effect.type === 'heal') {
        const amount = effect.value || 10;
        gameState.party.forEach(char => {
          dispatch({
            type: 'HEAL_CHARACTER',
            payload: { characterId: char.id, amount }
          });
        });
        return { message: `Party healed for ${amount} HP.` };
      }
    }

    return { message: 'Service completed.' };
  }
}
