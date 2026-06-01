# GAPS: Gemini Service

Status: active  
Last updated: 2026-05-31

## Gap Log

| ID | Classification | Gap | Source | Owner | Next action | Next proof/check |
|---|---|---|---|---|---|---|
| G1 | support_needed_now | Cost and quota control are implicit. There is no service-level cost accounting, token budget tracking, or spend guard policy tied to request outcomes. | `src/services/gemini/core.ts`, `src/services/gemini/items.ts`, `docs/projects/PROJECT_TRACKER.md` | Service owner | Define and document a cost/error budget policy before any tuning cycle | Add a policy doc + test for budget-safe fallback behavior |
| G2 | in_scope_now | Encounter generation path does not use the same backoff and tracking semantics as `generateText` (rapid model fallback attempts, duplicated timestamp usage). | `src/services/gemini/encounters.ts` | Service owner | Align encounter fallback flow with shared cooldown and delay behavior | Re-run focused Gemini tests after normalization |
| G3 | adjacent_follow_up | `src/services/geminiService.ts` contains unresolved TODO debt on model selection and duplicated imports/facade naming clarity. | `src/services/geminiService.ts` | Service owner | Clean naming or document why dual imports remain before next reliability refactor | Code review pass and lint/type check of changed exports/imports |
| G4 | adjacent_follow_up | Full prompt strategy is distributed across handlers with no central policy document, making behavior drift harder to audit. | `src/services/gemini/core.ts`, `src/services/gemini/encounters.ts`, `src/services/gemini/items.ts`, `src/services/geminiService.README.md` | Service owner | Keep function-level prompt intents but add one central prompt ownership matrix | Add/refresh a prompt matrix doc when strategy changes |
| G5 | support_needed_now | `geminiService.README.md` describes adaptive/complex model behavior more than current implementation indicates. | `src/services/geminiService.README.md` | Docs owner | Update stale narrative and keep claims aligned to code | Reconcile README claims with observed call paths |

## Global Routing

- No cross-project global gaps identified in this pass.
- No rows moved to `docs/projects/GLOBAL_GAPS.md` because all discovered gaps are contained in Gemini service continuity.
