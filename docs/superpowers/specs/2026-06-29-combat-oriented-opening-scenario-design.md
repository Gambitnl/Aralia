# Combat-Oriented Opening Scenario — Design

**Date:** 2026-06-29 · **Status:** Approved design (pre-plan)

## Goal

Let the freshly generated **opening situation** resolve into a **tactical combat
encounter** when the scene is hostile — driven by what the player *does*. The
player types a free-text response; an LLM infers their intent as a **skill
attempt**; the player makes a real **dice-rolled skill check** (built from their
character sheet, boosted by eligible spells); **success avoids** the fight
(sneak away, talk them down), **failure — or choosing to attack — starts it**.

This is the **Hybrid** model: some openings are flagged tense/hostile; a fight
can begin either because the player attacks or because a de-escalation attempt
fails. Peaceful openings are unchanged.

**No-fallback (D-NOFB) holds throughout:** if the model can't produce a valid
threat or resolve intent, the flow fails honestly — never a canned fight.

## The loop

```
opening generated (hostile) ──▶ conversation opens as today, scene marked hostile
        │                                   │
        │                          player types a response
        │                                   ▼
        │                     LLM infers intent → skill (or ambiguous)
        │                          │                     │
        │                   clear skill            ambiguous → slide-in
        │                          │                clarification pane
        │                          │                     │  (player picks skill)
        │                          ▼◀────────────────────┘
        │              offer eligible roll-boosting spell(s) → optionally cast
        │                          ▼
        │              player rolls d20 + skill modifier  vs  DC (generator-set)
        │                    │                         │
        │              success                     failure
        │                    │                         │
        │        intent lands: escape /          NPCs attack
        │        de-escalate → opening resolves        │
        │        peacefully → normal play              │
        │                                              ▼
        └── "I attack" intent ──────────────▶ START_BATTLE_MAP_ENCOUNTER(threat)
                                                       ▼
                                              GamePhase.COMBAT → CombatView
                                                       ▼
                                              battle ends → handleBattleEnd → normal play
```

## Data model

### 1. `OpeningSituation.threat` (new, optional)

Extend `src/systems/gameEntry/types.ts`. A hostile scene carries a `threat`;
peaceful scenes omit it (and behave exactly as now).

```ts
interface SituationThreat {
  /** The scene is combat-capable. */
  hostile: true;
  /** Enemies as REAL bestiary monsters. Mapped via createEnemyFromMonster.
   *  `cr` is the monster's Challenge Rating string (e.g. "1/8", "2") — the model
   *  provides it (it also drives the DC ladder), and it fills the Monster payload. */
  enemies: Array<{ name: string; quantity: number; cr: string }>;
  /** Base DC for de-escalation checks, scaled by threat danger (see DC rule). */
  deEscalationDC: number;
  /** Short cue the LLM uses to judge what de-escalation looks like here. */
  tension: string; // e.g. "toll-collectors itching for an excuse to rob you"
}

interface OpeningSituation {
  // ...existing: setting, predicament, npcs, openingLine, suggestedReplies?
  threat?: SituationThreat;
}
```

### DC rule (generator-set, scaled by threat)

The generator picks `deEscalationDC` informed by the enemies' danger. Anchor it
to the toughest enemy's CR so it varies by encounter:

- trivial (CR ≤ 1/8): **10**
- low (CR 1/4–1): **13**
- moderate (CR 2–4): **15**
- serious (CR 5+): **18**

The model is instructed to pick from this ladder based on the enemies it wrote,
so DCs stay sane while remaining bespoke per scene.

### 2. Generator changes

`generateOpeningSituation.ts`:
- **Prompt** (`buildOpeningSituationPrompt`): add a section telling the model
  that a scene *may* be hostile; if so, emit a `threat` with real monster names
  it can pick (guided by the bestiary vocabulary — bandits, wolves, goblins,
  cultists, etc.), counts, a `deEscalationDC` from the ladder above, and a
  `tension` cue. Emphasize that most openings are NOT hostile.
- **Parse** (`mapRawSituation`): validate `threat` if present — require
  `enemies[].name` non-empty, `quantity` 1–8, `deEscalationDC` a number in
  [5, 25]; drop the whole `threat` (scene stays peaceful) if malformed rather
  than fabricating one. Names are validated against the runtime monster registry
  at trigger time, not here.

### 3. Entry state (no new machine states)

`gameEntry` keeps its existing states (`idle → generating → in-situation →
model-unavailable`). Combat is launched via the **existing** combat path, which
flips `GamePhase` to `COMBAT` and tears down the conversation. So no new
`gameEntry` status is needed. The `threat` lives inside `gameEntry.situation`.

## Components & flow

### A. Hostile conversation surface

`ConversationPanel` (kind `'situation'`) gains a hostile mode when
`gameState.gameEntry?.situation?.threat` is present:
- The free-text input stays (this is the player's "what do you do").
- A subtle threat indicator (e.g. a red-edged banner: "The situation is tense.")
  signals stakes without dictating the choice.
- `suggestedReplies` (already generated, currently unrendered) are shown as
  optional *prompt chips* the player can click to prefill the input — still
  free-text, just faster. This finally uses that field.

### B. Intent → skill resolver (new)

`src/systems/gameEntry/resolveDeEscalationIntent.ts` — a structured Ollama call.

**Input:** player's free-text response + the `threat.tension` + the character's
skill list (names + governing ability + whether proficient + current modifier).

**Output (JSON):**
```ts
type IntentResolution =
  | { kind: 'attack' }                                   // player chose violence
  | { kind: 'flee' | 'skill'; skill: string; ability: AbilityScoreName;
      rationale: string }                                // a concrete check
  | { kind: 'ambiguous'; candidateSkills: string[] };    // needs clarification
```

- The model maps "slip into the shadows" → Stealth (Dexterity), "tell them
  I'll gut them" → Intimidation (Charisma), "explain we mean no harm" →
  Persuasion (Charisma), "I draw and strike" → `attack`.
- If the sentence doesn't clearly imply one skill, it returns `ambiguous` with
  2–4 candidate skills.
- No-fallback: transport/parse failure surfaces an honest "couldn't read your
  intent — try rephrasing" inline, not a default skill.

### C. Clarification pane (new)

`src/components/gameEntry/SkillClarificationPane.tsx` — a slide-in panel (mounts
on `IntentResolution.kind === 'ambiguous'`).
- Lists each candidate skill as a row with the character's **actual modifier**
  (from `calculateTotalSkillModifier` + ability mod), and **highlights** rows
  where the character is **proficient / has a bonus** so the mechanically-smart
  pick is obvious ("this is different from the other social skills").
- Selecting a row commits `{ kind: 'skill', skill, ability }` and proceeds to
  the check.
- z-index via inline `style={{ zIndex }}` (see project z-index gotcha — Tailwind
  `z-[${...}]` silently fails).

### D. The check (dice + character sheet + spells)

`src/systems/gameEntry/runDeEscalationCheck.ts` orchestrates:
1. **Detect eligible roll-boosts** — spells the character can benefit from for
   THIS skill: (a) already-active `StatusEffect.abilityCheckModifier` matching
   the skill (Guidance, Bless), (b) *castable* buff spells they know (Guidance,
   Bless, Enhance Ability, Bardic Inspiration) that could apply. Offer them in a
   small pre-roll prompt; casting applies the `StatusEffect` (advantage or +dice)
   via the existing cast path so `rollAbilityCheck` picks it up automatically.
2. **Compute modifier** — ability mod + proficiency (`calculateTotalSkillModifier`)
   + advantage flag from active buffs; spell bonus dice (Guidance's 1d4) are
   folded in by `collectStructuredAbilityCheckBonuses` inside the roll.
3. **Player rolls** — `useDice().visualRoll('1d20', { modifier })` (with an
   advantage variant when applicable) so the player physically rolls the 3D dice.
4. **Resolve** — `total >= threat.deEscalationDC` → success, else failure.

Reuse `rollAbilityCheck` for the authoritative modifier composition; drive the
*visible* roll through `useDice` so it's player-triggered, not silent.

### E. Outcome routing (new orchestration in `useOpeningSituation` or a sibling hook)

- **`attack`** → straight to combat (skip the check).
- **`skill`/`flee` success** → narrate the win into the conversation (one NPC
  line + a resolution message), then `SKIP_OPENING_SITUATION` / `END_CONVERSATION`
  → normal play. The threat is spent.
- **failure** → narrate the NPC turning on the player, then **launch combat**.
- **Launch combat:** map `threat.enemies` → `Monster[]` (`{ name, quantity, cr }`
  — cr resolved from the registry entry) and call
  `handleStartBattleMapEncounter(dispatch, { monsters })`. This flips
  `GamePhase.COMBAT`, sets `currentEnemies`, and `CombatView` renders (battle map
  auto-generates). Unknown monster names fall back to `createEnemyFromMonster`'s
  generic enemy (already its behavior) — logged, not faked away.
- **Aftermath:** existing `handleBattleEnd` returns to normal play. The opening
  quest closes as it does today.

## Modules (isolation & clarity)

| Unit | Purpose | Depends on |
|---|---|---|
| `types.ts` `SituationThreat` | Data shape for a hostile scene | — |
| `generateOpeningSituation.ts` (edit) | Emit/validate `threat` | monster registry vocab |
| `resolveDeEscalationIntent.ts` (new) | player sentence → skill/attack/ambiguous | Ollama client, skill list |
| `SkillClarificationPane.tsx` (new) | pick skill when ambiguous | skill modifiers |
| `runDeEscalationCheck.ts` (new) | buffs + modifier + player roll + resolve | checkUtils, useDice, cast path |
| `deEscalationToCombat.ts` (new) | `threat.enemies` → launch encounter | handleStartBattleMapEncounter |
| `ConversationPanel.tsx` (edit) | hostile mode, prompt chips, wire the above | the new units |

Each new unit is independently testable: the resolver and check logic are pure
given injected deps (Ollama, dice, RNG); the combat mapping is a pure transform
to a `Monster[]` payload.

## Error handling (no-fallback)

- Generator can't produce a valid `threat` → scene is peaceful (no fight).
- Intent resolver unreachable/unparseable → inline "couldn't read your intent,
  rephrase" — no default skill, no auto-combat.
- Unknown monster name at launch → `createEnemyFromMonster` generic enemy (its
  existing, logged behavior), so a fight still happens honestly rather than being
  cancelled.
- Dice/roll systems are already robust; a check always produces a number.

## Testing

- **Pure units:** `mapRawSituation` threat validation (valid / malformed /
  absent); `deEscalationToCombat` (`threat.enemies` → correct `Monster[]`);
  DC-ladder mapping from CR.
- **Intent resolver:** injected fake Ollama returning each `kind`; assert the
  correct branch (attack / skill / flee / ambiguous) and that a parse failure
  throws honestly.
- **Check:** injected fake dice + a character with/without proficiency and with
  an active Guidance `StatusEffect`; assert modifier composition and
  success/failure vs DC, including advantage.
- **Routing:** success → `SKIP_OPENING_SITUATION`; failure/attack →
  `START_BATTLE_MAP_ENCOUNTER` with the expected monsters.
- **Live eyeball (standing rule):** with Ollama up, run a hostile opening, fail a
  check, land in `CombatView`; and succeed a Stealth check to escape into normal
  play.

## Build sequence (full vision, sequenced — not cut)

1. **Threat + attack→combat pipe.** `SituationThreat` type + generator
   emit/validate + `deEscalationToCombat` + a temporary "Attack" action that
   launches the encounter end-to-end. Proves opening→CombatView.
2. **Intent → skill → real check, with roll-boosting spells (core).**
   `resolveDeEscalationIntent` + `runDeEscalationCheck`: character-sheet modifier
   + eligible-buff detection/offer (Guidance, Bless, Enhance Ability, Bardic
   Inspiration) applied via the cast path so the check folds them in + player
   dice roll + outcome routing (success avoids, failure fights). Spell buffs are
   part of this step per the decision, not deferred. Free-text drives it.
3. **Clarification pane.** Ambiguous intent → slide-in skill picker with
   modifiers + proficiency highlight.
4. **Hostile-mode polish.** Threat banner + `suggestedReplies` prompt chips.

## Out of scope (for this spec)

- Multi-round social encounters (this is a single decisive check).
- Enemies dynamically reinforcing mid-fight.
- Reworking the general (non-opening) conversation system.
