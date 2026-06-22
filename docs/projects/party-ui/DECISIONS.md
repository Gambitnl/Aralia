# Party UI Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/party-ui`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Roster acceptance rule for non-companion NPCs (G5)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Can party roster membership include non-companion NPC party entities, and if so, under what acceptance rule? (GAPS.md G5; NORTH_STAR "Next checks".)

Decision made:
Yes — the party roster MAY include non-companion NPCs, but only under an explicit acceptance rule. The acceptance rule must be defined as the first step of the implementation slice, covering the membership model, character-sheet context behavior for non-companion entries, and save/load semantics. Writing the rule unblocks G7 (companion data threading into `PartyOverlay`).

Rationale and evidence:
- The canonical companion/party boundary (separate identity spaces, best-effort id bridge) already tolerates non-companion party members; the missing piece is an explicit acceptance rule, not a structural change.
- Sequencing the rule first keeps G7 work verifiable against a written contract instead of an inferred one.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D15).

Follow-up:
Write the acceptance rule into NORTH_STAR as step one of the G5/G7 implementation slice, then proceed with G7.

### D3: Short Rest Modal Choice Flow Parity and Warning Placement Rules (G10/G4)

Date: 2026-06-22

Owner: Gemini 3.5 Flash

Decision made:
1. Wire the existing `RestModal` component into `GameModals.tsx` to handle short rests. This component displays the active party roster and allows the user to select and spend Hit Dice per character before confirming a rest. Toggling the modal is done via a new UI action type `TOGGLE_SHORT_REST_MODAL` (analogous to `TOGGLE_LONG_REST_MODAL`).
2. Establish a clear display hierarchy for missing character choices: full detailed warnings and interactive "Fix Choice" buttons are rendered on character cards (e.g. `PartyMemberCard`), while a summarized/high-level indicator is shown at the overlay level, and compact card variants (if added later) are restricted to minimal alert badges.

Rationale and evidence:
- Direct dispatching of `SHORT_REST` on the overlay bypassed the Hit Dice spending UI, making the UX inconsistent with long rests and violating D&D rules where rest recovery is a choice-driven budget.
- Clean display rules prevent visual clutter on smaller UI boundaries while ensuring the player is always notified of missing choices.

Follow-up:
Implement state, reducer, and modal wiring, update test coverage, and document the display rules in `NORTH_STAR.md`.

### D4: State/Save/Load Modularization Audit for Party & Rest (G6)

Date: 2026-06-22

Owner: Gemini 3.5 Flash (Medium)

Decision made / Audit Findings:
1. **Pipeline Pattern Preservation**: The root reducer in `src/state/appState.ts` utilizes a pipeline pattern where slice reducers are evaluated sequentially. Actions like `SHORT_REST` and `ADVANCE_TIME` affect both world state (`shortRestTracker`, weather, time) and character state (HP, abilities, spent hit dice). Any modularization of state/reducers (e.g. converting to standard slice-bound combined states) must ensure actions are routed losslessly across domains.
2. **Load & Save Backfill Logic**: The load handler `LOAD_GAME_SUCCESS` in `appState.ts` and the load path in `saveLoadService.ts` must retain their backfill rules for backward compatibility:
   - Reconstruct `shortRestTracker` if omitted in the save file.
   - Promote legacy single `playerCharacter` payloads into the `party` array.
3. **Data Normalization & Repair**: `saveLoadService.ts` normalizes class levels (`normalizeClassLevels`) and builds hit dice pools (`buildHitPointDicePools`) on game load. This data repair is critical; without it, the rest modals and character sheets will crash or error when loading legacy saves.
4. **Day-Tick Sync**: Short rest counts are reset on day transitions inside `worldReducer` (`ADVANCE_TIME` action). Any split separating game time from the short rest tracker must coordinate this day-tick boundary.

Rationale and evidence:
- Documenting these requirements resolves G6 (modularization audit) and safeguards party/rest UI stability during future refactoring.
- Source files: `src/state/appState.ts` (L551-567, L930-943), `src/services/saveLoadService.ts` (L377-405), and `src/state/reducers/worldReducer.ts` (L162-167, L218-228).

Follow-up:
Future state-split tasks (such as code-modularization-audit CMA-G10) must explicitly verify rest/party behavior using the dedicated regression tests: `npx vitest run src/components/Party/`, `GameModals.test.tsx`, and `RestModal.test.tsx`.

