/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/shipFaction.ts
 * Resolves which faction a hull sails under, including the save-safe default
 * for ships written before Ship.factionId existed.
 */

import { Ship } from '../../types/naval';
import { PlayerFactionStanding } from '../../types/factions';

/**
 * The flag a hull with no recorded allegiance sails under.
 *
 * The Iron Ledger is the faction that controls the trade routes and the capital
 * region (see src/data/factions.ts), so a ship whose papers say nothing is
 * assumed to be sailing on its ledger. This is the campaign home faction: one
 * named constant rather than a per-call default, so a save migrated today and a
 * save migrated next session land on the same flag.
 */
export const CAMPAIGN_HOME_FACTION_ID = 'iron_ledger';

/** Standing a faction holds toward the player when it has no standing record yet. */
export const NEUTRAL_FACTION_STANDING = 0;

/**
 * Maps an FMG burg id to the faction that holds that port. Callers own this
 * registry; the naval system never invents one.
 */
export type PortFactionRegistry = Readonly<Record<number, string>>;

/**
 * The faction a ship sails under.
 *
 * Order, and why:
 * 1. `ship.factionId` when the save carries it — the recorded answer wins.
 * 2. The faction holding the port the ship is docked at, when the registry
 *    knows that burg. This is "the port of purchase" for an old save: the only
 *    port a pre-migration hull has on record is where it last tied up.
 * 3. {@link CAMPAIGN_HOME_FACTION_ID}.
 *
 * Pure and total: every ship resolves to exactly one faction id, so the mutiny
 * check never has to ask whether a hull has a flag.
 */
export function resolveShipFactionId(ship: Ship, portFactions: PortFactionRegistry): string {
  if (ship.factionId) return ship.factionId;

  const dockedBurgId = ship.dockedPortBurgId;
  if (dockedBurgId != null) {
    const portFaction = portFactions[dockedBurgId];
    if (portFaction) return portFaction;
  }

  return CAMPAIGN_HOME_FACTION_ID;
}

/**
 * Stamps the resolved faction onto a ship so the next save carries it and the
 * migration runs exactly once per hull. Returns the same object when the ship
 * already has a flag, so callers can skip a needless clone.
 */
export function withResolvedShipFaction(ship: Ship, portFactions: PortFactionRegistry): Ship {
  if (ship.factionId) return ship;
  return { ...ship, factionId: resolveShipFactionId(ship, portFactions) };
}

/**
 * The player's public standing with the faction this ship sails under.
 *
 * Public standing, not secret: the lower deck grumbles about what it has heard,
 * not about what the captain has actually done. A faction with no standing
 * record is {@link NEUTRAL_FACTION_STANDING} — that is the same seed value
 * INITIAL_FACTION_STANDINGS writes for every known faction.
 */
export function shipFactionStanding(
  ship: Ship,
  standings: Readonly<Record<string, PlayerFactionStanding>>,
  portFactions: PortFactionRegistry
): number {
  const factionId = resolveShipFactionId(ship, portFactions);
  const standing = standings[factionId];
  return standing ? standing.publicStanding : NEUTRAL_FACTION_STANDING;
}
