# Worldsim Service Decisions

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
- Project folder: `docs/projects/worldsim-service`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: WSS-005 feature source of truth — Azgaar is canonical

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The WSS-005 Required Review Brief asked which feature source is canonical for 2D atlas features and 3D `WorldData` features, given that `azgaarWorld.rivers` and `runWorldSim` `traceRivers` diverge for a fixed seed (`featureSourceTruth.test.ts`).

Decision made:
**Azgaar is canonical.** Azgaar feature hints flow into `WorldData`; 3D and gameplay features follow the atlas. The proc-gen pipeline derives deterministically from Azgaar output. (Option A from the brief: consume Azgaar feature hints into `WorldData`.)

Rationale and evidence:
- This decision was made in the context of the June 2026 proc-gen campaign (2026-06-10 → 2026-06-22): a unified procedural world pipeline with Azgaar-based generation extended below Azgaar's deepest zoom to replace the Submap, continuing into a 3D ground-level mode, owned town generation, 3D enterable towns, and an entity generation pipeline. The master record's Context section explains the campaign.
- Making Azgaar the single canonical source keeps the entire pipeline (atlas → submap replacement → 3D → towns/entities) derived from one deterministic origin.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D1).
- Brief and gap: `docs/projects/worldsim-service/NORTH_STAR.md` Required Review Brief; `docs/projects/worldsim-service/GAPS.md` WSS-005/WSS-005a.

Follow-up:
Implement the WSS-005a bridge spec (shared feature encoding carrying Azgaar feature hints into `WorldData`, with a legacy-save migration path), then add a fixed-seed acceptance check proving atlas and 3D consume the same canonical features. T7 in `TRACKER.md` reopens as the implementation lane.
