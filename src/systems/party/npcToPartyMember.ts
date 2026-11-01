/**
 * @file npcToPartyMember.ts — pure NPC → party-member converter (Packet P4).
 *
 * A "join the party" event spans TWO unlinked stores (see DISCOVERY §1):
 *   - `state.party: PlayerCharacter[]`          — the playable roster.
 *   - `state.companions: Record<id, Companion>` — the relationship/loyalty layer.
 * The two halves are joined in `PartyPane` by a SHARED id, so a recruit must
 * produce both at once under one id. This module is the single producer of that
 * pair: it turns a world/generated {@link RichNPC} into a self-consistent
 * {@link RecruitPayload} ({ character, companion, source }) and exposes a
 * sibling {@link promoteCompanionToMember} for authored companions (Kaelen,
 * Elara) that already exist in `state.companions` ("met → joined").
 *
 * It is PURE — no reducer, no React, no game-state. It only IMPORTS existing
 * building blocks (`createPlayerCharacterFromTemp`, `createMockCompanion`,
 * `generateNPC`) and never edits them. Stat/biography logic is reused, never
 * duplicated (anti-duplication, DISCOVERY §6).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 11:18:55
 * Dependents: hooks/actions/handleEncounter.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleNpcInteraction.ts, state/reducers/companionReducer.ts, state/reducers/companionTravelReducer.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RichNPC } from '../../types/world';
import type { PlayerCharacter } from '../../types/character';
import type { AbilityScores } from '../../types/core';
import type {
  Companion,
  NPCIdentity,
  Relationship,
} from '../../types/companions';
import { createPlayerCharacterFromTemp } from '../../utils/character/characterUtils';
import { createMockCompanion } from '../../utils/character/companionFactories';
import { generateNPC } from '../../services/npcGenerator';
import {
  type RecruitPayload,
  type RecruitSource,
  makeInPartyFlag,
} from './recruitTypes';

/**
 * Seed the `relationships.player` entry for a freshly recruited companion: a
 * blank slate at `stranger` / approval 0, mirroring `data/companions.ts`
 * `createInitialRelationship` so seeded and recruited companions agree.
 */
function createInitialPlayerRelationship(): Relationship {
  return {
    targetId: 'player',
    level: 'stranger',
    approval: 0,
    history: [],
    unlocks: [],
  };
}

/**
 * Map an NPC disposition (0–100, from the generator's memory model) onto the
 * Companion loyalty scale (0–100, "chance of leaving/betrayal"). A grateful or
 * friendly recruit starts more loyal than a wary one. Defaults to the neutral
 * midpoint (50) when no disposition is available, matching `createMockCompanion`.
 */
function loyaltyFromDisposition(disposition: number | undefined): number {
  if (disposition === undefined || Number.isNaN(disposition)) return 50;
  return Math.max(0, Math.min(100, Math.round(disposition)));
}

/** Read the NPC's runtime disposition, if its memory carries one. */
function readDisposition(npc: RichNPC): number | undefined {
  const memory = npc.memory as { disposition?: number } | undefined;
  return memory?.disposition;
}

/**
 * Build the playable {@link PlayerCharacter} half from a {@link RichNPC}.
 *
 * `createPlayerCharacterFromTemp` gives us a fully-formed, rules-valid base
 * (class levels, hit dice, racial spell grants, AC) from the NPC's id / name /
 * level / class / retained race. Older untyped NPCs still default to human. We then
 * overlay the NPC's real biography: ability scores, stats, and the `richNpcData`
 * slot documented for "party members with full biography details"
 * (`types/character.ts`). The id is the NPC's id so it pairs with the companion.
 */
function buildCharacterFromNpc(npc: RichNPC): PlayerCharacter {
  const base = createPlayerCharacterFromTemp({
    id: npc.id,
    name: npc.name,
    level: npc.biography.level,
    classId: npc.biography.classId,
  }, npc.biography.raceId);

  const npcAbilityScores: AbilityScores = npc.biography.abilityScores;

  const character: PlayerCharacter = {
    ...base,
    // Carry the NPC's actual rolled scores rather than the temp 10/10/10 base.
    abilityScores: npcAbilityScores,
    finalAbilityScores: npcAbilityScores,
    // Adopt the NPC generator's derived combat stats so the recruited member
    // matches how they were rendered in the world.
    hp: npc.stats.hp,
    maxHp: npc.stats.maxHp,
    armorClass: npc.stats.armorClass,
    speed: npc.stats.speed,
    proficiencyBonus: npc.stats.proficiencyBonus,
    // Bring across any equipment the generator gave the NPC.
    equippedItems: { ...npc.equippedItems },
    // Visual/portrait hints for the character sheet / portrait pipeline.
    visualDescription: npc.visual?.description,
    portraitUrl: npc.visual?.portraitPath,
    // The documented landing slot for a converted NPC's biography.
    richNpcData: {
      age: npc.biography.age,
      family: npc.biography.family,
      physicalDescription: npc.visual?.description ?? npc.baseDescription,
      backgroundId: npc.biography.backgroundId,
    },
  };

  return character;
}

/**
 * Build the relationship-layer {@link Companion} half from a {@link RichNPC},
 * sharing the NPC's id with the character. Uses `createMockCompanion` (imported,
 * not edited) as the shape factory and overlays identity, a fresh
 * `relationships.player`, disposition-derived loyalty, and `inParty: true`.
 */
function buildCompanionFromNpc(npc: RichNPC, raceName: string): Companion {
  const identity: NPCIdentity = {
    id: npc.id,
    name: npc.name,
    // The relationship card describes the same species as the playable person.
    race: raceName,
    class: npc.biography.classId,
    background: npc.biography.backgroundId,
    sex: 'Unknown',
    age: npc.biography.age,
    physicalDescription: npc.visual?.description ?? npc.baseDescription,
    avatarUrl: npc.visual?.portraitPath,
  };

  // Spread the inParty flag onto the RESULT — createMockCompanion builds its own
  // object from known fields and drops unknown input keys, so passing the flag in
  // as an argument would silently lose it.
  return {
    ...createMockCompanion({
      id: npc.id,
      identity,
      relationships: { player: createInitialPlayerRelationship() },
      loyalty: loyaltyFromDisposition(readDisposition(npc)),
    }),
    ...makeInPartyFlag(),
  };
}

/**
 * Convert a world/generated {@link RichNPC} into a complete {@link RecruitPayload}
 * — the playable character and the relationship companion, sharing one id, ready
 * to be written to both stores by the recruit reducer.
 *
 * @param npc    The world/generated NPC to recruit.
 * @param source Which trigger produced the offer (dialogue/tavern/rescue). Defaults to 'dialogue'.
 */
export function npcToPartyMember(
  npc: RichNPC,
  source: RecruitSource = 'dialogue',
): RecruitPayload {
  const character = buildCharacterFromNpc(npc);
  const companion = buildCompanionFromNpc(npc, character.race.name);

  // Invariant: the two halves are joined by a shared id in PartyPane.
  if (character.id !== companion.id) {
    throw new Error(
      `npcToPartyMember: character/companion id mismatch (${character.id} !== ${companion.id})`,
    );
  }

  return { character, companion, source };
}

/**
 * Promote an already-authored {@link Companion} (Kaelen, Elara — records that
 * already live in `state.companions`) into the playable roster. The existing
 * Companion is KEPT (its relationship/loyalty/banter history persists) and only
 * marked `inParty: true`; a matching {@link PlayerCharacter} is synthesized from
 * the companion's identity so the two stores share one id.
 *
 * `createPlayerCharacterFromTemp` builds a rules-valid base from the companion's
 * id / name / a best-effort level / class. Authored companions do not carry
 * rolled ability scores. When their already-met world record is available,
 * reuse that person's existing mechanics rather than rolling another person or
 * replacing them with the temp defaults. Old identity-only callers still work.
 * Joining preserves the authored vocation by default. Explicit class overrides
 * and the character factory's unknown-class fallback remain available.
 *
 * @param companion The authored companion to promote.
 * @param classId   Optional override; otherwise use the companion's authored class.
 * @param level     Optional level for the synthesized character (default 1).
 * @param metNpc    Existing world record for this same person; never generated here.
 */
export function promoteCompanionToMember(
  companion: Companion,
  classId: string = companion.identity.class.trim().toLowerCase(),
  level: number = 1,
  metNpc?: RichNPC,
): RecruitPayload {
  const character = createPlayerCharacterFromTemp({
    id: companion.id,
    name: companion.identity.name,
    level,
    classId,
  }, companion.identity.race);

  // Only matching mechanics may cross this boundary. Explicit class/level
  // overrides retain their existing factory behavior; an unrelated NPC cannot
  // supply another person's build. The authored race and biography win over
  // the generated presence shell's incidental identity details.
  const retainedCharacter = metNpc?.id === companion.id
    && metNpc.biography.classId === character.class.id
    && metNpc.biography.level === character.level
    ? buildCharacterFromNpc({ ...metNpc, biography: { ...metNpc.biography, raceId: companion.identity.race } })
    : character;

  // Carry the authored biography into the documented richNpcData slot so the
  // promoted companion's character sheet still surfaces their identity.
  const enrichedCharacter: PlayerCharacter = {
    ...retainedCharacter,
    visualDescription: companion.identity.physicalDescription,
    portraitUrl: companion.identity.avatarUrl,
    richNpcData: {
      age:
        typeof companion.identity.age === 'number'
          ? companion.identity.age
          : 0,
      family: [],
      physicalDescription: companion.identity.physicalDescription,
      backgroundId: companion.identity.background,
    },
  };

  // Keep the existing relationship record; just activate party membership.
  const activeCompanion: Companion = {
    ...companion,
    ...makeInPartyFlag(),
  };

  if (enrichedCharacter.id !== activeCompanion.id) {
    throw new Error(
      `promoteCompanionToMember: character/companion id mismatch (${enrichedCharacter.id} !== ${activeCompanion.id})`,
    );
  }

  return {
    character: enrichedCharacter,
    companion: activeCompanion,
    source: 'promote',
  };
}
