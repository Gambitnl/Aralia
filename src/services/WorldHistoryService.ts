// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:02:31
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/WorldHistoryService.ts
 * Service for converting real-time game outcomes into permanent historical records.
 */

import { WorldHistoryEvent, HistoricalParticipant } from '../types/history';
import { Faction } from '../types/factions';
import { generateId } from '../utils/core/idGenerator';
import { getGameDay, getGameEpoch } from '../utils/core/timeUtils';
import { SeededRandom } from '../utils/random';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FirstBuildHistorySeed {
  worldSeed: number;
  factions: Record<string, Faction>;
  settlingLocationHints?: string[];
  worldBirthTime?: Date;
}

export class WorldHistoryService {
  /**
   * Builds a deterministic first-build world history contract for map/game initialization.
   *
   * This does not mutate source-of-truth geometry data (it only consumes inputs and
   * emits an additive history payload) so it preserves the current 2D/3D split.
   */
  static createFirstBuildHistory(seedInput: FirstBuildHistorySeed): {
    events: WorldHistoryEvent[];
  } {
    const {
      worldSeed,
      factions,
      settlingLocationHints = [],
      worldBirthTime = getGameEpoch(),
    } = seedInput;

    const factionsById = Object.values(factions || {}).sort((a, b) => a.id.localeCompare(b.id));
    const baseDay = getGameDay(worldBirthTime);
    const baseRealtime = worldBirthTime.getTime();
    const rng = new SeededRandom(worldSeed);

    if (factionsById.length === 0) {
      return {
        events: [
          {
            id: this.makeEventId('first_world_seed', worldSeed, 0),
            timestamp: baseDay,
            realtime: baseRealtime,
            type: 'DISCOVERY',
            title: 'The World Springs to Life',
            description:
              'A world is born from first principles. Its first story begins with the landscape itself.',
            participants: [],
            importance: 15,
            tags: ['world_birth', 'empty_faction_set', 'seeded_history'],
          },
        ],
      };
    }

    const sovereignA = this.pickFaction(factionsById, rng);
    const sovereignB = this.pickFaction(factionsById, rng, new Set([sovereignA.id]));
    const witness = this.pickFaction(factionsById, rng, new Set([sovereignA.id, sovereignB.id]));

    const settlementChoices = settlingLocationHints.length > 0
      ? [...settlingLocationHints]
      : [`${sovereignA.name} Crossing`];
    const foundedSettlement = settlementChoices[Math.floor(rng.next() * settlementChoices.length)]
      || `${sovereignA.name} Crossing`;

    const events: WorldHistoryEvent[] = [
      {
        id: this.makeEventId('first_pact', worldSeed, 0),
        timestamp: baseDay,
        realtime: baseRealtime,
        type: 'POLITICAL_SHIFT',
        title: `${sovereignA.name} and ${sovereignB.name} forge the First Accord`,
        description: `${sovereignA.name} and ${sovereignB.name} agree to define boundaries, caravan routes, and hostilities after the world is drawn into being.`,
        participants: [
          this.makeFactionParticipant(sovereignA, 'instigator'),
          this.makeFactionParticipant(sovereignB, 'victim'),
        ],
        importance: 45,
        tags: ['world_birth', 'founding', 'politics', sovereignA.id, sovereignB.id],
      },
      {
        id: this.makeEventId('first_settlement', worldSeed, 1),
        timestamp: baseDay + 1,
        realtime: baseRealtime + DAY_MS,
        type: 'HEROIC_DEED',
        title: `${sovereignA.name} founds ${foundedSettlement}`,
        description: `${sovereignA.name} establishes ${foundedSettlement}, creating the first durable foothold in the newborn map.`,
        participants: [
          this.makeFactionParticipant(sovereignA, 'hero'),
          this.makeFactionParticipant(sovereignB, 'observer'),
        ],
        importance: 35,
        tags: ['world_birth', 'settlement', 'founding', sovereignA.id],
      },
    ];

    if (factionsById.length > 1) {
      const challenger = factionsById[0].id === witness.id
        ? factionsById[1] || witness
        : witness;

      events.push({
        id: this.makeEventId('founder_conflict', worldSeed, 2),
        timestamp: baseDay + 2,
        realtime: baseRealtime + DAY_MS * 2,
        type: 'MAJOR_BATTLE',
        title: `${challenger.name} contests the newborn frontier`,
        description: `A quick clash of blades and banners erupts near ${foundedSettlement} as ${challenger.name} tests the new order.`,
        participants: [
          this.makeFactionParticipant(sovereignA, 'instigator'),
          this.makeFactionParticipant(challenger, 'victim'),
        ],
        importance: 55,
        tags: ['world_birth', 'frontier', 'struggle', sovereignA.id, challenger.id],
      });
    }

    if (factionsById.length > 2) {
      const distantActor = this.pickFaction(factionsById, rng, new Set([sovereignA.id, sovereignB.id, witness.id]));
      const destination = settlingLocationHints[Math.floor(rng.next() * (settlingLocationHints.length || 1))]
        || foundedSettlement;

      events.push({
        id: this.makeEventId('discovery', worldSeed, 3),
        timestamp: baseDay + 3,
        realtime: baseRealtime + DAY_MS * 3,
        type: 'DISCOVERY',
        title: `${distantActor.name} charts ${destination}`,
        description: `${distantActor.name} records a strategic route and marks ${destination} as a shared landmark in early frontier maps.`,
        participants: [this.makeFactionParticipant(distantActor, 'hero')],
        importance: 30,
        tags: ['world_birth', 'discovery', distantActor.id],
      });
    }

    return { events };
  }

  private static makeEventId(prefix: string, worldSeed: number, index: number): string {
    const normalizedSeed = Math.abs(Math.floor(worldSeed));
    return `wh-${prefix}-${normalizedSeed}-${index}`;
  }

  private static makeFactionParticipant(
    faction: Faction,
    role: HistoricalParticipant['role'],
  ): HistoricalParticipant {
    return {
      id: faction.id,
      name: faction.name,
      role,
      type: 'faction',
    };
  }

  private static pickFaction(
    factions: Faction[],
    rng: SeededRandom,
    exclude: Set<string> = new Set(),
  ): Faction {
    const options = factions.filter((faction) => !exclude.has(faction.id));

    if (options.length === 0) {
      return options[Math.floor(rng.next() * options.length)] ?? factions[0];
    }

    return options[Math.floor(rng.next() * options.length)] ?? factions[0];
  }

    /**
     * Base importance assigned to a skirmish when no strength signal is available.
     * Also the floor the derived importance is measured up from.
     */
    private static readonly SKIRMISH_BASE_IMPORTANCE = 40;
    /** Importance is clamped to this band so a single clash never dominates the ledger. */
    private static readonly SKIRMISH_MIN_IMPORTANCE = 20;
    private static readonly SKIRMISH_MAX_IMPORTANCE = 100;

    /**
     * Derives how memorable a skirmish is from the strength gap between the
     * combatants, using the `power` field the Faction model already exposes
     * (0-100 overall influence/strength).
     *
     * The wider the gap, the more the clash reshapes the balance of power — a
     * lopsided rout or a stunning upset is a far more notable historical event
     * than an even trade of blows, so the importance-aware pruner should keep it
     * longer. When neither faction exposes a usable numeric `power` we fall back
     * to the historical base importance (a no-op relative to the old hardcode).
     */
    private static deriveSkirmishImportance(winner: Faction, loser: Faction): number {
        const base = WorldHistoryService.SKIRMISH_BASE_IMPORTANCE;
        const winnerPower = winner.power;
        const loserPower = loser.power;

        if (
            typeof winnerPower !== 'number' ||
            typeof loserPower !== 'number' ||
            Number.isNaN(winnerPower) ||
            Number.isNaN(loserPower)
        ) {
            return base;
        }

        // Magnitude of the power swing (0 for an even match, up to 100 for a
        // total mismatch across the canonical 0-100 power range).
        const disparity = Math.abs(winnerPower - loserPower);
        const importance = base + disparity;

        return Math.round(
            Math.min(
                WorldHistoryService.SKIRMISH_MAX_IMPORTANCE,
                Math.max(WorldHistoryService.SKIRMISH_MIN_IMPORTANCE, importance),
            ),
        );
    }

    /**
     * Converts a faction skirmish outcome into a WorldHistoryEvent.
     */
    static createSkirmishEvent(
        winner: Faction,
        loser: Faction,
        gameTime: Date
    ): WorldHistoryEvent {
        const gameDay = getGameDay(gameTime);
        
        const participants: HistoricalParticipant[] = [
            {
                id: winner.id,
                name: winner.name,
                role: 'instigator', // For simplicity, we assign roles
                type: 'faction'
            },
            {
                id: loser.id,
                name: loser.name,
                role: 'victim',
                type: 'faction'
            }
        ];

        return {
            id: `hist-${generateId()}`,
            timestamp: gameDay,
            realtime: Date.now(),
            type: 'MAJOR_BATTLE',
            title: `The Skirmish of ${winner.name} and ${loser.name}`,
            description: `A violent confrontation occurred between ${winner.name} and ${loser.name}. ${winner.name} emerged victorious, solidifying their influence while ${loser.name} was forced to retreat.`,
            participants,
            // Scale importance with the power swing so the retention pruner keeps
            // major upsets/routs and can shed even, mundane clashes (history G5).
            importance: WorldHistoryService.deriveSkirmishImportance(winner, loser),
            tags: ['war', 'faction_conflict', winner.id, loser.id]
        };
    }
}
