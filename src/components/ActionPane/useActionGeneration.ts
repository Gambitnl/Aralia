// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:20:35
 * Dependents: components/ActionPane/index.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useMemo } from 'react';
import { Action, Location, NPC, Item } from '../../types';
import { useOptionalGameState } from '../../state/GameContext';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { isWildernessLocationId } from '../../utils/location/cellLocationId';
import type { BusinessType, WorldBusiness } from '../../types/business';

/**
 * Map a worldforge business type to the closest legacy merchant-type string the
 * MerchantModal chain understands. `handleOpenDynamicMerchant` treats merchantType
 * as a free label (it feeds the tavern-hire substring check and the deterministic
 * inventory generator), so the returned string must (a) carry "tavern"/"inn" for
 * drinking houses and (b) be a stable, type-appropriate shop key. Explicit map,
 * no silent fallback — an unmapped type routes to the general store on purpose.
 */
export function merchantTypeForBusiness(businessType: BusinessType): string {
  switch (businessType) {
    case 'tavern': return 'shop_tavern';
    case 'smithy': return 'shop_blacksmith';
    case 'apothecary': return 'shop_apothecary';
    case 'enchanter_shop': return 'shop_enchanter';
    case 'general_store':
    case 'trading_company':
    case 'mine':
    case 'farm':
      return 'shop_general';
  }
}

interface UseActionGenerationProps {
  currentLocation: Location;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
}

export const useActionGeneration = ({
  currentLocation,
  npcsInLocation,
  itemsInLocation,
}: UseActionGenerationProps) => {
  // Optional so the hook still works when rendered outside a GameProvider (e.g.
  // isolated hook tests). When present, it lets us detect whether the player is
  // standing in a tracked living-world town and surface the notice board.
  const gameContext = useOptionalGameState();

  const generalActions = useMemo(() => {
    const actions: Action[] = [];

    // Populate interactions for NPCs and Items in current location.
    // npcsInLocation is already the authoritative resolved set (static plus
    // dynamically-placed situation/town NPCs from getCurrentNPCs), so we always
    // surface a Talk action for each — including on procedural coord_ tiles,
    // where the opening situation places its strangers. Without this a fresh
    // player can see those NPCs in the scene but has no way to talk to them.
    // Index the player's town businesses by owner so per-NPC shop/recruit
    // affordances can resolve their linked business in O(1). Populated only when
    // rendered inside a GameProvider; empty for isolated hook tests.
    const gsForNpcs = gameContext?.state;
    const businessByOwner = new Map<string, WorldBusiness>();
    if (gsForNpcs?.worldBusinesses) {
      for (const biz of Object.values(gsForNpcs.worldBusinesses)) {
        businessByOwner.set(biz.ownerId, biz);
      }
    }

    npcsInLocation.forEach((npc) => {
      actions.push({ type: 'talk', label: `Talk to ${npc.name}`, payload: { targetNpcId: npc.id }, targetId: npc.id });

      const business = businessByOwner.get(npc.id);

      // Packet B — Browse Goods: a talk-target who owns a business gets a second
      // action that revives the whole MerchantModal chain (NPC reuse → inventory
      // → OPEN_MERCHANT → buy/sell/haggle) with a single OPEN_DYNAMIC_MERCHANT
      // dispatch. merchantType maps the wf business type to the legacy shop key
      // the handler + deterministic inventory generator expect; buildingId is the
      // NPC id (1:1 registry key); seedKey is the business id (stable inventory).
      if (business) {
        const merchantType = merchantTypeForBusiness(business.businessType);
        actions.push({
          type: 'OPEN_DYNAMIC_MERCHANT',
          label: `Browse Goods — ${business.name}`,
          payload: { merchantType, buildingId: npc.id, seedKey: business.id },
        });

        // Packet D(1) — tavern/inn keepers can be hired into the party. Routes
        // through the SAME dynamic-merchant handler with hire:true, which
        // short-circuits into the shared recruit pipeline (consent → convert →
        // RECRUIT_COMPANION). Consent may still refuse; that is correct.
        if (business.businessType === 'tavern') {
          actions.push({
            type: 'OPEN_DYNAMIC_MERCHANT',
            label: `Hire ${npc.name}`,
            payload: { merchantType, buildingId: npc.id, seedKey: business.id, hire: true },
          });
        }
      }

      // Packet D(2) — any generated NPC (town keeper or opening stranger) can be
      // invited to join. This is a talk action carrying a recruitOffer, consumed
      // up front by handleTalk → handleRecruitOffer. evaluateRecruitOffer gates on
      // disposition and can decline, so the offer is safe to surface broadly.
      if (gsForNpcs?.generatedNpcs?.[npc.id]) {
        actions.push({
          type: 'talk',
          label: `Ask ${npc.name} to join you`,
          payload: { targetNpcId: npc.id, recruitOffer: { targetNpcId: npc.id } },
          targetId: npc.id,
        });
      }
    });

    // Take actions for items present at the location. itemsInLocation is the
    // authoritative resolved set for BOTH named locations (authored itemIds) and
    // procedural coord_ tiles (items foraged onto the tile via "Search the Area",
    // resolved from dynamicLocationItemIds in App), so we surface a Take for each
    // unconditionally — the old coord_ guard meant foraged wilderness loot could
    // never be picked up.
    itemsInLocation.forEach((item) => {
      actions.push({ type: 'take_item', label: `Take ${item.name}`, payload: { itemId: item.id }, targetId: item.id });
    });

    // Wilderness foraging: only procedural coord_ tiles (named locations use their
    // authored loot). Always offered — the handler reports "already searched" if the
    // tile was foraged before, so a single tile cannot be farmed for repeat loot.
    if (isWildernessLocationId(currentLocation.id)) {
      actions.push({ type: 'SEARCH_AREA', label: 'Search the Area' });
    }

    // Grid retirement: overworld navigation is the cell-native World Map, so the
    // 30x20 named-exit "Go <dir>" moves and the submap grid-adjacency village
    // detection are removed. Village/town entry comes from the predefined-location
    // check below (Method 2) and from Enter-3D on the map.

    // Grid retirement: the legacy 2D village view is retired, so the
    // "Enter Town" / "Scout Town" / "Approach" actions that routed into it are
    // gone. Town entry is Enter-3D on the world map (the cell-native 3D town).

    currentLocation.interactableFeatures?.forEach((feature) => {
      if (feature.type === 'lock') {
        actions.push({
          type: 'OPEN_LOCKPICKING_MODAL',
          label: feature.label,
          payload: feature.lock,
        });
      }

      if (feature.type === 'puzzle') {
        actions.push({
          type: 'OPEN_PUZZLE_RUNTIME',
          label: feature.label,
          payload: feature.puzzle,
        });
      }
    });

    // Town notice board: offered only when the player is standing in a tracked
    // living-world town (resolveTownForLocation returns a town). The modal
    // computes its own news live from gameState, so no payload is attached here.
    const gs = gameContext?.state;
    if (gs && resolveTownForLocation({
      currentLocationId: gs.currentLocationId,
      worldSeed: gs.worldSeed,
      cellId: gs.playerCell?.cellId ?? null,
      townSim: gs.townSim,
      gameTime: gs.gameTime,
    })) {
      actions.push({ type: 'OPEN_NOTICE_BOARD', label: 'Read the Notice Board' });
      // The broadsheet draws from the same tracked town; offered alongside the
      // notice board. The modal computes its own news live, so no payload here.
      actions.push({ type: 'OPEN_BROADSHEET', label: 'Read the latest broadsheet' });
      // Take a physical broadsheet keepsake: the handler freezes the town's
      // current news into an inventory Book the player can read after leaving.
      actions.push({ type: 'TAKE_BROADSHEET', label: 'Take a broadsheet' });
    }

    return actions;
  }, [currentLocation, npcsInLocation, itemsInLocation, gameContext]);

  return { generalActions };
};
