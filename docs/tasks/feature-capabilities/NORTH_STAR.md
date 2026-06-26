# Feature Capabilities North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

`docs/tasks/feature-capabilities` is a reuse-scoped capability handoff that already
contains multiple live-feature notes. This project file preserves the current intent,
state, and handoff priorities so future agents can resume without rediscovering
implementation history.

## Purpose and Scope

This is a docs-only project surface. It maps capability ownership signals and
evidence-backed implementation status for:

- Character Creator
- Companion banter
- Merchant pricing and economy flow
- Voyage management
- URL and history sync
- Noble house generation

## File Map

| File | Purpose | Current relevance |
|---|---|---|
| `character-creator.md` | Capability summary for multi-step creator runtime | Implemented with partial UX decision gap |
| `companion-banter.md` | Capability summary for companion chat and ambient banter | Implemented with open UI/edge-case checks |
| `merchant-pricing-economy.md` | Pricing/math integration in merchant flow | Implemented at shared engine level |
| `voyage-management.md` | Voyage and naval reducer/state foundations | Partial, state-first, UI-loop less mature |
| `url-history-state-sync.md` | URL/history baseline synchronization | Implemented baseline hook path |
| `noble-house-generation.md` | House + intrigue foundations | Implemented generation/manager foundation |
| `TRACKER.md` | Active task queue + stale-state control | Defines current next actions |
| `GAPS.md` | Durable unresolved findings | Keeps in-project and adjacent uncertainty explicit |

## Implemented vs Planned State

| Capability | Status | Evidence anchor |
|---|---|---|
| Character Creator | implemented (partial) | `docs/tasks/feature-capabilities/character-creator.md` |
| Companion Banter | implemented (partial) | `docs/tasks/feature-capabilities/companion-banter.md` |
| Merchant Pricing | implemented (partial) | `docs/tasks/feature-capabilities/merchant-pricing-economy.md` |
| Voyage Management | partial | `docs/tasks/feature-capabilities/voyage-management.md` |
| URL History Sync | implemented | `docs/tasks/feature-capabilities/url-history-state-sync.md` |
| Noble House Generation | implemented foundation | `docs/tasks/feature-capabilities/noble-house-generation.md` |

## Owners and Acceptance Signals

- Character Creator references: `docs/projects/character-creator/{NORTH_STAR.md,TRACKER.md}`
  with owner marker `Worker B`.
- Companion references: `docs/projects/companions/{NORTH_STAR.md,TRACKER.md}`
  with owner marker `Worker A`.
- Merchant/economy references: `docs/projects/economy/NORTH_STAR.md`,
  `docs/projects/economy/TRACKER.md`, and `docs/projects/economy-ui/*`
  with owner marker `Economy docs owner` / `Economy UI docs owner`.

Acceptance signal for this folder pass:

- each listed capability must still reflect observed implementation state
- each unresolved point must be tracked in `GAPS.md` with owner and next proof
- tracker rows should keep owner/date/evidence/next check for continuation

## Integrations

- Character Creator touches `src/components/CharacterCreator/*` and is tied to broader
  sheet/character references.
- Companion banter depends on `src/hooks/useCompanionBanter.ts` and `src/systems/companions/*`
  and maps to companion project docs.
- Merchant pricing is owned by shared economy math (`src/utils/economy/economyUtils.ts`)
  and Trade UI runtime (`src/components/Trade/MerchantModal.tsx`).
- Voyage management maps to `src/state/reducers/navalReducer.ts` and `src/systems/naval/VoyageManager.ts`.
- URL sync maps to `src/hooks/useHistorySync.ts`.
- Noble house generation maps to `src/utils/world/nobleHouseGenerator.ts` and
  `src/systems/world/NobleIntrigueManager.ts`.
- Registry link: `docs/projects/PROJECT_TRACKER.md` row "Feature Capabilities".

## Active Task

| Field | Value |
|---|---|
| Task | Convert this folder into a compact cold-start map with capability status, ownership signals, integration links, and explicit gaps. |
| Allowed boundary | `F:\Repos\Aralia\docs\tasks\feature-capabilities` only; source files used as evidence only. |
| Stop condition | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` are internally consistent and explicit for cold-start handoff. |
| Owner | Worker D |
| Next action | Continue by clearing active gaps as next checks are verified. |

## Gaps and Uncertainties

- Character Creator has completion checks but non-sequential sidebar navigation behavior; product intent must be explicit.
- Companion banter behavior is implemented at hook/state level; full in-game timing and presentation proof is not fully captured in this pass.
- Merchant pricing is integrated in shared math and MerchantModal, but currency/action-level acceptance still depends on economy/economy-ui follow-through.
- Voyage Management foundations are present, but player-facing voyage orchestration checks are still incomplete.
- URL sync currently has verified hook-level behavior; rendered transition assertions are still open.

## Next Checks

1. Verify owner markers in project-level trackers remain current.
2. Keep evidence links and classification updates in `TRACKER.md` and `GAPS.md`.
3. Route unresolved scope questions to the owning project tracker before implementation decisions expand this folder.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/feature-capabilities/NORTH_STAR.md","sha256WithoutMarker":"207924632a39ce580dc85165426c6dd24270083594065d865184b9c44b55ef5b","markedAtUtc":"2026-06-25T22:29:38.606Z"} -->
