# Game Entry Situation Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | game-entry owner | Game entry live verification | backlog retirement pass | Full in-browser click-through from New Game through character wizard, generated conversation, typed reply, and live response still needs owner-eyeball proof. | `REPORT.md`; `TRACKER.md`; retired `BRIEF-GAME-ENTRY-SITUATION.md` verification checklist | Headless/live-model proofs exist, but the owner-facing end-to-end browser path is the final confidence check for this feature. | Run one real browser click-through with Ollama running and capture the generated conversation plus one reply/response. | Screenshot or text proof stored in `.agent/scratch/` or another ignored proof path and summarized in `REPORT.md`. |
| G2 | done | adjacent_follow_up | game-entry owner | Ollama narrative profile | backlog retirement pass | The `opening_situation` profile's `PROSE_MODELS` list did not explicitly include `gemma4`, even though the router falls back to the installed model. | `TRACKER.md`; `src/services/ollama/taskProfiles.ts`; `src/types/ollama.ts`; `ollama list` showed `gemma4:12b` installed | A standard narrative model preference list makes local setup intent clearer and reduces surprise when model routing changes. | Closed 2026-06-25: added `gemma4:12b` to the prose model preference list used by `opening_situation`. | `src/services/ollama/taskProfiles.ts` now lists `gemma4:12b` after qwen prose options. |

## Retired Brief

`BRIEF-GAME-ENTRY-SITUATION.md` was an executor directive with verification checkboxes. The feature is implemented and the remaining follow-ups now live in this gap file.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/game-entry-situation/GAPS.md","sha256WithoutMarker":"e740912ca07bd5b3f94a7b4663909cd1e7e3f21a9175d89ab2630dcb2a8921c0","markedAtUtc":"2026-06-25T22:29:38.626Z"} -->
