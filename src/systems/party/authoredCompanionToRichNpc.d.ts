/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/party/authoredCompanionToRichNpc.ts
 *
 * Turns an authored {@link Companion} (Kaelen, Elara — the hand-written records
 * seeded into `state.companions`) into a full {@link RichNPC} so those companions
 * can be PLACED in the world as real, interactable people. Without a RichNPC in
 * `state.generatedNpcs` and the id in `currentLocationActiveDynamicNpcIds`, the
 * ActionPane never surfaces a "Talk to" / "Ask to join" affordance for them, so
 * the richest companions in the game can never actually be met.
 *
 * The RichNPC is a THIN PRESENCE SHELL: it exists only so the scene can render
 * them and the recruit action can appear. The authored personality/loyalty/
 * relationship record still lives in `state.companions`, and recruitment routes
 * through {@link promoteCompanionToMember} (handleRecruitOffer checks
 * `state.companions` before `state.generatedNpcs`), so the authored soul is what
 * actually joins the party — this shell is never converted via npcToPartyMember.
 *
 * Field provenance (authored data is preserved, never hardcoded generic):
 *   - id / name / race / class          <- companion.identity
 *   - baseDescription                    <- companion.identity.physicalDescription
 *   - initialPersonalityPrompt           <- companion.personality (values/quirks/fears)
 *   - biography stats / equipment / hp   <- generateNPC skeleton (companions carry no rolled stats)
 */
import type { RichNPC } from '../../types/world';
import type { Companion } from '../../types/companions';
type NpcRole = RichNPC['role'];
/**
 * Map an authored companion's class to the engine's functional NPC role so the
 * placed shell renders/behaves plausibly. Authored companions are always people
 * of consequence, so anything not obviously a guard/merchant is 'unique'.
 */
export declare function roleForCompanionClass(classText: string): NpcRole;
/**
 * Build a placeable {@link RichNPC} shell from an authored {@link Companion}.
 *
 * `generateNPC` fills a rules-valid skeleton (ability scores, hp/AC, equipment,
 * visuals) which authored companions do not carry; we then overlay the authored
 * identity + personality so the placed NPC IS Kaelen/Elara, not a random villager.
 */
export declare function authoredCompanionToRichNpc(companion: Companion): RichNPC;
/**
 * Build placeable RichNPC shells for a set of authored companions (skips any that
 * are already travelling with the party — they are in the roster, not the scene).
 */
export declare function authoredCompanionsToRichNpcs(companions: Companion[]): RichNPC[];
export {};
