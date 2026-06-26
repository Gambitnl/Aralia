# Package 5: AI Arbitration Pilot

Status: historical Package 5 packet; PR #991 merged on 2026-05-24.

This is the durable Aralia-facing task packet for Spell Phase 1 Package 5. The
goal is to prove that open-ended early-game spells can ask for player intent,
route through the AI arbitration layer, fail safely when AI is unavailable, and
produce visible combat/simulator feedback without pretending that every spell is
deterministic.

Symphony draft ids, click receipts, generated manifests, local run state, and
dashboard retry state are not part of this packet. Keep those in the external
or ignored Symphony layer unless a small excerpt is needed to explain an Aralia
decision here.

## Worker

Default worker: Jules.

Codex role: foreman only. Codex owns the scope, prompt, review, verification,
decision reporting, and tracker maintenance. Jules should own the implementation
work once the dashboard can launch the task.

## Why This Slice Exists

Package 4 proved a deterministic combat spell path for representative
cantrip/level 1-3 spells. Package 5 should prove the opposite boundary: spells
whose result depends on free-form player intent should expose the player-input
and AI-arbitration path instead of silently doing nothing, flattening into a
generic `UTILITY` effect, or being marked mechanical only because that is easier
to test.

The current scoped spell data shows only three level 0-3 spells with
non-mechanical arbitration:

| Spell | Level | Current arbitration | Notes |
|---|---:|---|---|
| `prestidigitation` | 0 | `ai_dm` | `aiContext.prompt` is empty and `playerInputRequired` is false, despite the spell needing player intent. |
| `suggestion` | 2 | `ai_dm` | `aiContext.prompt` is empty and `playerInputRequired` is false, despite the spell depending on the suggested wording. |
| `blindness-deafness` | 2 | `ai_assisted` | Mostly deterministic; keep as a regression/control case for the assisted validation path, not the main open-ended pilot. |

The data also has many likely open-ended or interpretation-heavy spells still
marked `mechanical`, including `minor-illusion`, `disguise-self`, `message`,
`speak-with-animals`, `detect-thoughts`, `phantasmal-force`, and `major-image`.
Do not route that whole family in Package 5. Use one or two pilot spells and
record the rest as follow-up candidates.

## Pilot Spell Set

Use this order:

1. `prestidigitation`
   - cantrip, low-risk, already marked `ai_dm`
   - should require a short player description
   - should produce a narrative combat/simulator log outcome when the AI allows
     it
2. `suggestion`
   - level 2, already marked `ai_dm`
   - should require the exact suggested wording
   - should keep the deterministic save/charmed/ending behavior honest while
     using AI only to judge whether the wording is legal and plausible
3. Optional control case: `blindness-deafness`
   - keep or tighten its `ai_assisted` path only if this is needed to prove the
     assisted validation branch
4. Follow-up only, not required in this slice: `minor-illusion` or
   `disguise-self`
   - record what would make them good next AI-routing candidates
   - do not broaden Package 5 into an illusion policy rewrite

## Existing Surfaces To Reuse

- `src/components/BattleMap/AISpellInputModal.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/systems/spells/ai/AISpellArbitrator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts`
- `src/hooks/useAbilitySystem.ts`
- `src/hooks/__tests__/useAbilitySystem.package4.test.tsx`
- `src/utils/character/spellAbilityFactory.ts`
- `src/utils/securityUtils.ts`
- `public/data/spells/level-0/prestidigitation.json`
- `public/data/spells/level-2/suggestion.json`
- `public/data/spells/level-2/blindness-deafness.json`

## Allowed Write Scope

Jules may edit:

- `public/data/spells/level-0/prestidigitation.json`
- `public/data/spells/level-2/suggestion.json`
- `public/data/spells/level-2/blindness-deafness.json`, only if a focused
  assisted-arbitration regression requires it
- `src/components/BattleMap/AISpellInputModal.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/systems/spells/ai/AISpellArbitrator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest focused tests under `src/commands/**/__tests__/`,
  `src/hooks/**/__tests__/`, or `src/components/**/__tests__/`

Jules should not edit:

- broad AI policy for every illusion/social/utility spell
- deterministic damage, healing, saves, targeting, concentration, slots, or
  action-cost behavior except to preserve existing behavior while the AI path
  is tested
- character creator spell choice UI
- character sheet spellbook UI
- premade roster semantics
- Symphony runtime/source files, manifests, receipts, click logs, or local state
- level 4-9 spell behavior

## Required Work

1. Give `prestidigitation` and `suggestion` meaningful `aiContext.prompt`
   values.
2. Set `playerInputRequired` honestly for any spell that cannot be adjudicated
   without the player's described intent.
3. Prove the combat/simulator flow opens the player input modal for an
   `ai_dm` spell that requires input.
4. Prove invalid or suspicious player input is rejected before reaching the AI
   arbitrator.
5. Prove the AI-unavailable path is visible and safe. It should not silently
   spend the action/slot as if the spell succeeded.
6. Prove an allowed AI result can create a narrative command and, when provided,
   mechanical effects through `SpellCommandFactory`.
7. Keep deterministic spell behavior from Package 4 green.
8. Regenerate spell validation/gate checks and record whether the gate report
   changes meaningfully. Do not commit timestamp-only churn.
9. Record follow-up candidates for additional AI-routed spells without
   widening this pilot.

## Verification Commands

Run the narrowest useful checks first:

```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts --reporter=verbose
```

If Jules adds hook or component coverage for the modal/input path, include the
new test file in the completion report. If spell data changes only produce
timestamp churn in `public/data/spell_gate_report.json`, restore that file and
record the timestamp-only result.

## Acceptance Criteria

- `prestidigitation` has a meaningful AI DM prompt and requires player input.
- `suggestion` has a meaningful AI DM prompt and requires the suggested wording.
- At least one test proves the AI command factory path creates a narrative
  outcome and handles returned mechanical effects.
- At least one test or rendered proof covers the player input modal or the
  simulator-facing input request path.
- AI service failure or disallowed arbitration is visible and does not masquerade
  as a successful deterministic spell.
- Package 4 deterministic proof stays green or any regression is fixed inside
  the smallest relevant runtime surface.
- Follow-up AI-routing candidates are recorded separately instead of absorbed
  into this pilot.

## Current Dashboard Boundary

The original visible dashboard at `http://127.0.0.1:8139/` is blocked by the
main checkout Git sync gate because `F:\Repos\Aralia` is on
`codex/spell-phase1-closeout-docs`, not `master`. The non-mutating dashboard
disposition decision is to keep local-only commits local and integrate
remote-only commits after local work is safe.

On 2026-05-24, a second dashboard was started from the clean worktree
`F:\Repos\Aralia\.worktrees\spell-phase1-master-sync` on port `8140`. Its Git
gate passed from branch `codex/spell-phase1-master-sync` because that branch is
exactly at `origin/master` with a clean working tree. This proves the
clean-worktree stand-in route without mutating the user's main checkout.

The Package 5 dashboard draft now exists as `draft-1779582701882-mln8to`, and
the visible `Create Linear Issue` control linked it to Linear issue `ARA-11`:

- `https://linear.app/aralia/issue/ARA-11/spell-phase-1-package-5-ai-arbitration-pilot`

PR #987 repaired the first visible-action blocker by adding a current-boundary
action to the standalone task page. PR #989 made that action form-backed so the
visible page still owns the POST action if the enhanced dashboard script does
not attach.

The activation blocker was later reclassified. A visible browser click on the
task-page `Prepare Handoff` button did send `POST /promote` and returned 201,
but the page stayed on the historical draft while new handoffs appeared in the
queue. That made the action look blocked and also allowed duplicate Package 5
handoffs. The clean handoff used for the actual Package 5 run is
`handoff-1779586889329-3ehcfd`; older Package 5 handoffs from repeated clicks
should be treated as stale dashboard state unless explicitly revived.

Package 5 then launched Jules session `16180069342192211468`. The dashboard
successfully staged the manifest, launched Jules, surfaced the plan-approval
gate, and recorded the approval. A follow-up dashboard defect appeared after
approval: Symphony still showed `Approve Jules Plan` from cached
`AWAITING_PLAN_APPROVAL` state even though the approval receipt had succeeded.
The local repair changes that stale post-approval boundary to `Refresh Jules
Status`, and `npm run build` plus `node scripts/verify-task-detail-page.mjs`
passed for the repair.

Jules produced PR #991:

- `https://github.com/Gambitnl/Aralia/pull/991`

PR #991 merged on 2026-05-24 after:

- Jules implemented AI/player-input prompts for `prestidigitation` and
  `suggestion`
- Codex posted bounded `[Jules feedback]` when the PR included generated
  `spell_gate_report.json` timestamp churn and an inaccurate PR body claim
- Codex removed generated gate-report churn, reverted an out-of-scope
  `.github/workflows/gemini-review.yml` edit Jules pushed after feedback, and
  fixed JSON file endings
- GitHub Build, Lint, Tests, Quality Scan, CodeQL, Poison File Check, and
  Analyze checks all passed

## Decision Points

| Decision | What it entailed | Agent decision | Artifact classification |
|---|---|---|---|
| P5-1 Dashboard blocked by dirty main checkout | The dashboard cannot launch a new Jules task while the main checkout has local commits, tracked edits, untracked files, and remote-only commits. | Do not mutate or sync the user's main checkout from this task; continue only with an Aralia-facing task packet in a clean worktree. | Dashboard state plus external/local Git workflow; summarized here because it blocks Jules dispatch. |
| P5-2 Pilot breadth | Package 5 could route many illusion/social/utility spells, but that would create broad AI policy churn. | Scope the pilot to `prestidigitation` and `suggestion`, with `blindness-deafness` only as an optional assisted-control case. | Aralia GitHub task packet. |
| P5-3 Symphony artifact boundary | The task needs Jules-readable context but not Symphony runtime state. | Commit only this task packet and prompt; keep Symphony manifests, draft ids, receipts, and click state external or ignored. | Aralia GitHub for packet/prompt; external Symphony for runtime state. |
| P5-4 Deterministic-vs-AI boundary | AI arbitration could hide missing deterministic mechanics. | Use AI only for player intent/adjudication. Do not route damage, healing, clear saves, slots, action costs, or concentration cleanup to AI. | Aralia GitHub task packet; future mechanics buckets for deterministic gaps. |
| P5-5 Clean-dashboard stand-in | The main dashboard was blocked by the user's divergent main checkout, but the clean worktree matches `origin/master`. | Start and use the dashboard from the clean worktree on port `8140`; treat it as a valid dashboard route because the visible Git gate reports ready without mutating main. | Dashboard state plus local ignored Symphony runtime; summarized here because it unblocks the Git side of Package 5 dispatch. |
| P5-6 Visible draft form input | The dashboard has a visible Package 5 draft form, but the in-app browser cannot type into the form due to the missing Browser Use virtual clipboard. | Do not bypass with hidden POST endpoints. Record the blocker and resume when visible form input is repaired or manually filled by the operator. | Dashboard/browser tooling blocker; Aralia GitHub summary because it blocks Jules dispatch. |
| P5-7 Linear issue creation | The clean dashboard exposed an enabled visible `Create Linear Issue` button for Package 5 after the draft existed. This mutates Linear and attaches a tracking issue to the draft. | Use the visible dashboard button under the previously authorized Jules/Symphony test flow. Result: Package 5 linked to `ARA-11`. | Linear/dashboard state; summarized here because it advances Jules dispatch. |
| P5-8 Prepare handoff visibility | The task page says `Prepare Handoff` is the current boundary, but renders no visible action button. The full dashboard has `Prepare Handoff` buttons in the DOM, but the relevant Package 5 button is not reachable by ordinary viewport scrolling. | Do not call the raw promote endpoint and do not programmatically click an unreachable DOM node. Record the blocker as a dashboard UX/workflow defect. | Dashboard workflow blocker; Aralia GitHub summary because it blocks Jules dispatch. |
| P5-9 Task-page boundary action repair | The visible task page needs to expose the current boundary action directly. This required editing Symphony source even though Symphony source should eventually leave the Aralia repo. | Repair the current in-repo Symphony dashboard source through PR #987 because it is the active workflow infrastructure, and explicitly classify it as a Symphony workflow-defect repair rather than spell implementation content. | Temporary Symphony source repair in Aralia GitHub; should migrate with Symphony when separated. |
| P5-10 Form-backed activation repair | The new visible button still needed a non-script fallback so the page action remained usable if dashboard JavaScript did not attach. | Land PR #989 to make the `Prepare Handoff` control a normal visible POST form while keeping the enhanced guarded handler as the preferred path. | Temporary Symphony source repair in Aralia GitHub; should migrate with Symphony when separated. |
| P5-11 Visible activation reclassified | The task-page button looked blocked because the draft page stayed historical, but a visible browser click did submit and create handoffs. | Use the newest clean handoff `handoff-1779586889329-3ehcfd`; treat older duplicate handoffs as stale dashboard state. | Dashboard state/focus defect; summarized here because it affects Jules dispatch traceability. |
| P5-12 Jules plan approval | Jules session `16180069342192211468` presented a bounded plan for `prestidigitation`, `suggestion`, optional `blindness-deafness`, validation, and PR submission. | Approve the plan through the visible dashboard/Jules flow because it stayed inside Package 5 scope. | Jules/dashboard external state; approval receipt stored by Symphony. |
| P5-13 Post-approval stale boundary | After approval succeeded, the dashboard still offered `Approve Jules Plan` because cached Jules state remained `AWAITING_PLAN_APPROVAL`. | Repair Symphony so an approved receipt routes to `Refresh Jules Status`, avoiding duplicate mutating approval attempts. | Temporary Symphony source repair in Aralia GitHub; should migrate with Symphony when separated. |
| P5-14 PR #991 scope cleanup | Jules produced the implementation PR but included generated report churn and briefly pushed a workflow-config change after feedback. | Keep the implementation, remove generated/workflow churn, correct the PR body, and merge once checks are green. | Aralia GitHub implementation PR plus Codex foreman cleanup; Symphony runtime state remains external/local. |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_5_AI_ARBITRATION_PILOT.md","sha256WithoutMarker":"411ac530d01576d496b6f5b3473238fe71ffdeb3a076b83fa1a5ba717375438c","markedAtUtc":"2026-06-25T22:29:38.361Z"} -->
