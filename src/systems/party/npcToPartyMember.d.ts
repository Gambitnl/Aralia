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
import type { RichNPC } from '../../types/world';
import type { Companion } from '../../types/companions';
import { type RecruitPayload, type RecruitSource } from './recruitTypes';
/**
 * Convert a world/generated {@link RichNPC} into a complete {@link RecruitPayload}
 * — the playable character and the relationship companion, sharing one id, ready
 * to be written to both stores by the recruit reducer.
 *
 * @param npc    The world/generated NPC to recruit.
 * @param source Which trigger produced the offer (dialogue/tavern/rescue). Defaults to 'dialogue'.
 */
export declare function npcToPartyMember(npc: RichNPC, source?: RecruitSource): RecruitPayload;
/**
 * Promote an already-authored {@link Companion} (Kaelen, Elara — records that
 * already live in `state.companions`) into the playable roster. The existing
 * Companion is KEPT (its relationship/loyalty/banter history persists) and only
 * marked `inParty: true`; a matching {@link PlayerCharacter} is synthesized from
 * the companion's identity so the two stores share one id.
 *
 * `createPlayerCharacterFromTemp` builds a rules-valid base from the companion's
 * id / name / a best-effort level / class. Authored companions do not carry
 * rolled ability scores, so the synthesized character uses the temp defaults;
 * combat-stat enrichment for authored companions is a follow-up (see return).
 *
 * @param companion The authored companion to promote.
 * @param classId   Optional class id for the synthesized character (default 'fighter').
 * @param level     Optional level for the synthesized character (default 1).
 */
export declare function promoteCompanionToMember(companion: Companion, classId?: string, level?: number): RecruitPayload;
