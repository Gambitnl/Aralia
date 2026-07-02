# Game Entry Situation Gaps

Status: active
Last updated: 2026-07-01

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | game-entry owner | Game entry live verification | backlog retirement pass; widened 2026-07-01 | Full in-browser click-through from New Game through character wizard, generated conversation, typed reply, and live response still needs owner-eyeball proof. Widened 2026-07-01: the click-through must also cover the 2026-06-29 combat-oriented-opening additions — a hostile opening resolving into tactical combat via free-text reply → LLM intent → dice skill check (de-escalation modules `src/systems/gameEntry/deEscalationToCombat.ts`, `resolveDeEscalationIntent.ts`, `runDeEscalationCheck.ts`; `src/hooks/useDeEscalation.ts`; `src/components/gameEntry/SkillClarificationPane.tsx`). The castable-buff-offer wiring is still pending. | `REPORT.md`; `TRACKER.md`; retired `BRIEF-GAME-ENTRY-SITUATION.md` verification checklist; 2026-06-29 combat-opening slice in `TRACKER.md` | Headless/live-model proofs exist (51 tests green for the combat-opening work as of 2026-06-29), but the owner-facing end-to-end browser path — including a hostile opening resolving into combat — is the final confidence check for this feature. | Run one real browser click-through with Ollama running: capture the generated conversation plus one reply/response, and one hostile opening that resolves through the de-escalation skill check into combat. | Screenshot or text proof stored in `.agent/scratch/` or another ignored proof path and summarized in `REPORT.md`. |
| G2 | done | adjacent_follow_up | game-entry owner | Ollama narrative profile | backlog retirement pass | The `opening_situation` profile's `PROSE_MODELS` list did not explicitly include `gemma4`, even though the router falls back to the installed model. | `TRACKER.md`; `src/services/ollama/taskProfiles.ts`; `src/types/ollama.ts`; `ollama list` showed `gemma4:12b` installed | A standard narrative model preference list makes local setup intent clearer and reduces surprise when model routing changes. | Closed 2026-06-25: added `gemma4:12b` to the prose model preference list used by `opening_situation`. | `src/services/ollama/taskProfiles.ts` now lists `gemma4:12b` after qwen prose options. |

## Retired Brief

`BRIEF-GAME-ENTRY-SITUATION.md` was an executor directive with verification checkboxes. The feature is implemented and the remaining follow-ups now live in this gap file.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/game-entry-situation/GAPS.md","sha256WithoutMarker":"e740912ca07bd5b3f94a7b4663909cd1e7e3f21a9175d89ab2630dcb2a8921c0","markedAtUtc":"2026-06-25T22:29:38.626Z"} -->
