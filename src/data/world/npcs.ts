// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 09:06:42
 * Dependents: App.tsx, components/layout/GameModals.tsx, constants.ts, hooks/useDialogueSystem.ts, hooks/useGameActions.ts, services/EntityResolverService.ts, state/appState.ts, state/initialState.ts, state/reducers/worldReducer.ts, systems/adventureLog/oraclePrompt.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/data/world/npcs.ts
 * Defines all NPC data for the Aralia RPG.
 */
import { NPC, GoalStatus } from '../../types'; // TTSVoiceOption is part of NPC type if used
import { SPEECH_PROFILE_PRESETS } from '../../systems/social/speechProfile';

/**
 * Speech fingerprinting (agora-9e0f). The five authored NPCs take one preset each so
 * the starting town demonstrates all five voices. Procedurally generated NPCs derive
 * their own profile from role + biome + culture (see `generateSpeechProfile`); these
 * assignments are the authored starting point, not a fixed mapping.
 */

export const NPCS: Record<string, NPC> = {
  'old_hermit': {
    id: 'old_hermit',
    // Measured, cryptic, expansive — the scholarly/formal/long fingerprint.
    speechProfile: SPEECH_PROFILE_PRESETS['urban-scholar'],
    name: 'Old Hermit',
    baseDescription: 'A weathered old man with kind eyes, dressed in simple robes.',
    initialPersonalityPrompt: 'You are Elara, an old hermit who has seen the rise and fall of ages. You are cautious but possess deep wisdom. You speak in measured, sometimes cryptic sentences, and you value patience and respect above all.',
    role: 'unique',
    dialoguePromptSeed: 'The hermit looks up as you approach, a faint smile on his lips.',
    // This is the static definition of the NPC's initial goals.
    // This data is used to populate the dynamic npcMemory state when a new game starts.
    goals: [
        {
            id: 'find_lost_lore',
            description: 'Wants to find a lost volume of arcane lore believed to be hidden somewhere in the ancient ruins.',
            status: GoalStatus.Active,
        }
    ]
  },
  'nervous_scout': {
    id: 'nervous_scout',
    // Jumpy and clipped — crude/casual/short matches the short, clipped sentences.
    speechProfile: SPEECH_PROFILE_PRESETS['urban-cutpurse'],
    name: 'Nervous Scout',
    baseDescription: 'A young scout, fidgeting and glancing around often.',
    initialPersonalityPrompt: "You are Finnian, a young scout on high alert. You are jumpy and speak in short, clipped sentences. You are suspicious of strangers but desperate for news from the main road.",
    role: 'unique',
    dialoguePromptSeed: 'The scout jumps as you get closer, hand on their dagger.'
    // voice: TTS_VOICE_OPTIONS.find(v => v.name === 'Puck')
  },
  'villager_generic': {
    id: 'villager_generic',
    // Plain, neighborly small talk.
    speechProfile: SPEECH_PROFILE_PRESETS['rural-farmer'],
    name: 'Villager',
    baseDescription: 'A common villager, perhaps running errands or enjoying the day.',
    initialPersonalityPrompt: "You are a common villager of Aralia, friendly but busy. You offer simple greetings and are generally helpful but not overly talkative. Your main concern is the day-to-day life of the town.",
    role: 'civilian',
    dialoguePromptSeed: 'The villager offers a polite nod as you pass by.',
    voice: { name: 'Aoede', characteristic: 'Breezy' } 
  },
  'merchant_generic': {
    id: 'merchant_generic',
    // Port-side patter: casual, persuasive, dialect-flavored.
    speechProfile: SPEECH_PROFILE_PRESETS['coastal-sailor'],
    name: 'Street Merchant',
    baseDescription: 'A merchant stands by a small cart of wares, keenly observing passersby.',
    initialPersonalityPrompt: "You are Astrid, a street merchant with a keen eye for profit. You are friendly and engaging, always trying to make a sale. You speak with a slightly exaggerated, persuasive tone.",
    role: 'merchant',
    dialoguePromptSeed: 'The merchant calls out, "Looking for a good deal, traveler?"',
    voice: { name: 'Charon', characteristic: 'Informative' }
  },
  'guard_generic': {
    id: 'guard_generic',
    // Barked, contracted, courtesy-free.
    speechProfile: SPEECH_PROFILE_PRESETS['mountain-guard'],
    name: 'Town Guard',
    baseDescription: 'A guard in simple livery stands at attention, keeping a watchful eye on the surroundings.',
    initialPersonalityPrompt: "You are Borin, a town guard of Aralia. You are dutiful and observant, speaking in a formal and direct manner. You are wary of trouble but not openly hostile.",
    role: 'guard',
    dialoguePromptSeed: 'The guard gives a curt nod, their gaze assessing.',
    voice: { name: 'Kore', characteristic: 'Firm' }
  }
};