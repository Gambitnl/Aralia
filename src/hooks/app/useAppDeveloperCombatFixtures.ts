/** Retains the opt-in combat proof scenarios outside the root shell. The same permission gates, one-shot ref, branch order and production action paths remain in use. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: App.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useRef, type Dispatch } from "react";
import { GamePhase } from "../../types";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import type { TravelCombatEncounter } from "../../types/travelMeta";
import type { useGameActions } from "../useGameActions";
import { canUseDevTools } from "../../utils/core";
import { prepareTravelBattlefield } from "../../systems/travel/prepareTravelBattlefield";

export function useAppDeveloperCombatFixtures(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
  addMessage: (text: string, sender?: "system" | "player" | "npc") => void,
  processAction: ReturnType<typeof useGameActions>["processAction"],
) {
  // Dev combat fixtures: ?dev_combat=1 is the explicitly procedural sandbox,
  // ?dev_combat_source_gap=1 proves the generic production fail-closed state,
  // ?dev_static_town_watch_source_gap=1 proves the authored-town wanted-watch
  // boundary, ?dev_sea_encounter_source_gap=1 and
  // ?dev_location_free_encounter_source_gap=1 prove the remaining unsupported
  // production launchers, and ?dev_travel_ambush=1 drives the real travel
  // projection at canonical cell 373. All stay behind dev permissions and
  // bypass AI for stable captures.
  const devCombatFiredRef = useRef(false);
  useEffect(() => {
    if (!canUseDevTools() || devCombatFiredRef.current) return;
    if (gameState.phase !== GamePhase.PLAYING) return;
    const params = new URLSearchParams(window.location.search);
    const sandboxFixture = params.get("dev_combat") === "1";
    const sourceGapFixture = params.get("dev_combat_source_gap") === "1";
    const authoredTownWatchSourceGapFixture =
      params.get("dev_static_town_watch_source_gap") === "1";
    const seaEncounterSourceGapFixture =
      params.get("dev_sea_encounter_source_gap") === "1";
    const locationFreeEncounterSourceGapFixture =
      params.get("dev_location_free_encounter_source_gap") === "1";
    const travelFixture = params.get("dev_travel_ambush") === "1";
    if (
      !sandboxFixture &&
      !sourceGapFixture &&
      !authoredTownWatchSourceGapFixture &&
      !seaEncounterSourceGapFixture &&
      !locationFreeEncounterSourceGapFixture &&
      !travelFixture
    ) {
      return;
    }
    devCombatFiredRef.current = true;

    if (authoredTownWatchSourceGapFixture) {
      // Exercise the same action, reducer, and CombatView boundary as the live
      // authored-town interaction. The fixture supplies a reason only: no
      // enemy roster or terrain is allowed to enter production state.
      void (async () => {
        const { createAuthoredTownWatchSourceGap } = await import(
          "../../systems/combat/fightInPlace/authoredTownWatchSourceGap"
        );
        await processAction({
          type: "START_BATTLE_MAP_ENCOUNTER",
          label: "Authored Town Watch Source Gap Fixture",
          payload: {
            startBattleMapEncounterData: {
              monsters: [],
              sourceGap: createAuthoredTownWatchSourceGap(
                "oakhaven",
                "Town Guard",
              ),
            },
          },
        });
      })();
      return;
    }

    if (seaEncounterSourceGapFixture) {
      // Use the same reason builder as useSeaEncounter while crossing the real
      // application action/reducer/CombatView path for deterministic proof.
      void (async () => {
        const { createSeaEncounterSourceGap } = await import(
          "../../systems/combat/unsupportedBattlefieldSources"
        );
        await processAction({
          type: "START_BATTLE_MAP_ENCOUNTER",
          label: "Sea Encounter Source Gap Fixture",
          payload: {
            startBattleMapEncounterData: {
              monsters: [],
              sourceGap: createSeaEncounterSourceGap({
                id: "pirates",
                summary: "A pirate cutter runs up the black flag!",
                monsters: [
                  {
                    name: "Bandit",
                    quantity: 3,
                    cr: "1/8",
                    description: "Proposed naval foe",
                  },
                ],
              }),
            },
          },
        });
      })();
      return;
    }

    if (locationFreeEncounterSourceGapFixture) {
      // EncounterModal and this fixture share the reason builder; neither path
      // promotes an independently authored roster into production combat.
      void (async () => {
        const { createLocationFreeSimulationSourceGap } = await import(
          "../../systems/combat/unsupportedBattlefieldSources"
        );
        await processAction({
          type: "START_BATTLE_MAP_ENCOUNTER",
          label: "Location-Free Encounter Source Gap Fixture",
          payload: {
            startBattleMapEncounterData: {
              monsters: [],
              sourceGap: createLocationFreeSimulationSourceGap("bestiary", 4),
            },
          },
        });
      })();
      return;
    }

    if (travelFixture) {
      const monsters = [
        {
          name: "Bandit",
          quantity: 3,
          cr: "1/8",
          description: "Deterministic road-interception fixture",
        },
      ];
      const encounter: TravelCombatEncounter = {
        kind: "land-route-ambush",
        monsters,
        routeCells: [112, 201, 373],
      };
      void (async () => {
        const { extractedBattleMap, sourceGapDetail } =
          await prepareTravelBattlefield(
            encounter,
            { cellId: 373, anchor: { cellId: 373 } },
            {
              worldSeed: 42,
              gameTime: gameState.gameTime,
              worldforgeDeltas: gameState.worldforgeDeltas,
            },
          );
        if (sourceGapDetail) {
          addMessage(`Travel fixture source gap: ${sourceGapDetail}`, "system");
        }
        await processAction({
          type: "START_BATTLE_MAP_ENCOUNTER",
          label: "WorldForge Travel Ambush Fixture",
          payload: {
            startBattleMapEncounterData: {
              monsters,
              ...(extractedBattleMap ? { extractedBattleMap } : {}),
            },
          },
        });
      })();
      return;
    }

    processAction({
      type: "START_BATTLE_MAP_ENCOUNTER",
      label: sourceGapFixture
        ? "World Battle Source Gap Fixture"
        : "Procedural Combat Sandbox",
      payload: {
        startBattleMapEncounterData: {
          monsters: [
            {
              name: "Goblin",
              quantity: 3,
              cr: "1/4",
              description: "Dev fixture goblin",
            },
            {
              name: "Orc",
              quantity: 2,
              cr: "1/2",
              description: "Dev fixture orc",
            },
          ],
        },
      },
    });

    // ?dev_ritual=1 (with ?dev_combat=1): seed a ritual in progress so the
    // battle-map ritual panel can be eyeballed without a real 10-minute cast.
    // Fixture data only; it goes through the real START_RITUAL reducer path.
    if (sandboxFixture && params.get("dev_ritual") === "1") {
      const casterId = gameState.party[0]?.id ?? "dev-caster";
      window.setTimeout(() => {
        dispatch({
          type: "START_RITUAL",
          payload: {
            id: "dev-ritual-fixture",
            spellId: "detect-magic",
            spellName: "Detect Magic (ritual)",
            casterId,
            startTime: 1,
            durationTotalSeconds: 600,
            progressSeconds: 180,
            durationTotal: 10,
            durationUnit: "minutes",
            progress: 3,
            isPaused: false,
            participantIds: [],
            interruptConditions: [
              { type: "damage", threshold: 1, saveType: "Constitution", dcCalculation: "damage_half" },
              { type: "movement" },
              { type: "silence" },
            ],
            config: {
              breaksOnDamage: true,
              breaksOnMove: true,
              requiresConcentration: true,
              allowCooperation: false,
              consumptionTiming: "end",
            },
          },
        });
      }, 1500);
    }
  }, [
    addMessage,
    dispatch,
    gameState.gameTime,
    gameState.party,
    gameState.phase,
    gameState.worldforgeDeltas,
    processAction,
  ]);

}
