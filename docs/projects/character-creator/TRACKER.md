# Character Creator Living Tracker

Status: active (G2 resolved 2026-06-08; no pending review hold — confirmed in the 2026-06-10 decision blitz housekeeping pass)
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create initial living-project scaffold for character-creator docs | codex-spark worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `docs/projects/character-creator/*` | Initial files now exist | Verified in docs set and scope-only constraint |
| T2 | done | Replace scaffold-only registry surface with implementation-grounded NORTH_STAR + align TRACKER/GAPS | codex-spark worker | 2026-05-31 | `src/components/CharacterCreator/CharacterCreator.tsx`; `src/components/CharacterCreator/state/characterCreatorState.ts`; `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Keep project docs synchronized with observed runtime structure and navigation behavior | Compare docs against live code and reducer tests |
| T3 | done | Decide sidebar navigation policy: permissive navigation with locked placeholders is intentional | codex-spark worker | 2026-06-08 | `src/components/CharacterCreator/CreationSidebar.tsx:84-85`, `src/components/CharacterCreator/CharacterCreator.tsx:386-400` | Permissive navigation with clear lock messaging is the intentional design; no code changes needed | Verified in code and existing tests; documented in NORTH_STAR.md
| T4 | not_started | Reconcile source documentation drift (README/feature notes vs implementation) | Worker B | 2026-05-31 | `src/components/CharacterCreator/CharacterCreator.README.md`, `docs/architecture/domains/character-creator.md`, `docs/tasks/feature-capabilities/character-creator.md` | Validate which document is canonical and adjust/update notes | Document evidence-backed source-of-truth and remaining diffs |
| T5 | not_started | Track and prioritize wizard/validation edge-case follow-up in project workflow | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Promote into local gap planning and close on implementation handoff | Confirm with registry evidence and product owner |
| T6 | done | 20-character full-flow UI audit (all 13 classes, 20 races, all 12 backgrounds) + gap registration G9–G17 | Claude (Remy session) | 2026-06-11 | `docs/projects/character-creator/GAPS.md` G9–G17 | Fixes for G9/G10/G11 landed and browser-verified; G12/G13 implemented pending proof runs | Re-walk a caster with Magic Initiate (G12) and a Beastborn Human (G13) |
| T7 | done | Flow fixes: sidebar order now mirrors actual traversal; feat screens titled per slot; disabled-confirm affordance + visible blocked-reason hint; human variants routed through Skillful/Racial Feat | Claude (Remy session) | 2026-06-11 | `config/sidebarSteps.ts`, `state/characterCreatorState.ts` (`isHumanLineage`), `FeatSelection.tsx`, `FeatSpellPicker.tsx`, `ui/CreationStepLayout.tsx`, `Race/RaceSelection.tsx`, `styles/buttonStyles.ts` | None — Human Fighter verified walking steps 1→13 strictly forward; creator vitest suite shows no new failures (4 pre-existing failures unchanged vs stashed baseline) | `npx vitest run src/components/CharacterCreator` |
| T8 | done | 20 premade characters generated through the creator's real assembly pipeline | Claude (Remy session) | 2026-06-11 | `scripts/premade/generatePremadeCharacters.ts`; 20 new `public/premade-characters/*.json` + `manifest.json` entries; `assemblePlayerCharacter` extracted as pure export from `useCharacterAssembly.ts` | Premades load via `premadeCharacterService` (verified by in-app fetch); next: surface in Party Editor / a future "start from premade" creator entry | Load one in Party Editor and start a game with it |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/character-creator/GAPS.md` | registry-to-scaffold upgrade | Finish wizard/validation edge cases | `docs/projects/PROJECT_TRACKER.md` (Feature/UI Projects row) | Keeps known unresolved edge behavior visible across handoffs | Move to execution task when feature scope is resumed | Concrete validation checklist before release |
| G2 | done | decision_recorded | codex-spark worker | `docs/projects/character-creator/GAPS.md` | docs enrichment | Sidebar navigation policy review | `src/components/CharacterCreator/CreationSidebar.tsx:84-85`, `src/components/CharacterCreator/CharacterCreator.tsx:386-400`, `src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx:7-24` | Decision recorded: permissive navigation with locked placeholders is intentional; no code changes required, only documentation alignment | G2 resolved, documented in NORTH_STAR.md | Code and test evidence verified 2026-06-08 |
| G3 | not_started | adjacent_follow_up | Worker B | `src/components/CharacterCreator/CharacterCreator.test.tsx` debt | docs enrichment | test file contains TODO lint-intent markers for unused imports | Signals technical debt and potential lint churn for future maintainers | Address in local code task, not this docs-only pass | CI lint check result or test clean-up PR |

## Update Rules

- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/character-creator/GAPS.md`.
- For cross-project or out-of-project artifacts, prefer routing to `docs/projects/GLOBAL_GAPS.md`.
