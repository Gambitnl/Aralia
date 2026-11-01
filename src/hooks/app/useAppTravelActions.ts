/** Commits a chosen map journey through the existing reducer and combat launchers. Movement, clock, discoveries, provisions, ferry fare, forced-march rolls and encounter messages keep their original order. App remains the state owner. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 09:38:09
 * Dependents: App.tsx, components/layout/AppShell.tsx, hooks/app/useAppAtlasEntry.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, type Dispatch } from "react";
import { DiscoveryType, type WorldCellView } from "../../types";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import type { TravelMeta } from "../../types/travelMeta";
import { BIOMES } from "../../data/biomes";
import { LOCATIONS } from "../../data/world/locations";
import { determineActiveDynamicNpcsForLocation } from "@/utils/spatial";
import { makeCellLocationId } from "../../utils/location/cellLocationId";
import { buildProvisionActions } from "../../systems/travel/applyProvision";
import { resolveForcedMarch } from "../../systems/travel/forcedMarch";
import { rollD20 } from "../../systems/dice/rollers";
import { formatTravelTime } from "../../systems/travel/travelReadout";
import { prepareTravelBattlefield } from "../../systems/travel/prepareTravelBattlefield";
import { prepareCompanionJourney } from "../../systems/companions/companionJourney";
import { hasPersonalPartyProvisions, spendPartyProvisions } from "../../systems/travel/partyProvisions";

export function useAppTravelActions(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
  addMessage: (text: string, sender?: "system" | "player" | "npc") => void,
) {
  const handleTileClick = useCallback(
    (x: number, y: number, cell: WorldCellView, travelMeta?: TravelMeta, options?: { preserveMapVisibility?: boolean; prepareEncounter?: () => Promise<{ extractedBattleMap?: import("../../types/combat").BattleMapData; sourceGapDetail?: string }> }) => {
      const targetBiome = BIOMES[cell.biomeId];
      // Travel-mode picks carry the planned route's real duration + a pre-rolled
      // "danger on the road" message; fall back to the legacy flat hour otherwise.
      // Navigation drift (travel G2): when MapPane's get-lost roll failed, the party
      // wanders for extra hours before finding the path again. That lost time is
      // added to the trip's clock advance (present ONLY when lost; a found trip
      // carries no navDrift, so short/on-road trips are unaffected).
      const driftSeconds = travelMeta?.navDrift?.lost
        ? Math.max(0, Math.round(travelMeta.navDrift.extraSeconds))
        : 0;
      // Trip event (mountains §3): MapPane rolled one seeded event for this land
      // trip. A `delay` outcome (rockslide, storm) costs extra hours on the clock,
      // added like drift; flavor-only events carry extraSeconds 0. Present only
      // when an event fired, so quiet trips are unaffected.
      const tripEventSeconds = travelMeta?.tripEvent
        ? Math.max(0, Math.round(travelMeta.tripEvent.extraSeconds))
        : 0;
      const travelSeconds =
        (travelMeta?.seconds != null
          ? Math.max(0, Math.round(travelMeta.seconds))
          : 3600) +
        driftSeconds +
        tripEventSeconds;
      // Reducer actions retain their original order. Give arrival records their
      // reached time now, including delays, without advancing the clock twice.
      const arrivalGameTime = new Date(gameState.gameTime.getTime() + travelSeconds * 1000).toISOString();
      const announceEncounter = () => {
        if (travelMeta?.encounterMessage)
          addMessage(travelMeta.encounterMessage, "system");
      };
      // Announce the navigation drift after the move: the party still arrives at the
      // intended cell, but the log tells them they lost their way and the time cost.
      const announceNavDrift = () => {
        const nd = travelMeta?.navDrift;
        if (!nd?.lost) return;
        const hours = nd.extraSeconds / 3600;
        const rounded = Math.max(1, Math.round(hours));
        // Word by cause: a path that faded under the trees reads differently from
        // trackless wilds; both keep the drift heading + hours-lost structure.
        const lead =
          nd.cause === "faint-path"
            ? "The path fades among the trees — you lose the trail"
            : "You lose your way";
        addMessage(
          `${lead} and drift ${nd.driftDirection}, costing you about ${rounded} extra hour${rounded === 1 ? "" : "s"} before you find the path again.`,
          "system",
        );
      };
      // Announce the trip event after the move (mountains §3): the event's own
      // message already reads as a resolved beat (e.g. a rockslide the party
      // climbed past, or failed and lost hours to). The delay is already folded
      // into travelSeconds above; this just tells the story.
      const announceTripEvent = () => {
        const te = travelMeta?.tripEvent;
        if (te?.message) addMessage(te.message, "system");
      };
      // A rolled road ambush now reaches the combat authority boundary on arrival
      // instead of only printing a message. It is fired after movement so the
      // destination cell is known. Until this caller projects that cell into a
      // tactical map, CombatView shows the explicit source gap rather than an arena.
      const triggerTravelEncounter = () => {
        const enc = travelMeta?.encounter;
        if (!enc?.monsters?.length) return;
        void (async () => {
          try {
          const { extractedBattleMap, sourceGapDetail } =
            await (options?.prepareEncounter ? options.prepareEncounter() : prepareTravelBattlefield(enc, travelMeta?.destinationCell, {
              worldSeed: gameState.worldSeed,
              gameTime: gameState.gameTime,
              worldforgeDeltas: gameState.worldforgeDeltas,
            }));

            if (sourceGapDetail) {
              addMessage(
                `Tactical combat withheld: ${sourceGapDetail}`,
                "system",
              );
            }
            const { handleStartBattleMapEncounter } =
              await import("../actions/handleEncounter");
            await handleStartBattleMapEncounter(dispatch, {
              monsters: enc.monsters,
              ...(extractedBattleMap ? { extractedBattleMap } : {}),
            });
          } catch (err) {
            console.error("[travel encounter] failed to start battle:", err);
            addMessage("Tactical encounter failed to start.", "system");
          }
        })();
      };
      // Apply the trip's provisioning consequences (food/water spend, starvation,
      // companion morale). MapPane resolved these against the route + supplies; here
      // we just execute them after the move so the move and its cost stay atomic.
      const applyProvisionEffects = () => {
        const prov = travelMeta?.provision;
        if (!prov) return;
        const companionViews = Object.values(gameState.companions ?? {}).filter(c => c.inParty && gameState.party.some(person => person.id === c.id)).map(
          (c) => ({ id: c.id, loyalty: c.loyalty }),
        );
        // PRV9: member HP views let a starving march apply its non-lethal HP drain.
        const healthViews = gameState.party
          .filter((pc) => pc.id)
          .map((pc) => ({ id: pc.id as string, hp: pc.hp }));
        const personal = hasPersonalPartyProvisions(gameState);
        if (personal && (prov.rationsToSpend > 0 || prov.waterToSpend > 0)) dispatch({ type: 'SPEND_TRAVEL_PROVISIONS', payload: { rations: prov.rationsToSpend, water: prov.waterToSpend } });
        for (const action of buildProvisionActions(
          prov,
          companionViews,
          healthViews,
        ))
          if (!(personal && action.type === 'REMOVE_ITEM')) dispatch(action);
        if (prov.note) addMessage(prov.note, "system");
      };
      // Deduct the hired-ferry fare on departure (travel G15). MapPane already
      // gated affordability and only stamps `ferryFareGp` when the committed trip
      // crossed a sea leg on a hired ferry, so here we just spend the gold and note
      // it — kept alongside the move so the trip and its cost stay atomic.
      const applyFerryFare = () => {
        const fare = travelMeta?.ferryFareGp;
        if (!fare || fare <= 0) return;
        dispatch({ type: "MODIFY_GOLD", payload: { amount: -fare } });
        addMessage(
          `You pay the ferry master ${fare} gp for passage.`,
          "system",
        );
      };
      // Forced-march exhaustion (travel G1). MapPane stamped `forcedMarch` only when
      // the committed leg pushed past the safe 8-hour day, carrying the derived Con
      // save DC. Here each party member rolls a Constitution save vs that DC; a party
      // whose members buckle takes the 'exhaustion' condition (the same party-wide
      // condition path as travel's 'fatigued'/'starving'). Fired after the move so
      // the leg and its toll stay atomic.
      const applyForcedMarch = () => {
        const fm = travelMeta?.forcedMarch;
        if (!fm) return;
        // Match the route preview instead of rounding elapsed hours into a
        // threshold the party never passed. Only future feedback changes;
        // saved accounts, dice, clock cost and exhaustion remain untouched.
        const duration = formatTravelTime(fm.hours * 60);
        const outcome = resolveForcedMarch(gameState.party, fm.saveDC, () =>
          rollD20(),
        );
        // Show the save that actually resolved, including proficiency in its
        // combined bonus. Never roll again for the log or reconstruct old saves.
        // Existing duration summaries and condition application remain below.
        for (const save of outcome.results) {
          const bonus = save.total - save.roll;
          addMessage(
            `${save.name}: Constitution save — d20 ${save.roll} ${bonus < 0 ? "-" : "+"} ${Math.abs(bonus)} = ${save.total} vs DC ${save.dc} — ${save.failed ? "failed" : "passed"}.`,
            "system",
          );
        }
        if (!outcome.anyFailed) {
          addMessage(
            `After ${duration} of travel, the party endures the forced march (DC ${fm.saveDC} Constitution saves).`,
            "system",
          );
          return;
        }
        for (const res of outcome.results) {
          if (res.failed && res.id) {
            dispatch({
              type: "SET_CHARACTER_CONDITION",
              payload: { characterId: res.id, condition: "exhaustion" },
            });
          }
        }
        const worn = outcome.failedNames.join(", ");
        addMessage(
          `After ${duration} of travel, the forced march takes its toll — ${worn} fail a DC ${fm.saveDC} Constitution save and grow exhausted.`,
          "system",
        );
      };

      // A reached atlas cell becomes durable player knowledge exactly once. The
      // existing discovery log is the single saved source for both Logbook memory
      // and MapPane fog; locationId + cellId flags make reducer dedupe explicit.
      const recordCellDiscovery = (cellId: number, locationId: string) => {
        const alreadyKnown = gameState.discoveryLog.some(
          (entry) =>
            entry.type === DiscoveryType.LOCATION_DISCOVERY &&
            entry.flags.some(
              (flag) => flag.key === "cellId" && flag.value === cellId,
            ),
        );
        if (alreadyKnown) return;
        const placeName =
          travelMeta?.destinationCell?.name ??
          targetBiome?.name ??
          `Cell ${cellId}`;
        dispatch({
          type: "ADD_DISCOVERY_ENTRY",
          payload: {
            // The hook still holds departure state after ADVANCE_TIME. Date
            // this reached-place account at actual arrival, including delays.
            gameTime: arrivalGameTime,
            type: DiscoveryType.LOCATION_DISCOVERY,
            title: `Location Discovered: ${placeName}`,
            content: `You reached ${placeName} and added this atlas cell to your explored world.`,
            source: { type: "LOCATION", id: locationId, name: placeName },
            flags: [
              { key: "locationId", value: locationId, label: placeName },
              { key: "cellId", value: cellId, label: `Atlas cell ${cellId}` },
            ],
            isQuestRelated: false,
            associatedLocationId: locationId,
          },
        });
      };

      if (!targetBiome) {
        addMessage("The nature of this terrain is unknown.", "system");
        return;
      }

      if (!targetBiome.passable) {
        const reason =
          targetBiome.impassableReason ||
          `You cannot travel to the ${targetBiome.name}. It is impassable by normal means.`;
        addMessage(reason, "system");
        return;
      }

      // Consent and actual departure presence are checked before any movement,
      // food, fare, time or risk is committed. MOVE_PLAYER rechecks the receipt.
      const sharedJourney = travelMeta?.routeLineage ? { seconds: travelSeconds, route: travelMeta.routeLineage } : undefined;
      const plannedLocation = cell.locationId ?? (travelMeta?.destinationCell ? makeCellLocationId(travelMeta.destinationCell.cellId) : gameState.currentLocationId);
      const shared = prepareCompanionJourney(gameState, { newLocationId: plannedLocation, destinationCell: travelMeta?.destinationCell, sharedJourney });
      if (shared.error) {
        addMessage(shared.error, 'system');
        dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'info', message: shared.error } });
        return false;
      }
      const provision = travelMeta?.provision;
      if (provision && hasPersonalPartyProvisions(gameState) && !spendPartyProvisions(gameState, provision.rationsToSpend, provision.waterToSpend)) {
        const message = 'The traveling party no longer carries the quoted food and water. Review supplies before setting out.';
        addMessage(message, 'system'); dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'info', message } }); return false;
      }

      if (
        cell.discovered &&
        cell.locationId &&
        cell.locationId !== gameState.currentLocationId
      ) {
        // Check if this is a town location - prevent direct quick travel to towns
        const townKeywords = [
          "town",
          "village",
          "city",
          "settlement",
          "hamlet",
        ];
        const targetLocation = LOCATIONS[cell.locationId];
        const isTownLocation =
          targetLocation &&
          townKeywords.some(
            (keyword) =>
              targetLocation.name.toLowerCase().includes(keyword) ||
              targetLocation.id.toLowerCase().includes(keyword),
          );

        if (isTownLocation) {
          addMessage(
            `You cannot quick travel directly into ${targetLocation.name}. Towns must be approached carefully on foot.`,
            "system",
          );
          return;
        }

        // Grid retirement: no mapData tile mutation (isPlayerCurrent is the canonical
        // cell; fog is cell-native). The destinationCell carries the exact arrival cell.
        dispatch({
          type: "MOVE_PLAYER",
          payload: {
            newLocationId: cell.locationId,
            activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(
              cell.locationId,
              LOCATIONS,
            ),
            destinationCell: travelMeta?.destinationCell,
            sharedJourney,
            arrivalGameTime,
          },
        });
        if (travelSeconds > 0)
          dispatch({
            type: "ADVANCE_TIME",
            payload: { seconds: travelSeconds },
          });
        if (travelMeta?.destinationCell)
          recordCellDiscovery(
            travelMeta.destinationCell.cellId,
            cell.locationId,
          );
        if (!options?.preserveMapVisibility) dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
        applyProvisionEffects();
        applyFerryFare();
        applyForcedMarch();
        announceNavDrift();
        announceTripEvent();
        announceEncounter();
        triggerTravelEncounter();
        return true;
      } else if (cell.discovered && !cell.locationId) {
        // Grid retirement: the wilderness location id is the cell-native id of the
        // clicked atlas cell (carried by destinationCell), not a coord_X_Y tile.
        const destCellId = travelMeta?.destinationCell?.cellId;
        const targetLocId =
          destCellId != null ? makeCellLocationId(destCellId) : null;
        if (targetLocId) {
          const moved = targetLocId !== gameState.currentLocationId;
          if (moved) {
            dispatch({
              type: "MOVE_PLAYER",
              payload: {
                newLocationId: targetLocId,
                activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(
                  targetLocId,
                  LOCATIONS,
                ),
                destinationCell: travelMeta?.destinationCell,
                sharedJourney,
                arrivalGameTime,
              },
            });
            recordCellDiscovery(destCellId!, targetLocId);
          }
          // A zero-supply push can honestly halt in the origin cell. It still
          // applies starvation/loyalty effects, but receives no free edge or time.
          if (travelSeconds > 0)
            dispatch({
              type: "ADVANCE_TIME",
              payload: { seconds: travelSeconds },
            });
          if (!options?.preserveMapVisibility) dispatch({ type: "TOGGLE_MAP_VISIBILITY" });
          applyProvisionEffects();
          applyFerryFare();
          applyForcedMarch();
          announceNavDrift();
          announceTripEvent();
          announceEncounter();
          triggerTravelEncounter();
          if (!moved && !travelMeta?.provision?.note) {
            addMessage(
              `You remain in ${targetBiome.name.toLowerCase()} country.`,
              "system",
            );
          }
          return true;
        } else {
          // Grid retirement: no coordinates in player-facing text — name the place.
          const settlementName = cell.locationId
            ? LOCATIONS[cell.locationId]?.name
            : undefined;
          addMessage(
            settlementName
              ? `You arrive at ${settlementName}.`
              : `You arrive in ${targetBiome.name.toLowerCase()}.`,
            "system",
          );
        }
      } else if (cell.discovered) {
        addMessage(
          `This is ${targetBiome.name.toLowerCase()} country. ${targetBiome.description}`,
          "system",
        );
      } else {
        // Travel failure mode: a pick landed on an unexplored cell. Never silently
        // no-op — tell the player why the trip didn't happen.
        addMessage(
          "That place lies beyond the known map — scout closer before you can travel there.",
          "system",
        );
      }
    },
    [
      gameState.currentLocationId,
      gameState.companions,
      gameState.party,
      gameState.discoveryLog,
      gameState.gameTime,
      gameState.worldSeed,
      gameState.worldforgeDeltas,
      addMessage,
      dispatch,
    ],
  );

  return { handleTileClick };
}
