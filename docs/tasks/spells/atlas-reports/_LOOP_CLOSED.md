# Atlas dispatch loop - closed (V3)

> **Round closed: 2026-04-29.** All 13 buckets accounted for. The Atlas
> model has converged - no new gaps came back from V3, and the only
> "not ready" call was about source-state truth (Structured Markdown's
> 47 stubs reopening) rather than modeling. The Atlas now exits
> iteration mode and resumes its passive role: a dashboard that
> records work-status and progression as bucket agents do the actual
> canonical → structured → JSON migration toward the single JSON
> template end state.
>
> **Do not file `v4.md` reports unless a new dispatch round is
> announced.** This folder is now the historical audit trail of how
> the model converged across V1, V2, V3.

## Per-bucket V3 outcome

| Bucket | V3 status | Notes |
| --- | --- | --- |
| Casting Time | Ready | |
| Classes | Ready | |
| Components | Ready | |
| Conditions | Ready | |
| Description | Ready | Gap 09 example: dashboard 51/34 vs map 89/38 |
| Duration | Ready | |
| Higher Levels | Ready | |
| Material Component | Ready (carried from V2) | Orchestrator-authored v3.md; agent did not re-engage |
| Range/Area | Ready | Has illustrative-mock seed segments on `wrong range origin` |
| Sub-Classes | Ready | Fixed orchestrator-seeded roster on `incomplete_structured_subclasses` |
| Summoned Entities | Ready | |
| Attack-Roll Riders | Ready (first-time) | |
| Structured Markdown | **Not ready** | Bucket reopened: 47 stubs returned in source files; bucket work resumes |

## Quick handoff (paste to any returning agent)

> **The V3 round closed; your bucket is `ready` (or `not ready` for
> Structured Markdown).** The Atlas modeling iteration is done.
> Switch back to actual bucket work — the canonical → structured →
> JSON migration described in your tracker doc.
>
> Atlas use going forward is **passive dashboard, not iteration**:
>
> - Bump `lastUpdated` on your `BUCKET_META` row whenever you touch
>   your bucket.
> - Append a `history` snapshot when a count changes.
> - Flip an edge case or subbucket to `done` when it closes.
> - Replace chip-only `SpellRef` entries with full segments +
>   comparisons as you locate the lines (or just leave them
>   chip-only if the lines aren't worth pinpointing yet).
> - If something genuinely doesn't fit the model, append a new gap
>   to `ATLAS_GAPS_REGISTRY.md` and ping the orchestrator — the
>   loop can re-open if needed.
>
> **Do not file a `v4.md`.** The `atlas-reports/<bucket>/` folder is
> now the historical audit trail. New rounds will be announced
> explicitly.
>
> Pick up the `active` subbucket your execution map shows and
> resume.

## Bucket-specific addenda

Attach the relevant block to the agent dispatch.

### Structured Markdown

> Your V3 report reopened the bucket. Treat that as your active task:
> patch the 47 canonical-only stubs that re-emerged. The dashboard
> will flip back to `closed` when the marker scan returns to 0.

### Sub-Classes

> Your active subbucket is `Sub-Classes:missing_structured_subclasses`.
> Resume there. Your V3 fix to the seeded `incomplete_structured_subclasses`
> roster is appreciated — that 24-spell list now matches the tracker.

### Range/Area

> Note the illustrative-mock comment on
> `canonical_subbucket_refresh:b (wrong range origin)`. The 5 spells
> listed there are real Range/Area spells but their categorization to
> that specific edge case + the segment file paths/lines/content are
> not authoritative. When you author this edge case for real, replace
> them with real segments from the tracker. `word-of-radiance` should
> be removed (it is not in your tracker at all).

### Description

> Your dashboard count drift (51/34 vs 89/38) is a Gap 09 manual-sync
> example, not a Description-specific issue. If you can sync the
> dashboard counts to match the generated subbucket artifacts when you
> next touch the bucket, that resolves the visible drift on your row.

### Material Component

> An orchestrator-authored `v3.md` was filed on your behalf carrying
> forward the V2 "ready" state. Your `lastUpdated` is intentionally
> unbumped so the dashboard renders your row stale until you next
> engage. Bump it when you do.

## Post-close bucket addition (2026-04-30) - School

A 14th bucket was added to `BUCKET_META` after the V3 loop closed:
**School**, tracking School-field consistency across the
canonical → structured → JSON migration. The field appears in 412
structured-md files per `spell_audit_coverage.json`; canonical and
structured-JSON audit lanes already exist, but the parity script
itself does not yet (`parityScript: false`).

The bucket is currently in pre-work state:

- `kind: 'parity'`, both gates `'todo'` (parity scripts pending).
- Phase 1 has one `active` placeholder step:
  `land_school_canonical_parity_script`. Replace with real subbuckets
  once the parity script lands and an inventory pass runs.
- Phase 2 has a parallel `queued` placeholder for the runtime side,
  blocked behind Phase 1 per the Gap 15 rule.
- A stub tracker doc lives at
  `docs/tasks/spells/school/SPELL_SCHOOL_BUCKET_TRACKER.md`; populate
  it as work progresses.
- Slug for the report folder: `school` (added to the slug table in
  `atlas-reports/README.md`).

Because the V3 dispatch loop is closed, **the School bucket needs a
fresh dispatch when you're ready to engage it**. There is no v3.md for
School (the bucket didn't exist during V3). The first report this
bucket files will live at `atlas-reports/school/v4.md` (or whatever
round-version is current when the dispatch runs).

## Post-close policy update (2026-04-29) - Gap 15

**Phase 2 and Phase 3 are blocked until Phase 1 is complete.** This
landed after the V3 loop closed but is enforced going forward across
all buckets:

- The execution-map view dims later phases at `opacity-60` with a
  rose `blocked: phase 1 incomplete` chip on the phase header
  whenever any Phase 1 step in that bucket is still `queued` or
  `active`.
- The rule is sequential by design - the canonical → structured →
  JSON migration cannot meaningfully run a structured → JSON parity
  check while structured itself is still being shaped from canonical.
- **Don't set Phase 2/3 steps to `status: 'active'` while their
  Phase 1 is incomplete.** Authoring queued Phase 2/3 steps is fine
  (you can plan ahead); flipping one to active before Phase 1 closes
  is the violation.
- Vacuously unblocked when `phase1Gate === 'n/a'` (mechanics-model
  buckets like Conditions and Attack-Roll Riders) or when the Phase 1
  block has no steps authored.

If your bucket currently has Phase 2 or Phase 3 steps marked
`active` while Phase 1 has open work, the Atlas will now visibly
flag that as blocked. Either complete Phase 1 first, or move those
Phase 2/3 steps back to `queued` until Phase 1 closes.

## Loop history

- **V1**: initial seed dispatch. Surfaced 11 gaps (01-11).
- **V2**: gaps 01-08, 10, 11 resolved; Gap 09 stayed open. Round
  surfaced gaps 12, 13, 14.
- **V3**: gaps 12, 13, 14 resolved. Zero new gaps. Loop closed.
- **Post-V3 policy** (2026-04-29): Gap 15 (phase-block rule) filed
  and resolved by orchestrator policy.

Only **Gap 09** (no automated drift check between tracker docs and
Atlas maps) remains open. It is structural rather than blocking;
authors are responsible for manual sync until a CI parser exists.
