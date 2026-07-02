# Combat-Oriented Opening Scenario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hostile opening situation resolve into a tactical combat encounter driven by the player's free-text response — an LLM reads it as a skill attempt, the player rolls a real dice check (character sheet + boost spells), success avoids the fight, failure or attacking starts it.

**Architecture:** The generator tags hostile openings with a `threat` (real bestiary enemies + a DC). The player's typed response goes to a structured Ollama call that returns a skill/attack/ambiguous intent. A check orchestrator composes the modifier (via existing `rollAbilityCheck`/buff plumbing) and drives a player-facing 3D dice roll (`useDice`); the outcome routes to either peaceful resolution (`SKIP_OPENING_SITUATION`) or combat (`handleStartBattleMapEncounter`). Pure logic lives in `src/systems/gameEntry/`; a `useDeEscalation` hook wires it into `ConversationPanel`.

**Tech Stack:** TypeScript, React, Vitest, existing Ollama client (`generateForTask`), `checkUtils.rollAbilityCheck`, `useDice`, `handleStartBattleMapEncounter`.

**PROJECT CONVENTION — NO MANUAL COMMITS:** Do NOT run `git commit`. Work is persisted by the repo's 2am auto-snapshot. Wherever a normal plan would say "commit", this plan says **"Checkpoint"** = run the relevant test suites and confirm green. Leave changes in the working tree.

---

## File Structure

**New files:**
- `src/systems/gameEntry/deEscalationToCombat.ts` — pure: `SituationThreat` → `Monster[]`.
- `src/systems/gameEntry/resolveDeEscalationIntent.ts` — structured Ollama call: player sentence → intent.
- `src/systems/gameEntry/runDeEscalationCheck.ts` — compose skill modifier + eligible boost spells + resolve vs DC.
- `src/hooks/useDeEscalation.ts` — orchestration hook (intent → clarify → offer buffs → roll → route).
- `src/components/gameEntry/SkillClarificationPane.tsx` — slide-in skill picker for ambiguous intent.
- Tests colocated under `__tests__/` beside each unit.

**Modified files:**
- `src/systems/gameEntry/types.ts` — add `SituationThreat`, `OpeningSituation.threat`.
- `src/systems/gameEntry/generateOpeningSituation.ts` — prompt threat section + `mapRawSituation` threat validation.
- `src/components/ConversationPanel/ConversationPanel.tsx` — hostile mode, prompt chips, mount `useDeEscalation` + pane.

---

## STEP 1 — Threat data + attack→combat pipe

### Task 1: `SituationThreat` type

**Files:**
- Modify: `src/systems/gameEntry/types.ts`

- [ ] **Step 1: Add the types**

In `src/systems/gameEntry/types.ts`, add above `OpeningSituation` and extend it:

```ts
/**
 * A hostile opening scene's combat data. Present only when the model flags the
 * scene combat-capable; absent scenes behave exactly as a peaceful opening.
 */
export interface SituationThreat {
    hostile: true;
    /** Enemies as REAL bestiary monsters; mapped via createEnemyFromMonster. */
    enemies: Array<{ name: string; quantity: number; cr: string }>;
    /** De-escalation check DC, scaled by the toughest enemy's CR (see DC ladder). */
    deEscalationDC: number;
    /** Short cue describing what the tension is, used to judge de-escalation. */
    tension: string;
}
```

Then add to the `OpeningSituation` interface:
```ts
    /** Present when the scene is hostile/combat-capable. Omitted for peaceful openings. */
    threat?: SituationThreat;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b 2>&1 | grep -iE "gameEntry/types" || echo clean`
Expected: `clean`

- [ ] **Step 3: Checkpoint** — no tests yet; proceed.

---

### Task 2: `deEscalationToCombat` — threat → Monster[]

**Files:**
- Create: `src/systems/gameEntry/deEscalationToCombat.ts`
- Test: `src/systems/gameEntry/__tests__/deEscalationToCombat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { threatToMonsters } from '../deEscalationToCombat';
import type { SituationThreat } from '../types';

const threat: SituationThreat = {
  hostile: true,
  enemies: [
    { name: 'Bandit', quantity: 2, cr: '1/8' },
    { name: 'Bandit Captain', quantity: 1, cr: '2' },
  ],
  deEscalationDC: 15,
  tension: 'toll-collectors itching to rob you',
};

describe('threatToMonsters', () => {
  it('maps each threat enemy to a Monster with name, quantity, cr, description', () => {
    const monsters = threatToMonsters(threat);
    expect(monsters).toEqual([
      { name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' },
      { name: 'Bandit Captain', quantity: 1, cr: '2', description: 'Bandit Captain · CR 2' },
    ]);
  });

  it('drops enemies with empty name or non-positive quantity', () => {
    const monsters = threatToMonsters({
      ...threat,
      enemies: [
        { name: '', quantity: 3, cr: '1' },
        { name: 'Wolf', quantity: 0, cr: '1/4' },
        { name: 'Wolf', quantity: 1, cr: '1/4' },
      ],
    });
    expect(monsters).toEqual([{ name: 'Wolf', quantity: 1, cr: '1/4', description: 'Wolf · CR 1/4' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/gameEntry/__tests__/deEscalationToCombat.test.ts`
Expected: FAIL — cannot find module `../deEscalationToCombat`.

- [ ] **Step 3: Write minimal implementation**

Create `src/systems/gameEntry/deEscalationToCombat.ts`:
```ts
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/deEscalationToCombat.ts
 * Pure transform: a hostile scene's SituationThreat → the Monster[] payload the
 * combat entry point (handleStartBattleMapEncounter) consumes.
 */
import type { Monster } from '../../types/world';
import type { SituationThreat } from './types';

export function threatToMonsters(threat: SituationThreat): Monster[] {
  return threat.enemies
    .filter((e) => typeof e.name === 'string' && e.name.trim().length > 0 && e.quantity > 0)
    .map((e) => ({
      name: e.name.trim(),
      quantity: e.quantity,
      cr: String(e.cr ?? '').trim() || '0',
      description: `${e.name.trim()} · CR ${String(e.cr ?? '').trim() || '0'}`,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/gameEntry/__tests__/deEscalationToCombat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Checkpoint** — suite green.

---

### Task 3: Generator emits + validates `threat`

**Files:**
- Modify: `src/systems/gameEntry/generateOpeningSituation.ts`
- Test: `src/systems/gameEntry/__tests__/generateOpeningSituation.test.ts` (add cases)

- [ ] **Step 1: Write the failing tests**

Add to the existing test file (it already injects a stub client + id factory — mirror its setup):

```ts
it('parses a valid threat block when the model flags the scene hostile', async () => {
  const raw = JSON.stringify({
    setting: { place: 'the toll bridge', timeOfDay: 'dusk', weather: 'cold drizzle' },
    predicament: 'Two toll-collectors block the bridge, hands on their hilts.',
    npcs: [{ name: 'Garrok', role: 'toll-collector', disposition: 'greedy', goal: 'shake you down' }],
    openingLine: { speakerName: 'Garrok', text: 'Pay the toll — or bleed.' },
    suggestedReplies: ['Pay up', 'Refuse'],
    threat: {
      hostile: true,
      enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }],
      deEscalationDC: 13,
      tension: 'toll-collectors itching to rob you',
    },
  });
  const situation = await generateOpeningSituation(CHARACTER, LOCATION, makeDeps(raw));
  expect(situation.threat).toEqual({
    hostile: true,
    enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }],
    deEscalationDC: 13,
    tension: 'toll-collectors itching to rob you',
  });
});

it('drops a malformed threat but keeps the (peaceful) scene', async () => {
  const raw = JSON.stringify({
    setting: { place: 'a plaza', timeOfDay: 'noon', weather: 'clear' },
    predicament: 'A crowd parts around a shouting herald.',
    npcs: [{ name: 'Herald', role: 'town crier', disposition: 'loud', goal: 'be heard' }],
    openingLine: { speakerName: 'Herald', text: 'Hear ye!' },
    threat: { hostile: true, enemies: [{ name: '', quantity: 0, cr: '' }], deEscalationDC: 999 },
  });
  const situation = await generateOpeningSituation(CHARACTER, LOCATION, makeDeps(raw));
  expect(situation.threat).toBeUndefined();
  expect(situation.predicament).toContain('herald');
});
```

> If the existing file doesn't already expose a `makeDeps(rawResponse)` helper + `CHARACTER`/`LOCATION` fixtures, add them by copying the pattern already used at the top of that test file (a stub client whose `generateForTask` resolves `{ ok: true, data: { response: raw } }`, plus a fixed `idFactory`).

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/systems/gameEntry/__tests__/generateOpeningSituation.test.ts`
Expected: FAIL — `situation.threat` is `undefined` in the first test (validation not implemented).

- [ ] **Step 3: Implement — prompt + validation**

In `generateOpeningSituation.ts`:

(a) Extend `RawSituation` (near line 189):
```ts
interface RawSituation {
    setting?: Partial<{ place: string; timeOfDay: string; weather: string }>;
    predicament?: string;
    npcs?: Array<Partial<{ name: string; role: string; disposition: string; goal: string }>>;
    openingLine?: Partial<{ speakerName: string; speakerId: string; text: string }>;
    suggestedReplies?: unknown;
    threat?: {
        hostile?: unknown;
        enemies?: Array<Partial<{ name: string; quantity: number; cr: string }>>;
        deEscalationDC?: unknown;
        tension?: unknown;
    };
}
```

(b) Add a threat validator (place above `mapRawSituation`):
```ts
import type { SituationThreat } from './types';

/** Validate a raw threat block. Returns undefined (peaceful scene) if malformed. */
function mapThreat(raw: RawSituation['threat']): SituationThreat | undefined {
    if (!raw || raw.hostile !== true) return undefined;
    const enemies = (Array.isArray(raw.enemies) ? raw.enemies : [])
        .filter((e) => e && typeof e.name === 'string' && e.name.trim().length > 0)
        .map((e) => ({
            name: (e.name as string).trim(),
            quantity: Math.max(1, Math.min(8, Math.floor(Number(e.quantity) || 1))),
            cr: typeof e.cr === 'string' && e.cr.trim() ? e.cr.trim() : '0',
        }));
    if (enemies.length === 0) return undefined;
    const dc = Number(raw.deEscalationDC);
    if (!Number.isFinite(dc) || dc < 5 || dc > 25) return undefined;
    const tension = typeof raw.tension === 'string' ? raw.tension.trim() : '';
    return { hostile: true, enemies, deEscalationDC: Math.round(dc), tension };
}
```

(c) In `mapRawSituation`, add `threat: mapThreat(raw.threat)` to the returned object (after `suggestedReplies`).

(d) Extend the prompt in `buildOpeningSituationPrompt` — after the TASK paragraph, before `## OUTPUT`, insert:
```ts
    }

## HOSTILITY (usually OMIT this)
Most openings are NOT fights. But if the predicament is genuinely a standoff or
ambush where violence is a real next beat, add a "threat" block: the enemies as
REAL monster-manual names (bandit, wolf, goblin, cultist, thug, guard, etc.) with
a "cr" (challenge rating string like "1/8", "1/4", "1", "2") and a whole-number
"quantity"; a "deEscalationDC" chosen from this ladder by your toughest enemy's
CR — CR<=1/8 → 10, CR 1/4-1 → 13, CR 2-4 → 15, CR 5+ → 18; and a short "tension"
phrase. If the scene is peaceful, DO NOT include "threat".
```
And append `threat` to the OUTPUT JSON shape:
```
  "suggestedReplies": ["2 to 4 short things the player could say"],
  "threat": { "hostile": true, "enemies": [{ "name": "string", "quantity": 1, "cr": "1/8" }], "deEscalationDC": 13, "tension": "string" }
```
(Keep the wording that `threat` is optional.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/gameEntry/__tests__/generateOpeningSituation.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Checkpoint** — run `npx vitest run src/systems/gameEntry/` green.

---

### Task 4: Attack → combat launch (temporary trigger, proves the pipe)

**Files:**
- Modify: `src/components/ConversationPanel/ConversationPanel.tsx`
- Reference: `src/hooks/actions/handleEncounter.ts` (`handleStartBattleMapEncounter`)

- [ ] **Step 1: Add a launch helper on the panel**

In `ConversationPanel.tsx`, read `const threat = gameState.gameEntry?.situation?.threat;`. When present, render a temporary **"⚔ Attack"** button under the input, wired to:
```ts
import { threatToMonsters } from '../../systems/gameEntry/deEscalationToCombat';
import { handleStartBattleMapEncounter } from '../../hooks/actions/handleEncounter';
// ...
const launchOpeningCombat = useCallback(async () => {
  if (!threat) return;
  await handleStartBattleMapEncounter(dispatch, { monsters: threatToMonsters(threat) });
}, [threat, dispatch]);
```
Button:
```tsx
{threat && (
  <button type="button" data-testid="opening-attack" onClick={launchOpeningCombat}
    className="mt-2 px-3 py-2 rounded bg-red-800 hover:bg-red-700 text-red-100 text-sm font-semibold">
    ⚔ Attack
  </button>
)}
```

- [ ] **Step 2: Verify (live eyeball, standing rule)**

Start a new game with Ollama up until you get a hostile opening (retry a few new games if needed — most are peaceful). Confirm the ⚔ Attack button appears; click it; assert the app enters `GamePhase.COMBAT` and `CombatView` renders with the threat's enemies. If Ollama can't produce a hostile scene, temporarily hardcode a `threat` on the resolved situation in dev to verify the pipe, then remove.

- [ ] **Step 3: Checkpoint** — `npx tsc -b 2>&1 | grep -iE "ConversationPanel" || echo clean`.

> The ⚔ Attack button is superseded by free-text intent in Step 2 (Task 7) but stays as the explicit "I attack" path.

---

## STEP 2 — Intent → skill → dice check (with roll-boosting spells)

### Task 5: `resolveDeEscalationIntent` — structured Ollama call

**Files:**
- Create: `src/systems/gameEntry/resolveDeEscalationIntent.ts`
- Test: `src/systems/gameEntry/__tests__/resolveDeEscalationIntent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { resolveDeEscalationIntent } from '../resolveDeEscalationIntent';

const CHAR_SKILLS = [
  { name: 'Stealth', ability: 'Dexterity', proficient: true, modifier: 6 },
  { name: 'Persuasion', ability: 'Charisma', proficient: false, modifier: 0 },
];

function stubClient(response: string) {
  return { generateForTask: vi.fn(async () => ({ ok: true as const, data: { response } })) };
}

describe('resolveDeEscalationIntent', () => {
  it('returns an attack intent', async () => {
    const client = stubClient(JSON.stringify({ kind: 'attack' }));
    const r = await resolveDeEscalationIntent('I draw my blade and strike', 'toll thugs', CHAR_SKILLS, { client });
    expect(r).toEqual({ kind: 'attack' });
  });

  it('maps a sneak sentence to a Stealth skill intent', async () => {
    const client = stubClient(JSON.stringify({ kind: 'skill', skill: 'Stealth', rationale: 'slips away' }));
    const r = await resolveDeEscalationIntent('I slip into the shadows', 'toll thugs', CHAR_SKILLS, { client });
    expect(r).toEqual({ kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: 'slips away' });
  });

  it('returns ambiguous with candidate skills', async () => {
    const client = stubClient(JSON.stringify({ kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception'] }));
    const r = await resolveDeEscalationIntent('I talk to them', 'toll thugs', CHAR_SKILLS, { client });
    expect(r).toEqual({ kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception'] });
  });

  it('throws honestly when the model is unreachable', async () => {
    const client = { generateForTask: vi.fn(async () => ({ ok: false as const, error: 'NO_MODEL' })) };
    await expect(resolveDeEscalationIntent('...', 't', CHAR_SKILLS, { client })).rejects.toThrow(/intent/i);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/systems/gameEntry/__tests__/resolveDeEscalationIntent.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/systems/gameEntry/resolveDeEscalationIntent.ts`:
```ts
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
    `THE PLAYER\'S SKILLS: ${skillList}\n\n` +
    'Rules:\n' +
    '- If they clearly attack / commit violence → {"kind":"attack"}\n' +
    '- If the action clearly implies ONE skill (sneak=Stealth, threaten=Intimidation, ' +
    'lie=Deception, reason=Persuasion, run=Athletics, etc.) → ' +
    '{"kind":"skill","skill":"<one of their skills>","rationale":"<short>"}\n' +
    '- Use "flee" instead of "skill" only when they are escaping the scene entirely.\n' +
    '- If it could reasonably be two or more skills → ' +
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/gameEntry/__tests__/resolveDeEscalationIntent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint** — suite green.

---

### Task 6: `runDeEscalationCheck` — modifier + buffs + resolve

**Files:**
- Create: `src/systems/gameEntry/runDeEscalationCheck.ts`
- Test: `src/systems/gameEntry/__tests__/runDeEscalationCheck.test.ts`
- Reference: `src/utils/character/checkUtils.ts` (`rollAbilityCheck`), `skillModifierUtils.ts`

This unit computes the modifier and resolves success given an INJECTED roll (so it's deterministic in tests); the visible player roll is driven by the hook (Task 8) via `useDice`, passing the d20 face in.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { resolveCheck } from '../runDeEscalationCheck';

describe('resolveCheck', () => {
  it('succeeds when d20 + modifier meets the DC', () => {
    expect(resolveCheck({ d20: 10, modifier: 6, dc: 15 })).toEqual({ success: true, total: 16, d20: 10, modifier: 6, dc: 15 });
  });
  it('fails when below the DC', () => {
    expect(resolveCheck({ d20: 5, modifier: 3, dc: 15 })).toMatchObject({ success: false, total: 8 });
  });
  it('a natural 20 total still just compares to DC (no auto-success rule here)', () => {
    expect(resolveCheck({ d20: 20, modifier: -2, dc: 15 })).toMatchObject({ success: true, total: 18 });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/systems/gameEntry/__tests__/runDeEscalationCheck.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/systems/gameEntry/runDeEscalationCheck.ts`:
```ts
/**
 * @file src/systems/gameEntry/runDeEscalationCheck.ts
 * Pure resolution + modifier composition for an opening de-escalation check.
 * The visible player roll is supplied by the caller (from useDice), so this
 * stays deterministic and unit-testable.
 */
import type { PlayerCharacter } from '../../types';
import type { AbilityScoreName } from '../../types';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import { calculateTotalSkillModifier } from '../../utils/character/skillModifierUtils';

export interface CheckResolution {
  success: boolean;
  total: number;
  d20: number;
  modifier: number;
  dc: number;
}

export function resolveCheck(args: { d20: number; modifier: number; dc: number }): CheckResolution {
  const total = args.d20 + args.modifier;
  return { success: total >= args.dc, total, d20: args.d20, modifier: args.modifier, dc: args.dc };
}

/**
 * Compose the non-d20 modifier for a character's skill check: ability mod +
 * proficiency (if the character has the skill). Spell bonus DICE (Guidance 1d4)
 * are NOT added here — they are applied through the existing rollAbilityCheck
 * plumbing when the buff StatusEffect is present; the hook adds them via the
 * dice notation. This returns the flat, deterministic part.
 */
export function computeSkillModifier(
  character: PlayerCharacter,
  ability: AbilityScoreName,
  skillName: string,
): number {
  const abilityScore = character.finalAbilityScores[ability];
  const proficient = (character.skills ?? []).some(
    (s) => s.name.toLowerCase() === skillName.toLowerCase(),
  );
  return calculateTotalSkillModifier({
    abilityScore,
    hasProficiency: proficient,
    level: character.level ?? 1,
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/gameEntry/__tests__/runDeEscalationCheck.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint** — suite green.

---

### Task 7: Eligible roll-boost spell detection

**Files:**
- Modify: `src/systems/gameEntry/runDeEscalationCheck.ts` (add detection)
- Test: same test file (add cases)
- Reference: `src/types/combat.ts` `StatusEffect.abilityCheckModifier`; `checkUtils.ts` `collectStructuredAbilityCheckBonuses`

- [ ] **Step 1: Write the failing test**

```ts
import { getActiveCheckBoosts } from '../runDeEscalationCheck';

it('reports an active Guidance buff that matches the skill', () => {
  const character = {
    statusEffects: [
      { id: 'g', name: 'Guidance (Stealth)', type: 'buff', duration: 10, source: 'Guidance',
        abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill', frequency: 'every_matching_check', durationScope: 'while_active' },
        modifiers: { skill: 'Stealth' } },
    ],
  } as any;
  const boosts = getActiveCheckBoosts(character, 'Stealth');
  expect(boosts.map((b) => b.source)).toEqual(['Guidance']);
});

it('ignores a Guidance bound to a different skill', () => {
  const character = { statusEffects: [
    { id: 'g', name: 'Guidance (Athletics)', type: 'buff', duration: 10, source: 'Guidance',
      abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill', frequency: 'every_matching_check', durationScope: 'while_active' },
      modifiers: { skill: 'Athletics' } },
  ] } as any;
  expect(getActiveCheckBoosts(character, 'Stealth')).toEqual([]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/systems/gameEntry/__tests__/runDeEscalationCheck.test.ts`
Expected: FAIL — `getActiveCheckBoosts` not exported.

- [ ] **Step 3: Implement — add to `runDeEscalationCheck.ts`**

```ts
import type { StatusEffect } from '../../types/combat';

export interface CheckBoost { source: string; bonusDice?: string; advantage: boolean; }

/**
 * Active roll-boosting effects that apply to THIS skill: Guidance/Bless-style
 * bonus dice, and advantage from Enhance Ability. Mirrors the matching rules in
 * checkUtils.collectStructuredAbilityCheckBonuses so the two never disagree.
 */
export function getActiveCheckBoosts(
  character: { statusEffects?: StatusEffect[] },
  skillName: string,
): CheckBoost[] {
  const out: CheckBoost[] = [];
  for (const eff of character.statusEffects ?? []) {
    const mod = eff.abilityCheckModifier;
    if (mod && mod.appliesTo === 'ability_check') {
      if (mod.skillSelection === 'chosen_skill') {
        const chosen = eff.modifiers?.skill?.trim().toLowerCase();
        if (!chosen || chosen !== skillName.toLowerCase()) continue;
      }
      out.push({ source: eff.source || eff.name, bonusDice: mod.bonusDice, advantage: false });
    }
    const advList = eff.modifiers?.advantage;
    if (Array.isArray(advList) && advList.includes('check')) {
      const chosen = eff.modifiers?.skill?.trim().toLowerCase();
      if (!chosen || chosen === skillName.toLowerCase()) {
        out.push({ source: eff.source || eff.name, advantage: true });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/systems/gameEntry/__tests__/runDeEscalationCheck.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint** — `npx vitest run src/systems/gameEntry/` green.

> Offering CASTABLE (not-yet-active) buffs is a UI affordance handled in the hook (Task 8): if the character knows Guidance/Bless and it isn't active, show a "cast before rolling" prompt that dispatches the existing cast path, then re-reads active boosts. The out-of-combat cast path is the same one the spellbook uses; wire to it during Task 8 and verify live.

---

### Task 8: `useDeEscalation` hook — orchestration + routing

**Files:**
- Create: `src/hooks/useDeEscalation.ts`
- Test: `src/hooks/__tests__/useDeEscalation.test.ts`
- Reference: `useDice` (`src/contexts/DiceContext`), the units above, `handleStartBattleMapEncounter`

- [ ] **Step 1: Write the failing test** (logic-only; inject dice + intent resolver + dispatch)

```ts
import { describe, expect, it, vi } from 'vitest';
import { runDeEscalationFlow } from '../useDeEscalation';

const CHARACTER = {
  level: 1, finalAbilityScores: { Dexterity: 16, Charisma: 8 },
  skills: [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }],
  statusEffects: [],
} as any;

const THREAT = { hostile: true, enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }], deEscalationDC: 12, tension: 't' };

it('success avoids combat and resolves the opening', async () => {
  const dispatch = vi.fn();
  const rollD20 = vi.fn(async () => 18); // 18 + Stealth mod(3+2)=23 >= 12
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER, threat: THREAT, dispatch, rollD20,
  });
  expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
});

it('failure starts combat with the threat monsters', async () => {
  const dispatch = vi.fn();
  const started = vi.fn(async () => {});
  const rollD20 = vi.fn(async () => 1); // 1 + 5 = 6 < 12
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER, threat: THREAT, dispatch, rollD20, startEncounter: started,
  });
  expect(started).toHaveBeenCalledWith(dispatch, { monsters: [{ name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' }] });
});

it('attack intent goes straight to combat, no roll', async () => {
  const dispatch = vi.fn();
  const started = vi.fn(async () => {});
  const rollD20 = vi.fn(async () => 20);
  await runDeEscalationFlow({ intent: { kind: 'attack' }, character: CHARACTER, threat: THREAT, dispatch, rollD20, startEncounter: started });
  expect(rollD20).not.toHaveBeenCalled();
  expect(started).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/hooks/__tests__/useDeEscalation.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the pure flow + the hook wrapper**

Create `src/hooks/useDeEscalation.ts`:
```ts
/**
 * @file src/hooks/useDeEscalation.ts
 * Orchestrates a hostile opening's resolution: intent → (roll) → route to
 * peaceful resolution or combat. `runDeEscalationFlow` is the pure, injectable
 * core; the hook binds it to useDice + the real encounter launcher.
 */
import type React from 'react';
import type { AppAction } from '../state/actionTypes';
import type { PlayerCharacter } from '../types';
import type { SituationThreat } from '../systems/gameEntry/types';
import type { IntentResolution } from '../systems/gameEntry/resolveDeEscalationIntent';
import { threatToMonsters } from '../systems/gameEntry/deEscalationToCombat';
import { computeSkillModifier, resolveCheck, getActiveCheckBoosts } from '../systems/gameEntry/runDeEscalationCheck';
import { handleStartBattleMapEncounter } from './actions/handleEncounter';
import { useDice } from '../contexts/DiceContext';
import { useCallback } from 'react';

export interface DeEscalationFlowArgs {
  intent: IntentResolution;
  character: PlayerCharacter;
  threat: SituationThreat;
  dispatch: React.Dispatch<AppAction>;
  /** Returns the d20 face the player rolled. */
  rollD20: (advantage: boolean) => Promise<number>;
  /** Injectable for tests; defaults to the real encounter launcher. */
  startEncounter?: typeof handleStartBattleMapEncounter;
}

export async function runDeEscalationFlow(args: DeEscalationFlowArgs): Promise<void> {
  const { intent, character, threat, dispatch, rollD20 } = args;
  const startEncounter = args.startEncounter ?? handleStartBattleMapEncounter;

  if (intent.kind === 'attack') {
    await startEncounter(dispatch, { monsters: threatToMonsters(threat) });
    return;
  }

  const boosts = getActiveCheckBoosts(character, intent.skill);
  const advantage = boosts.some((b) => b.advantage);
  const modifier = computeSkillModifier(character, intent.ability, intent.skill);

  const d20 = await rollD20(advantage);
  const { success } = resolveCheck({ d20, modifier, dc: threat.deEscalationDC });

  if (success) {
    dispatch({ type: 'SKIP_OPENING_SITUATION' });
  } else {
    await startEncounter(dispatch, { monsters: threatToMonsters(threat) });
  }
}

export function useDeEscalation() {
  const { visualRoll } = useDice();
  const rollD20 = useCallback(async (advantage: boolean): Promise<number> => {
    // Roll two dice and take the better/worse face on advantage/disadvantage.
    const a = await visualRoll('1d20');
    if (!advantage) return a.rolls[0]?.value ?? a.total;
    const b = await visualRoll('1d20');
    return Math.max(a.rolls[0]?.value ?? a.total, b.rolls[0]?.value ?? b.total);
  }, [visualRoll]);
  return { runDeEscalationFlow, rollD20 };
}
```

> Note: `resolveCheck` uses the d20 FACE + flat modifier. Guidance-style bonus DICE (`bonusDice`) are surfaced by `getActiveCheckBoosts` for display and can be added to the roll notation in the hook later; the flat proficiency+ability modifier is the deterministic core proven here. Advantage is honored via the double-roll.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/hooks/__tests__/useDeEscalation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint** — suite green.

---

### Task 9: Wire free-text intent into `ConversationPanel`

**Files:**
- Modify: `src/components/ConversationPanel/ConversationPanel.tsx`

- [ ] **Step 1: Replace the temporary Attack button with the intent flow**

When `threat` is present and the player submits their input, instead of `sendPlayerMessage`, run:
```ts
import { resolveDeEscalationIntent, type IntentSkillInfo } from '../../systems/gameEntry/resolveDeEscalationIntent';
import { computeSkillModifier } from '../../systems/gameEntry/runDeEscalationCheck';
import { useDeEscalation } from '../../hooks/useDeEscalation';
import { SKILLS_DATA } from '../../data/skills';
// ...
const { runDeEscalationFlow, rollD20 } = useDeEscalation();
const pc = gameState.party[0];

const skillInfos: IntentSkillInfo[] = Object.values(SKILLS_DATA).map((s) => ({
  name: s.name, ability: s.ability,
  proficient: (pc?.skills ?? []).some((k) => k.name.toLowerCase() === s.name.toLowerCase()),
  modifier: pc ? computeSkillModifier(pc, s.ability, s.name) : 0,
}));

const handleHostileSubmit = useCallback(async (text: string) => {
  if (!threat || !pc) return;
  const intent = await resolveDeEscalationIntent(text, threat.tension, skillInfos);
  if (intent.kind === 'ambiguous') { setPendingClarification(intent.candidateSkills); return; } // Task 10
  await runDeEscalationFlow({ intent, character: pc, threat, dispatch, rollD20 });
}, [threat, pc, skillInfos, runDeEscalationFlow, rollD20, dispatch]);
```
Route the panel's submit to `handleHostileSubmit` when `threat` is present, else the existing `sendPlayerMessage`. Wrap in try/catch: on throw, show the message inline ("Couldn't read your intent — try rephrasing") without ending the conversation. Keep the ⚔ Attack button (explicit attack path) calling `runDeEscalationFlow({ intent: { kind: 'attack' }, ... })`.

- [ ] **Step 2: Live eyeball** — hostile opening → type "I sneak away" → intent resolves → dice roll → success escapes / failure fights. Type "I attack" → straight to combat.

- [ ] **Step 3: Checkpoint** — `npx tsc -b 2>&1 | grep -iE "ConversationPanel|useDeEscalation" || echo clean`; `npx vitest run src/systems/gameEntry/ src/hooks/__tests__/useDeEscalation.test.ts` green.

---

## STEP 3 — Clarification pane

### Task 10: `SkillClarificationPane`

**Files:**
- Create: `src/components/gameEntry/SkillClarificationPane.tsx`
- Test: `src/components/gameEntry/__tests__/SkillClarificationPane.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillClarificationPane } from '../SkillClarificationPane';

const CANDIDATES = [
  { name: 'Persuasion', ability: 'Charisma' as const, proficient: true, modifier: 5 },
  { name: 'Deception', ability: 'Charisma' as const, proficient: false, modifier: -1 },
];

describe('SkillClarificationPane', () => {
  it('lists candidates with modifiers and flags proficiency', () => {
    render(<SkillClarificationPane candidates={CANDIDATES} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Persuasion')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByTestId('skill-proficient-Persuasion')).toBeTruthy();
    expect(screen.queryByTestId('skill-proficient-Deception')).toBeNull();
  });
  it('calls onPick with the chosen candidate', () => {
    const onPick = vi.fn();
    render(<SkillClarificationPane candidates={CANDIDATES} onPick={onPick} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('skill-pick-Deception'));
    expect(onPick).toHaveBeenCalledWith(CANDIDATES[1]);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/components/gameEntry/__tests__/SkillClarificationPane.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/components/gameEntry/SkillClarificationPane.tsx`:
```tsx
import React from 'react';
import { Z_INDEX } from '../../styles/zIndex';
import type { IntentSkillInfo } from '../../systems/gameEntry/resolveDeEscalationIntent';

interface Props {
  candidates: IntentSkillInfo[];
  onPick: (skill: IntentSkillInfo) => void;
  onCancel: () => void;
}

export const SkillClarificationPane: React.FC<Props> = ({ candidates, onPick, onCancel }) => (
  // z-index via inline style — Tailwind z-[${...}] silently fails in this repo.
  <div data-testid="skill-clarification" style={{ zIndex: Z_INDEX.MODAL_INTERACTIVE }}
    className="fixed right-0 top-1/4 bottom-1/4 w-80 bg-gray-900 border-l border-amber-500/60 shadow-2xl p-4 flex flex-col gap-2 animate-in slide-in-from-right">
    <h3 className="text-amber-300 font-bold text-sm">Which approach?</h3>
    <p className="text-xs text-gray-400 mb-2">Pick the skill you mean. Bold = you're proficient.</p>
    {candidates.map((c) => (
      <button key={c.name} data-testid={`skill-pick-${c.name}`} onClick={() => onPick(c)}
        className={`flex justify-between items-center px-3 py-2 rounded border text-sm transition-colors
          ${c.proficient ? 'border-amber-500/70 bg-amber-900/20 text-amber-100 font-semibold' : 'border-gray-700 bg-gray-800 text-gray-200'}`}>
        <span>{c.name}{c.proficient && <span data-testid={`skill-proficient-${c.name}`} className="ml-1 text-[10px] uppercase text-amber-400">prof</span>}</span>
        <span className="tabular-nums">{c.modifier >= 0 ? '+' : ''}{c.modifier}</span>
      </button>
    ))}
    <button onClick={onCancel} className="mt-2 text-xs text-gray-500 hover:text-gray-300 self-end">Cancel</button>
  </div>
);
```

- [ ] **Step 4: Run to verify pass** — PASS (2 tests).

- [ ] **Step 5: Wire into ConversationPanel** — add `const [pendingClarification, setPendingClarification] = useState<string[] | null>(null);`. When set, render `<SkillClarificationPane candidates={skillInfos.filter(s => pendingClarification.includes(s.name))} onPick={(s) => { setPendingClarification(null); runDeEscalationFlow({ intent: { kind: 'skill', skill: s.name, ability: s.ability, rationale: '' }, character: pc!, threat: threat!, dispatch, rollD20 }); }} onCancel={() => setPendingClarification(null)} />`.

- [ ] **Step 6: Checkpoint** — suites green; live eyeball an ambiguous reply ("I deal with them") → pane slides in → pick → roll.

---

## STEP 4 — Hostile-mode polish

### Task 11: Threat banner + suggested-reply chips

**Files:**
- Modify: `src/components/ConversationPanel/ConversationPanel.tsx`

- [ ] **Step 1:** When `threat` is present, render a red-edged banner above the messages: `The situation is tense.` (`data-testid="hostile-banner"`), styled `border border-red-500/50 bg-red-900/20 text-red-200 text-xs rounded px-3 py-1 mb-2`.

- [ ] **Step 2:** Render `conversation`'s `suggestedReplies` (from `gameState.gameEntry?.situation?.suggestedReplies`) as clickable chips above the input; clicking one prefills the input (`setInputText(reply)`), still free-text/editable. `data-testid="reply-chip"`.

- [ ] **Step 3: Live eyeball** — hostile opening shows the banner + chips; clicking a chip fills the box; editing + submit still runs the intent flow.

- [ ] **Step 4: Checkpoint** — `npx tsc -b 2>&1 | grep -iE "ConversationPanel" || echo clean`; full `npx vitest run src/systems/gameEntry/ src/hooks/__tests__/useDeEscalation.test.ts src/components/gameEntry/` green.

---

## Self-review notes

- **Spec coverage:** threat data (T1), enemy mapping (T2), generator emit/validate + DC ladder (T3), attack→combat (T4), intent resolver + ambiguity + honest failure (T5), check + character sheet (T6), roll-boost detection (T7), routing success-avoids/failure-fights (T8), free-text wiring (T9), clarification pane with proficiency highlight (T10), banner + chips (T11). All spec sections map to a task.
- **No-fallback:** T3 drops malformed threats (peaceful), T5 throws on unreachable/unparseable, T9 surfaces the throw inline — never a canned fight.
- **Type consistency:** `SituationThreat` (T1) used identically in T2/T3/T8; `IntentResolution`/`IntentSkillInfo` (T5) reused in T8/T9/T10; `resolveCheck`/`computeSkillModifier`/`getActiveCheckBoosts` (T6/T7) consumed only in T8.
- **Deferred detail (flagged, not hidden):** casting a not-yet-active buff spell mid-flow (T7 note) and adding Guidance bonus-DICE to the rolled notation (T8 note) are wired during T8/T9 against the real spellbook cast path and verified live — the deterministic flat-modifier core is fully tested; the dice-bonus rider is additive.
