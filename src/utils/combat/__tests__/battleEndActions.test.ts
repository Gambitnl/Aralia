/** Proves victory and defeat take their intended App-shell routes. */
import { describe, expect, it } from "vitest";
import { GamePhase } from "../../../types";
import { createBattleEndActions } from "../battleEndActions";

describe("createBattleEndActions", () => {
  it("settles victory through END_BATTLE", () => {
    const rewards = { gold: 12, items: [], xp: 50 };
    expect(createBattleEndActions("victory", rewards)).toEqual([
      {
        type: "END_BATTLE",
        payload: {
          rewards,
          finalPartyState: undefined,
          finalEnemyState: undefined,
        },
      },
    ]);
  });

  it("routes defeat through teardown to game over", () => {
    expect(createBattleEndActions("defeat")).toEqual([
      { type: "END_BATTLE" },
      { type: "SET_GAME_PHASE", payload: GamePhase.GAME_OVER },
    ]);
  });

  it("reconciles exact enemy source state before victory clears combat", () => {
    const rewards = { gold: 12, items: [], xp: 50 };
    const finalEnemyState = [
      {
        id: "goblin-combatant-1",
        currentHP: 0,
        position: { x: 8, y: 4 },
        worldSource: {
          kind: "worldforge-opening-threat" as const,
          sceneReceiptId: "opening-scene-1",
          sourceOpeningReceiptId: "opening-1",
          entityId: "opening-scene-1:entity:1",
          monsterName: "Goblin",
          monsterOrdinal: 1,
          socialRole: "contact-lead" as const,
          worldGroundMeters: { x: 10, z: 20 },
        },
      },
    ];

    const actions = createBattleEndActions(
      "victory",
      rewards,
      [],
      finalEnemyState,
    );

    expect(actions).toEqual([
      {
        type: "RESOLVE_WORLDFORGE_OPENING_SCENE",
        payload: { result: "victory", finalEnemyState },
      },
      {
        type: "END_BATTLE",
        payload: { rewards, finalPartyState: [], finalEnemyState },
      },
    ]);
  });

  // agora-31fa: post-combat consequences (the town watch reaction) need to know
  // which enemies actually died, so the final enemy roster must survive the hop
  // into END_BATTLE rather than stopping at the WorldForge reconciliation.
  it("carries the final enemy roster into END_BATTLE so lethality survives teardown", () => {
    const rewards = { gold: 0, items: [], xp: 10 };
    const finalEnemyState = [
      { id: "watchman-1", currentHP: 0, position: { x: 1, y: 1 } },
      { id: "watchman-2", currentHP: 4, position: { x: 2, y: 1 } },
    ];

    const endBattle = createBattleEndActions(
      "victory",
      rewards,
      [],
      finalEnemyState,
    ).find((action) => action.type === "END_BATTLE");

    expect(endBattle).toEqual({
      type: "END_BATTLE",
      payload: { rewards, finalPartyState: [], finalEnemyState },
    });
  });
});
