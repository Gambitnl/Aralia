# Feature Capabilities Living Tracker

Status: active
Last updated: 2026-05-31

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
| T1 | done | Establish this folder as a compact feature-capabilities handoff surface | Worker D | 2026-05-31 | `docs/tasks/feature-capabilities/*.md`; `docs/projects/PROJECT_TRACKER.md` | Keep tracker and gap rows current while evidence is preserved | Verify `NORTH_STAR.md` maps all six capability notes |
| T2 | active | Align capability owners and implementation state across direct references | Feature Capabilities docs owner | 2026-05-31 | `docs/tasks/feature-capabilities/*.md`; `docs/projects/character-creator/*`; `docs/projects/companions/*`; `docs/projects/economy/*` | Add owner-aware states and next-check guidance in this folder | Confirm next-check rows cover character-creator/companions/merchant uncertainties |
| T3 | active | Register durable unresolved gaps and next checks | Feature Capabilities docs owner | 2026-05-31 | `docs/tasks/feature-capabilities/GAPS.md` | Keep only in-project gaps here and route overflow to `docs/projects/GLOBAL_GAPS.md` | Review each row for owner, evidence, and proof condition |

## Gap Log (in this folder)

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | blocked_human_decision | Worker B | `docs/projects/character-creator/TRACKER.md` | capability map update | Clarify whether Character Creator should enforce strict step locking or keep permissive sidebar navigation | `docs/tasks/feature-capabilities/character-creator.md`, `docs/projects/character-creator/NORTH_STAR.md`, `src/components/CharacterCreator/CreationSidebar.tsx`, `src/components/CharacterCreator/config/sidebarSteps.ts` | Current note says completion checks exist but navigation is not fully sequenced | Decide product intent and update both capability and project docs | Re-run capability verification after decision |
| G2 | active | support_needed_now | Economy docs owner | `docs/projects/economy/TRACKER.md` | capability map update | Merchant pricing note should reference whether exchange/rule audit acceptance is complete in the economy project | `docs/tasks/feature-capabilities/merchant-pricing-economy.md`, `docs/projects/economy/NORTH_STAR.md`, `src/utils/economy/economyUtils.ts` | Pricing works but cross-project acceptance may lag behind this folder | Coordinate with economy/economy-ui trackers and align acceptance wording | Confirm `docs/projects/economy/GAPS.md` rows cover outstanding audit proof |
| G3 | active | adjacent_follow_up | Worker A | `docs/projects/companions/TRACKER.md` | capability map update | Decide if companion banter UI saturation requires additional evidence row in companions project docs | `docs/tasks/feature-capabilities/companion-banter.md`, `src/hooks/useCompanionBanter.ts`, `src/components/ui/CollapsibleBanterPanel.tsx` | Capability appears implemented, but UI cadence is not fully covered here | Add short evidence pointer to companion project tracker if UI saturation is accepted | Run/render-path check only if product scope expands |
| G4 | active | adjacent_follow_up | Worker D | `docs/tasks/feature-capabilities/voyage-management.md` | capability map update | Voyage Management lacks a confirmed end-to-end player-facing loop | `docs/tasks/feature-capabilities/voyage-management.md` | Reduces reliability of capability acceptance if treated as complete | Keep as partial in this folder; do not reclassify to done without UI proof | Add concrete end-state check before closing this gap |
