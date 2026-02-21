// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 * 
 * Last Sync: 21/02/2026, 02:41:06
 * Dependents: None (Orphan)
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { StolenItem, Fence } from '../../../types/crime';
import { PlayerCharacter } from '../../../types/character';
import { Item } from '../../../types';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState } from '../../../types';
import { generateId } from '../../../utils/core/idGenerator';

export interface FenceTransactionResult {
  success: boolean;
  goldEarned: number;
  heatGenerated: number;
  message: string;
}

export class FenceSystem {
  /**
   * Generates a fence NPC for a given location.
   */
  // TODO(lint-intent): 'locationName' is an unused parameter, which suggests a planned input for this flow.
  // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
  // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
  static generateFence(locationId: string, _locationName: string): Fence {
    const acceptedCategories = this.getRandomCategories();
    // Cut is between 20% and 50%
    const cut = 0.2 + (Math.random() * 0.3);

    return {
      id: generateId(),
      npcId: `fence_${locationId}_${generateId().slice(0, 8)}`,
      locationId,
      gold: Math.floor(500 + Math.random() * 2000), // 500-2500 gold
      acceptedCategories,
      cut
    };
  }

  /**
   * Evaluates how much a fence is willing to pay for an item.
   * Returns null if the fence refuses the item.
   */
  static evaluateItem(
    item: StolenItem,
    fence: Fence,
    player: PlayerCharacter
  ): number | null {
    const itemTags = (item as StolenItem & { tags?: string[] }).tags ?? [];
    // 1. Check if item category is accepted
    const isAccepted = itemTags.some(tag => fence.acceptedCategories.includes(tag));

    // Allow "valuable" or "art" tags as wildcards for fences
    const isUniversallyAccepted = itemTags.includes('valuable') || itemTags.includes('art');

    if (!isAccepted && !isUniversallyAccepted) {
      return null;
    }

    // 2. Base value calculation (Market Value * (1 - Fence Cut))
    let offer = item.value * (1 - fence.cut);

    // 3. Adjust for social skills (Persuasion/Deception)
    const socialBonus = this.calculateSocialBonus(player);
    offer = offer * (1 + socialBonus);

    // 4. Heat penalty: Hot items are worth less
    // This requires passing the heat context, but for now we'll assume a standard penalty
    // if we had the heat level. Since StolenItem has timestamp, we could use that.
    // Let's assume stale items are safer.
    const hoursSinceTheft = (Date.now() - item.stolenAt) / (1000 * 60 * 60);
    if (hoursSinceTheft < 24) {
      offer *= 0.8; // 20% penalty for "hot" items (stolen < 24h ago)
    }

    return Math.floor(offer);
  }

  /**
   * Executes the sale of a stolen item.
   */
  static sellItem(
    item: StolenItem,
    fence: Fence,
    player: PlayerCharacter
  ): FenceTransactionResult {
    const offer = this.evaluateItem(item, fence, player);

    if (offer === null) {
      return {
        success: false,
        goldEarned: 0,
        heatGenerated: 0,
        message: "The fence isn't interested in this type of goods."
      };
    }

    if (fence.gold < offer) {
      return {
        success: false,
        goldEarned: 0,
        heatGenerated: 0,
        message: "The fence doesn't have enough coin to cover this."
      };
    }

    // Calculate Heat Risk
    // Selling to a fence generates a small amount of heat (suspicion),
    // especially if the item is very valuable.
    const heatGenerated = Math.floor(item.value / 100);

    // Success!
    return {
      success: true,
      goldEarned: offer,
      heatGenerated: heatGenerated,
      message: `Sold ${item.name} for ${offer} gp.`
    };
  }

  /**
   * Processes a transaction, returning the updated entities.
   * NOTE: This is a pure function that returns new object states.
   * It is up to the caller (Reducer/ActionHandler) to apply these changes to the GameState.
   */
  static processTransaction(
    item: StolenItem,
    fence: Fence,
    player: PlayerCharacter,
  ): {
    updatedPlayer: PlayerCharacter;
    updatedFence: Fence;
    result: FenceTransactionResult;
  } {
    const result = this.sellItem(item, fence, player);

    if (!result.success) {
      return { updatedPlayer: player, updatedFence: fence, result };
    }

    // Clone objects to avoid mutation
    // TODO(2026-01-03 pass 4 Codex-CLI): PlayerCharacter doesn't own inventory; keep an ad-hoc inventory bridge until state flow is refactored.
    const updatedPlayer: PlayerCharacter & { gold: number; inventory: Item[] } = {
      ...player,
      gold: (player as PlayerCharacter & { gold?: number }).gold ?? 0,
      inventory: [...((player as PlayerCharacter & { inventory?: Item[] }).inventory ?? [])]
    };
    const updatedFence = { ...fence };

    // Update Player: Add Gold, Remove Item
    updatedPlayer.gold += result.goldEarned;
    updatedPlayer.inventory = updatedPlayer.inventory.filter((i) => i.id !== item.id);

    // Update Fence: Remove Gold
    updatedFence.gold -= result.goldEarned;

    return {
      updatedPlayer,
      updatedFence,
      result
    };
  }

  private static calculateSocialBonus(player: PlayerCharacter): number {
    // Simple bonus: +2% per +1 CHA mod, max +20%
    // TODO(2026-01-03 pass 4 Codex-CLI): fallback charisma until player stats are guaranteed.
    const charisma = player.stats?.charisma ?? 10;
    const mod = Math.floor((charisma - 10) / 2);
    const bonus = Math.max(0, mod * 0.02);
    return Math.min(0.2, bonus);
  }

  private static getRandomCategories(): string[] {
    const categories = ['weapon', 'armor', 'potion', 'scroll', 'gem', 'art', 'magic_item', 'contraband'];
    // Return 2-4 random categories
    const count = 2 + Math.floor(Math.random() * 3);
    const shuffled = categories.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}
