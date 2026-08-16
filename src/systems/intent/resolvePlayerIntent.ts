/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/resolvePlayerIntent.ts
 *
 * Reads one line of player free text and decides what it means mechanically.
 *
 * This generalizes the hostile-only `gameEntry/resolveDeEscalationIntent`, which
 * knew three verbs (attack, one skill, ambiguous) and ran only in a standoff.
 * This reader adds `talk`, runs in every conversation, and proposes stakes and a
 * difficulty for the attempts it finds.
 *
 * The single most important behavior is the DEFAULT. Most lines a player types
 * are ordinary speech. If the reader claims a skill for "hello" then every
 * greeting becomes a die roll and the game turns into a slot machine. So the
 * prompt makes `talk` the default and demands a real, failable, physical or
 * social ATTEMPT before any other verb is allowed.
 *
 * NO FALLBACK: a transport or parse failure throws. The caller shows an honest
 * error and the player retries. Nothing is guessed.
 */
import type { OllamaClient } from '../../services/ollama/client';
import { getDefaultClient } from '../../services/ollama/client';
import { parseJsonRobustly } from '../../services/ollama/jsonParser';
import { SKILLS_DATA } from '../../data/skills';
import type { AbilityScoreName } from '../../types';
import type { IntentScene, IntentSkillInfo, PlayerIntent } from './types';
import { clampCheckDc, normalizeStakes } from './clampCheckDc';

interface Deps {
    client?: OllamaClient;
}

interface RawIntent {
    kind?: string;
    skill?: string;
    dc?: unknown;
    stakes?: unknown;
    rationale?: string;
    candidateSkills?: unknown;
}

/** Resolve a skill NAME to its governing ability, or undefined if unknown. */
function abilityForSkill(skill: string): AbilityScoreName | undefined {
    const entry = Object.values(SKILLS_DATA).find(
        (s) => s.name.toLowerCase() === skill.trim().toLowerCase(),
    );
    return entry?.ability;
}

/**
 * Build the classifier prompt. Exported so a test can assert the guardrails stay
 * in the prompt as it evolves.
 */
export function buildIntentPrompt(
    playerText: string,
    scene: IntentScene,
    skills: IntentSkillInfo[],
): string {
    const skillList = skills
        .map(
            (s) =>
                `${s.name} (${s.ability}${s.proficient ? ', proficient' : ''}, ${s.modifier >= 0 ? '+' : ''}${s.modifier})`,
        )
        .join('; ');
    const present = scene.participants.length > 0 ? scene.participants.join(', ') : 'nobody named';

    return (
        'You are the game master. Read ONE line from the player and classify what they are doing. ' +
        'Output ONLY JSON.\n\n' +
        `SCENE: ${scene.tension || 'An ordinary conversation.'}\n` +
        `MOOD: ${scene.hostile ? 'HOSTILE — violence is the next beat.' : 'peaceful'}\n` +
        `PEOPLE PRESENT: ${present}\n` +
        `PLAYER LINE: ${playerText}\n` +
        `THE PLAYER'S SKILLS: ${skillList}\n\n` +
        'Choose exactly one kind:\n' +
        '- "talk" — the DEFAULT. Speech, questions, greetings, opinions, agreement, refusal, ' +
        'roleplay, or describing a feeling. Anything that cannot fail is talk.\n' +
        '- "skill" — a concrete ATTEMPT that could genuinely fail and has a consequence: ' +
        'picking a pocket, lying about a fact, cowing someone, performing for a crowd, ' +
        'climbing a wall, tracking a mark, recalling lore.\n' +
        '- "flee" — leaving the scene entirely.\n' +
        '- "attack" — committing violence on someone present.\n' +
        '- "ambiguous" — a real attempt, but two or more skills fit equally.\n\n' +
        'CRITICAL: prefer "talk". Do NOT invent a skill check for ordinary speech. ' +
        '"Hello", "What happened here?", "I agree", "That sounds bad", and "I offer to help" ' +
        'are ALL "talk". Only reach for a skill when the player attempts something with real ' +
        'risk of failure.\n\n' +
        'For "skill" and "flee" also give:\n' +
        '- "skill": one name from the player skill list above, spelled exactly.\n' +
        '- "stakes": "trivial" (a small trick, little lost on failure), "moderate" (the normal ' +
        'case), or "serious" (a crime, a threat, or a lie that would enrage someone).\n' +
        '- "dc": your suggested difficulty, 5 to 25.\n' +
        '- "rationale": a short phrase naming what they are trying to do.\n\n' +
        'Shapes:\n' +
        '{"kind":"talk"}\n' +
        '{"kind":"attack"}\n' +
        '{"kind":"skill","skill":"Performance","stakes":"moderate","dc":13,"rationale":"dazzle the crowd"}\n' +
        '{"kind":"flee","skill":"Athletics","stakes":"moderate","dc":12,"rationale":"run for the gate"}\n' +
        '{"kind":"ambiguous","candidateSkills":["Persuasion","Deception"]}'
    );
}

/**
 * Classify one player line.
 *
 * @throws when the model is unreachable or its output cannot be read. The caller
 *   surfaces the message and lets the player retry.
 */
export async function resolvePlayerIntent(
    playerText: string,
    scene: IntentScene,
    skills: IntentSkillInfo[],
    deps: Deps = {},
): Promise<PlayerIntent> {
    const client = deps.client ?? getDefaultClient();
    const prompt = buildIntentPrompt(playerText, scene, skills);

    const result = await client.generateForTask({
        taskType: 'situation_analysis',
        prompt,
        format: 'json',
    });

    if (!result.ok) {
        const errorMsg = 'error' in result && typeof result.error === 'string' ? result.error : undefined;
        if (!errorMsg) {
            throw new Error('Could not read your intent (model call failed without an error message).');
        }
        throw new Error(`Could not read your intent (model unavailable: ${errorMsg}).`);
    }

    const raw = parseJsonRobustly<RawIntent>(result.data.response);
    if (!raw || typeof raw.kind !== 'string') {
        throw new Error('Could not read your intent — try rephrasing.');
    }

    const kind = raw.kind.trim().toLowerCase();

    if (kind === 'talk') return { kind: 'talk' };
    if (kind === 'attack') return { kind: 'attack' };

    if (kind === 'ambiguous') {
        const candidates = Array.isArray(raw.candidateSkills)
            ? raw.candidateSkills.filter(
                  (s): s is string => typeof s === 'string' && !!abilityForSkill(s),
              )
            : [];
        if (candidates.length >= 2) {
            return { kind: 'ambiguous', candidateSkills: candidates.slice(0, 4) };
        }
        // The model degenerated to a single candidate; fall through and treat it
        // as the skill it named.
    }

    const skillName = typeof raw.skill === 'string' ? raw.skill.trim() : '';
    const ability = skillName ? abilityForSkill(skillName) : undefined;
    if (skillName && ability) {
        const stakes = normalizeStakes(raw.stakes);
        return {
            kind: kind === 'flee' ? 'flee' : 'skill',
            skill: skillName,
            ability,
            dc: clampCheckDc(raw.dc, stakes),
            stakes,
            rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
        };
    }

    // A kind that promised an attempt but named no usable skill is unreadable.
    // Saying so beats silently downgrading a pickpocket to small talk.
    throw new Error('Could not read your intent — try rephrasing.');
}
