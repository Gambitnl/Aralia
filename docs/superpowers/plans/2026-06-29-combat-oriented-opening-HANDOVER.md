# Handover — Combat-Oriented Opening Scenario (and session context)

**Date:** 2026-06-29 · **Author:** prior session (Remy + Claude) · **Status of feature:** ~~CODE-COMPLETE, awaiting live verification~~ **LIVE-VERIFIED 2026-07-01** — every §3.4 item observed working in a real browser across 9 new-game runs. Verification surfaced 5 real defects, all fixed the same day (87 feature tests green):

1. **SKIP_OPENING_SITUATION was a silent no-op from `in-situation`** (entryStateMachine only allowed it from `model-unavailable`) — the success path never actually cleared the threat. Transition extended.
2. **Threat survived the de-escalation combat** — the post-battle conversation re-armed the SAME fight (infinite XP/gold loop, reproduced live). `runDeEscalationFlow` now clears the threat on every terminal route.
3. **No outcome feedback** — dice settled and the world just changed. A narrator line now reports `<Skill> check: d20 ± mod = total vs DC — success/failure.`
4. **Dice overlay: broken z-index** (template-literal Tailwind class → `z-index: auto`), **no auto-dismiss** (tray sat over the game until clicked), and **no stall protection** (a frozen physics sim hung the flow forever — 30s watchdog now rejects honestly; ⚔ Attack / pane picks also surfaced no errors before, now routed through one error-surfaced entry).
5. **Hostile-mode layout** — chips/attack/error rendered INSIDE the flex-row input container: chips collapsed to a side column, ⚔ Attack pushed off-screen. Restructured as full-width blocks.

**§3.5 BUILT + LIVE-VERIFIED 2026-07-02:** the pre-roll buff offer is in. When a resolved skill intent is about to roll, the panel checks the party head's known spells (data-driven: any spell whose effect payload carries `abilityCheckModifier.appliesTo === 'ability_check'` — Guidance, Enhance Ability) that aren't already active for that skill and are payable (cantrip = free; leveled = lowest available slot), and offers "Cast X — +1d4 (free) / Just roll". Accepting casts through the real path: `handleCastSpell` consumes the slot/components, a new `APPLY_CHARACTER_STATUS_EFFECT` reducer action persists the engine-shaped StatusEffect onto the party member (the combat engine only ever wrote to CombatState snapshots — this bridge did not exist), and the roll fires only after the buff is readable on the re-rendered character. Building this exposed **bug #6: active bonus dice were silently dropped** — `runDeEscalationFlow` collected Guidance's 1d4 and never rolled it. Now the check rolls d20 + bonus dice in one tray sequence and the narrator line itemizes them. Live proof: a Druid cast Guidance before sneaking and the d4 was decisive — "Stealth check: 9 + 2 + 3 (Guidance) = 14 vs DC 13 — success" (11 would have failed). New files: `src/systems/gameEntry/preRollBuffOffer.ts` (+tests), `src/state/reducers/__tests__/applyCharacterStatusEffect.test.ts`; the character-side `StatusEffect` type (types/effects.ts) gained the rich optional fields party members already carry at runtime. 125 feature tests green.

Still open: a live look at a *peaceful* opening post-fix (all verification runs forced hostile), and the playthrough-sweep observation that the post-combat conversation still repeats the pre-fight NPC line.

This document hands off the "combat-oriented opening scenario" feature plus the other loose threads from the session. It assumes zero prior context.

---

## 1. TL;DR — what to do next

1. **Reboot / bring the stack up:** dev server (`preview_start` name `dev`) + local **Ollama** running. The server was parked mid-session. `autoPort: true` is now set in `.claude/launch.json`, so it will grab a free port if 5174 is taken.
2. **Live-verify the combat opening** (details in §3.4). This is the only thing standing between "code-complete" and "done".
3. **Wire the one deferred additive piece:** the pre-roll "cast a buff first?" offer (§3.5).
4. Optionally pick up the parked/loose threads in §4.

Nothing is committed — the repo auto-commits at 2am. Everything is in the working tree on **master** (Remy works only on master; never branch/worktree).

---

## 2. What this feature is

When a new game starts, an Ollama model already generates an **opening situation** (a predicament + NPCs + an opening line) and drops the player into a conversation. This feature makes that opening able to **turn into a tactical fight** based on what the player does.

**The loop (only for openings the model flags hostile):**
- The generated situation may carry a hidden **threat** (real bestiary enemies + a difficulty).
- The player **types what they do** ("I slip into the shadows", "I tell them to back off", "I draw my blade").
- An LLM reads that as an **intent**: `attack`, a concrete **skill** attempt, or **ambiguous**.
- Ambiguous → a **slide-in pane** asks which skill (showing the character's modifiers, flagging proficiencies).
- The player **rolls a real d20** (character sheet modifier; active buff spells like Guidance already fold in) vs the DC.
- **Success → the danger passes** (sneak away / talk down) and normal play resumes. **Failure or attacking → combat** on the tactical map. After the fight, normal play resumes.
- **No-fallback throughout:** if the model can't produce a threat or read intent, it fails honestly — never a canned fight.

**Spec:** `docs/superpowers/specs/2026-06-29-combat-oriented-opening-scenario-design.md`
**Plan:** `docs/superpowers/plans/2026-06-29-combat-oriented-opening-scenario.md`

---

## 3. Feature status & how it's built

### 3.1 Verification state
- **51 tests green** across 11 files (data + resolver + check + routing + pane).
- **`tsc` clean** on every feature file (`npx tsc -b 2>&1 | grep -iE "deEscalation|resolveDeEscalationIntent|runDeEscalationCheck|SkillClarification|ConversationPanel|gameEntry/types|generateOpeningSituation|useDeEscalation"` → nothing).
- Re-run the suite anytime: `npx vitest run src/systems/gameEntry/ src/hooks/__tests__/useDeEscalation.test.ts src/components/gameEntry/`

### 3.2 Files created
| File | Responsibility |
|---|---|
| `src/systems/gameEntry/deEscalationToCombat.ts` | Pure `threatToMonsters(threat) → Monster[]`. |
| `src/systems/gameEntry/resolveDeEscalationIntent.ts` | Structured Ollama call: player sentence → `{attack}` / `{skill\|flee, skill, ability, rationale}` / `{ambiguous, candidateSkills}`. Throws on unreachable/unparseable. Exports `IntentSkillInfo`, `IntentResolution`. |
| `src/systems/gameEntry/runDeEscalationCheck.ts` | `resolveCheck({d20,modifier,dc})`, `computeSkillModifier(char,ability,skill)`, `getActiveCheckBoosts(char,skill)`. |
| `src/hooks/useDeEscalation.ts` | `runDeEscalationFlow(args)` pure core (routes success→`SKIP_OPENING_SITUATION`, failure/attack→combat) + `useDeEscalation()` hook binding it to `useDice`. |
| `src/components/gameEntry/SkillClarificationPane.tsx` | Slide-in skill picker for ambiguous intent (proficiency-highlighted, inline z-index). |
| Colocated `__tests__/` for each of the above. |

### 3.3 Files modified
| File | Change |
|---|---|
| `src/systems/gameEntry/types.ts` | Added `SituationThreat` interface + optional `OpeningSituation.threat`. |
| `src/systems/gameEntry/generateOpeningSituation.ts` | Prompt now offers an optional `threat` block (enemies w/ CR, DC ladder by CR, tension); `mapThreat()` validates it and drops malformed threats (scene stays peaceful). Peaceful openings unchanged. |
| `src/components/ConversationPanel/ConversationPanel.tsx` | Hostile mode (gated on `threat`): tense banner, suggested-reply chips (prefill input), ⚔ Attack button, free-text submit routed to intent resolution → clarification pane or `runDeEscalationFlow`, inline intent-error line. The single existing `handleSend` path was branched: `if (threat) handleHostileSubmit(text)` else the original `sendPlayerMessage`. Peaceful conversations + scene image untouched. |

### 3.4 Live verification checklist (DO THIS FIRST after reboot)
Standing rule: eyeball every generation/visual slice. With Ollama up:
- [ ] Start a **new game**; retry a few (most openings are peaceful — the model rarely flags `threat`). To force one for testing, you can temporarily hardcode a `threat` on the resolved situation, or lower the prompt's reluctance. Confirm the **tense banner** + **reply chips** appear only on hostile openings.
- [ ] Type **"I draw my sword and attack"** (or click ⚔ Attack) → app enters `GamePhase.COMBAT`, `CombatView` renders with the threat's enemies.
- [ ] Type **"I sneak away"** → intent resolves to Stealth → **3D dice roll** → success escapes into normal play (`SKIP_OPENING_SITUATION`), failure drops into combat.
- [ ] Type an **ambiguous** line ("I deal with them") → `SkillClarificationPane` slides in from the right with candidate skills + modifiers, proficiency bold → pick one → roll.
- [ ] Stop Ollama, submit a reply → the **honest** "Couldn't read your intent" inline error (no canned fight).
- [ ] After a fight ends, confirm normal play resumes (existing `handleBattleEnd`).

Preview gotchas (from memory): `preview_screenshot`/`snapshot` hang on the R3F 3D scene; drive via `preview_eval` DOM checks. Cold-start compile on a fresh server can block the tab for 1–3 min. Combat launch path: `handleStartBattleMapEncounter(dispatch, { monsters })`.

### 3.5 The one deferred piece — pre-roll buff offer
The plan (Tasks 6–8) built the deterministic core: **already-active** roll-boost buffs (Guidance/Bless/Enhance Ability) fold into the check automatically via `getActiveCheckBoosts` + the existing `checkUtils.collectStructuredAbilityCheckBonuses` plumbing, and advantage is honored by the hook's double-roll.

**Not yet wired:** *offering to CAST a known-but-inactive buff* right before the roll (e.g. the caster knows Guidance but hasn't cast it). This needs the real out-of-combat spellbook cast path, which is easier to wire correctly against a running app than to guess offline. Steps when you pick it up:
- Detect: does the party head **know** a check-boosting spell (Guidance, Bless, Enhance Ability, Bardic Inspiration) that isn't already an active `StatusEffect` for this skill?
- Offer a small pre-roll prompt; on accept, cast via the same path the spellbook uses (applies the `StatusEffect`), then re-read `getActiveCheckBoosts` so the check picks it up.
- The check side already consumes `StatusEffect.abilityCheckModifier`, so once the buff is active, nothing else changes.

Also note (from a subagent): `runDeEscalationFlow` defensively routes an `ambiguous` intent straight to combat — but the ConversationPanel intercepts ambiguous and shows the pane first, so that branch is unreachable in practice. Fine as a type-narrowing guard.

---

## 4. Other loose threads from the session (not part of this feature)

### 4.1 Opening-scenario VISUAL (separate, parked earlier)
A different feature: an AI-generated **illustration** of the opening predicament. See memory `image-gen-architecture.md`. Engine built (`src/systems/gameEntry/openingScenePrompt.ts` (tested), `src/services/SceneService.ts`, `scripts/vite-plugins/sceneApiManager.ts` + registered in `vite.config.ts`, `SCENE_OUTPUT_DIR`). **Remaining:** state (`gameEntry.sceneImage`) + wiring on situation-resolve + a display banner in ConversationPanel for `kind:'situation'`. (NOTE: the ConversationPanel already shows a scene image per a prior edit — reconcile with that when resuming.)

### 4.2 BROKEN: AI portrait backend (spawned as a task chip)
`scripts/vite-plugins/portraitApiManager.ts` imports `generatePortraitWithStitch` from a `generate-portrait` module **that doesn't exist** (TS2307) → portrait generation throws at runtime. Fix = rewrite the handler to use the real `image-gen-driver.ts` (`generateImage` → `downloadImage`), mirroring the new `sceneApiManager.ts`. Preserve the auth/consent error hints.

### 4.3 Earlier-session fixes already landed (context)
Dev-menu z-index freeze, banter default-paused + dev toggle/indicator, "Party Member Banter"/"Party Chat" renames, opening-situation time/weather grounding, legacy-log→conversation-modal at entry, and the double Ollama-modal fix — all in the tree, all verified live earlier.

---

## 5. Working agreements (important, from memory)
- **Master only** — never create a branch or git worktree.
- **Never commit / never suggest committing** — the codebase auto-commits to GitHub at 2am. Leave work in the tree.
- **No fallbacks** — build one real path, fail honestly. (This feature honors it.)
- **Render-and-eyeball** every generation/visual slice; numeric goldens alone aren't proof.
- **Direction questions** go through the AskUserQuestion tool, not raw text.
- **No time estimates / no feasibility-shrinking** — full vision, priority order.
- Explain decisions in plain language (no code-identifier jargon in decision-facing summaries).

---

## 6. Quick commands
```bash
# feature tests
npx vitest run src/systems/gameEntry/ src/hooks/__tests__/useDeEscalation.test.ts src/components/gameEntry/
# feature typecheck (should print nothing)
npx tsc -b 2>&1 | grep -iE "deEscalation|resolveDeEscalationIntent|runDeEscalationCheck|SkillClarification|ConversationPanel|gameEntry/types|generateOpeningSituation|useDeEscalation"
```
(Full `tsc -b` has ~pre-existing unrelated errors — vite-plugin `tsconfig.node` include noise + spell-command test drift — not from this work.)
