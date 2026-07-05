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
import { generateNPC } from '../../services/npcGenerator';

type NpcRole = RichNPC['role'];

/**
 * Map an authored companion's class to the engine's functional NPC role so the
 * placed shell renders/behaves plausibly. Authored companions are always people
 * of consequence, so anything not obviously a guard/merchant is 'unique'.
 */
export function roleForCompanionClass(classText: string): NpcRole {
  const c = classText.toLowerCase();
  if (/(fighter|paladin|guard|soldier|knight|barbarian)/.test(c)) return 'guard';
  if (/(merchant|trader|artificer)/.test(c)) return 'merchant';
  return 'unique';
}

/**
 * Build a placeable {@link RichNPC} shell from an authored {@link Companion}.
 *
 * `generateNPC` fills a rules-valid skeleton (ability scores, hp/AC, equipment,
 * visuals) which authored companions do not carry; we then overlay the authored
 * identity + personality so the placed NPC IS Kaelen/Elara, not a random villager.
 */
export function authoredCompanionToRichNpc(companion: Companion): RichNPC {
  const { identity, personality } = companion;

  const rich = generateNPC({
    id: identity.id,
    name: identity.name,
    role: roleForCompanionClass(identity.class),
    occupation: identity.class,
    raceId: identity.race.toLowerCase().replace(/\s+/g, '_'),
    classId: identity.class.toLowerCase(),
    backgroundId: identity.background.toLowerCase(),
    gender: identity.sex.toLowerCase() === 'female' ? 'female' : 'male',
  });

  const values = personality.values.join(', ');
  const quirks = personality.quirks.join(', ');
  const fears = personality.fears.join(', ');

  return {
    ...rich,
    baseDescription: identity.physicalDescription,
    initialPersonalityPrompt:
      `You are ${identity.name}, a ${identity.race} ${identity.class}. ` +
      `${identity.physicalDescription} ` +
      `You value: ${values}. You fear: ${fears}. Your quirks: ${quirks}. ` +
      `You are an independent adventurer the player has just encountered; ` +
      `stay true to that personality in everything you say.`,
    dialoguePromptSeed:
      `${identity.name} sizes up the newcomer, weighing whether they are worth the trouble.`,
  };
}

/**
 * Build placeable RichNPC shells for a set of authored companions (skips any that
 * are already travelling with the party — they are in the roster, not the scene).
 */
export function authoredCompanionsToRichNpcs(
  companions: Companion[],
): RichNPC[] {
  return companions
    .filter((c) => !c.inParty)
    .map(authoredCompanionToRichNpc);
}
