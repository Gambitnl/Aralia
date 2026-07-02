/**
 * @file src/systems/gameEntry/resolveDeEscalationIntent.ts
 * Structured Ollama call: read the player's free-text response to a hostile
 * opening and classify it as an attack, a concrete skill attempt, or ambiguous.
 * NO FALLBACK: transport/parse failure throws (caller surfaces an honest retry).
 */
import type { OllamaClient } from '../../services/ollama/client';
import { getDefaultClient } from '../../services/ollama/client';
import { parseJsonRobustly } from '../../services/ollama/jsonParser';
import { SKILLS_DATA } from '../../data/skills';
import type { AbilityScoreName } from '../../types';

export interface IntentSkillInfo {
  name: string;
  ability: AbilityScoreName;
  proficient: boolean;
  modifier: number;
}

export type IntentResolution =
  | { kind: 'attack' }
  | { kind: 'skill' | 'flee'; skill: string; ability: AbilityScoreName; rationale: string }
  | { kind: 'ambiguous'; candidateSkills: string[] };

interface Deps { client?: OllamaClient; }

interface RawIntent {
  kind?: string;
  skill?: string;
  rationale?: string;
  candidateSkills?: unknown;
}

function abilityForSkill(skill: string): AbilityScoreName | undefined {
  const entry = Object.values(SKILLS_DATA).find(
    (s) => s.name.toLowerCase() === skill.trim().toLowerCase(),
  );
  return entry?.ability;
}

export async function resolveDeEscalationIntent(
  playerText: string,
  tension: string,
  skills: IntentSkillInfo[],
  deps: Deps = {},
): Promise<IntentResolution> {
  const client = deps.client ?? getDefaultClient();
  const skillList = skills
    .map((s) => `${s.name} (${s.ability}${s.proficient ? ', proficient' : ''}, ${s.modifier >= 0 ? '+' : ''}${s.modifier})`)
    .join('; ');

  const prompt =
    'You are the game master resolving how a player reacts to a hostile standoff. ' +
    'Read the player\'s action and classify it. Output ONLY JSON.\n\n' +
    `TENSION: ${tension}\n` +
    `PLAYER ACTION: ${playerText}\n` +
    `THE PLAYER'S SKILLS: ${skillList}\n\n` +
    'Rules:\n' +
    '- If they clearly attack / commit violence -> {"kind":"attack"}\n' +
    '- If the action clearly implies ONE skill (sneak=Stealth, threaten=Intimidation, ' +
    'lie=Deception, reason=Persuasion, run=Athletics, etc.) -> ' +
    '{"kind":"skill","skill":"<one of their skills>","rationale":"<short>"}\n' +
    '- Use "flee" instead of "skill" only when they are escaping the scene entirely.\n' +
    '- If it could reasonably be two or more skills -> ' +
    '{"kind":"ambiguous","candidateSkills":["Skill A","Skill B"]}\n' +
    'Pick skills ONLY from the player\'s skill list names.';

  const result = await client.generateForTask({ taskType: 'opening_situation', prompt, format: 'json' });
  if (!result.ok) throw new Error(`Could not read your intent (model unavailable: ${result.error}).`);

  const raw = parseJsonRobustly<RawIntent>(result.data.response);
  if (!raw || typeof raw.kind !== 'string') {
    throw new Error('Could not read your intent — try rephrasing.');
  }

  if (raw.kind === 'attack') return { kind: 'attack' };

  if (raw.kind === 'ambiguous') {
    const candidates = Array.isArray(raw.candidateSkills)
      ? raw.candidateSkills.filter((s): s is string => typeof s === 'string' && !!abilityForSkill(s))
      : [];
    if (candidates.length >= 2) return { kind: 'ambiguous', candidateSkills: candidates.slice(0, 4) };
    // fall through to skill handling if the model degenerated to one candidate
  }

  const skillName = typeof raw.skill === 'string' ? raw.skill.trim() : '';
  const ability = skillName ? abilityForSkill(skillName) : undefined;
  if (skillName && ability) {
    const kind = raw.kind === 'flee' ? 'flee' : 'skill';
    return { kind, skill: skillName, ability, rationale: typeof raw.rationale === 'string' ? raw.rationale : '' };
  }

  throw new Error('Could not read your intent — try rephrasing.');
}
