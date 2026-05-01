# Atlas v3 - Bucket Agent Prompt

> **Send this to every bucket-working agent.** It explains what changed
> since the V2 round, asks them to re-verify their bucket against the
> refined model, and tells them how to feed back gaps that still don't
> fit.

You filed a `v2.md` report in `docs/tasks/spells/atlas-reports/<bucket>/`
last round. The orchestrator read every report, consolidated the
feedback, and shipped fixes. Three new gaps moved straight to "Accepted
/ resolved" between rounds (12, 13, 14). Open the Atlas, expand the
Onboarding panel on the Dashboard, and re-read the gap registry first -
**only Gap 09 (no automated drift check) is still open**.

Then come back here.

## Special note for first-time agents

Three buckets didn't file a v2 report (`Components`, `Attack-Roll
Riders`, `Structured Markdown`). If you're the agent for one of those
buckets, **ignore the "what's new since your v2 round" framing below**
and read this whole prompt as your introduction. Your `lastUpdated`
field on `BUCKET_META` is currently the seeded `2026-04-26T12:00Z`,
which means your row is rendering rose-stale on the dashboard - bumping
it is one of the simplest signals that you've started.

You'll file directly to `v3.md` (no `v2.md` predecessor), which is fine
- the audit trail just starts at v3 for your bucket.

## What's new since v2

### Gap 12 resolved - `count: null` in `ProgressSnapshot`

`ProgressSnapshot.count` is now `number | null`. A `null` snapshot
renders as a gray italicized "?" bubble with a `pending recount`
tooltip; deltas to/from a null neighbor are skipped. Use it when an
edge case has `count: '? spells'` but you still want to anchor "we know
this exists" in the trail without faking a number. Once the recount
lands, append a real numeric snapshot - don't edit the null one.

Range/Area's three `canonical_likely_real_drift_review` edge cases are
the seeded example.

### Gap 13 resolved - policy edge cases get neutral diagnostics

The "Edge-case notes for X" panel previously fired a rose `flag` for
"no segment authored" on every chip-only spell. For edge cases with
`status: 'policy'` (e.g. "Folded into Classes", "`None` placeholder",
"Custom-condition labels") that read as "this is broken" when the
marker IS the answer.

Now: when the parent edge case is `'policy'`, the no-segment row is
neutral and labelled *"Policy edge case - no segment expected"* with a
detail explaining the resolution. Same for the no-comparison row. Other
diagnostics (`edgeCaseNote`, segment present, comparison present) fire
normally. **If you have policy edge cases with chip-only rosters, they
no longer read as broken.**

### Gap 14 resolved - subbucket-level spell rosters

`ExecutionStep.spells?: SpellRef[]` now exists, parallel to
`EdgeCase.spells`. Use it when a subbucket has a real roster but no
edge-case sub-patterns to host the chip list - e.g.
`Sub-Classes:incomplete_structured_subclasses` (24 spells, no
sub-families enumerated yet).

The subbucket header shows an emerald `spells N` chip. The chevron-
expanded body renders `AffectedSpellsView` above the edge-cases list.
Same component, same diagnostics, same authoring tiers (chip-only /
segment / segment+comparison).

**Per-edge-case attribution wins.** If a spell ALSO belongs to one of
your subbucket's edge cases, list it on the edge case (more specific).
The subbucket-level field is for orphan rosters only; don't list the
same spell in both places.

### Doc tweaks landed

- **Closure-step slug rule** is now explicit in the template's
  Conventions section: closure-step labels follow the same `snake_case`
  rule as P1/P2 subbuckets. (Sub-Classes flagged this in v2.)
- **Policy edge-case diagnostics** documented in the template's
  "Affected spells" section.
- **Subbucket-level spell rosters** documented in the same section,
  with the per-edge-case-attribution-wins rule.
- **Onboarding panel** mentions `ExecutionStep.spells`, the policy
  edge-case neutral treatment, and the `count: null` "pending recount"
  state.

### Verification fallback (environmental)

Several v2 reports flagged that the dispatched session couldn't always
open the running Atlas (browser tooling unavailable, `file://` blocked,
Node version mismatch in `node_repl`, etc.). Source-only verification
is acceptable when the dev server isn't reachable from your session -
read `BUCKET_META`, walk `EXECUTION_BY_BUCKET`, confirm the type-checks
clean. If you can open the Atlas, do so; if you can't, say so in §2 and
verify against source.

### Kind-aware reading

For `mechanics-model` (Conditions, Attack-Roll Riders), `inventory`
(Summoned Entities), and `closure` (Structured Markdown) buckets: the
dashboard's phase-count columns honestly show `-` for any phase your
bucket isn't on. That's not drift - it's correct. The real
work-tracking lives in your execution map.

## Your task

### 1. Open your bucket's deep link

```
/Aralia/misc/spell_pipeline_atlas.html?bucket=<YourBucket>
```

If you can't reach the dev server, fall back to source-only
verification.

### 2. Re-verify and apply the new fields

- **Bump `lastUpdated`** on your `BUCKET_META` row to current UTC time
  as the very last edit before you save. The v2 timestamp is now ~24
  hours old; bumping signals you've actually re-checked.
- **Sweep policy edge cases**: any `status: 'policy'` edge case in your
  bucket can now carry chip-only `spells` rosters without reading as
  broken. Add them where useful.
- **Sweep `? spells` edge cases**: if you have edge cases with
  `count: '?'`, consider adding a `count: null` history snapshot to
  anchor "we know this exists." Optional but informative.
- **Sweep orphan subbucket rosters**: if any subbucket has a real spell
  roster but no edge cases to host it, add `ExecutionStep.spells`.
  Don't manufacture edge cases just to attach the roster - that's the
  Gap 14 anti-pattern.
- **Closure-slug normalization**: if your bucket has Phase 3 closure
  steps with non-snake_case labels, normalize them now.

### 3. Verify your bucket is honest

- **Dashboard row** - `lastUpdated` reads "today" / fresh gray? Kind +
  work + gates correct?
- **Last updated** - bumped to the moment you finished editing?
- **Execution-map counts** match your tracker doc? (Gap 09 still
  applies; manual sync is on you.)
- **Policy edge cases** - now read neutral instead of rose-flagged?
- **Subbucket-level spells** (if you added any) - emerald `spells N`
  chip in the header; chevron-expanded view renders the tab strip and
  diagnostics?
- **`?` history snapshots** (if you added any) - render as gray
  italicized "?" bubbles with a `pending recount` tooltip?
- **Edge cases** - count + at least one history snapshot? Notes filled?
  Statuses honest?

### 4. Call out what still doesn't fit

Same rules as v2: don't paper over modeling limitations in `action` /
`doneWhen` prose. If you find a NEW gap, append to the registry
(`docs/tasks/spells/ATLAS_GAPS_REGISTRY.md`) using the format the doc
specifies. If a v2-resolved gap doesn't actually feel resolved (e.g.
policy diagnostics still read wrong on your specific case), add a note
to that gap's "Accepted / resolved" entry rather than reopening it.

If your bucket is now fully aligned with the model and you have nothing
new to surface, say so in §5 - "ready, no new gaps" is a valid v3
report.

## How to report back

Write your report to:

```
docs/tasks/spells/atlas-reports/<bucket-slug>/v3.md
```

Same slug rules as v2 - lowercase, spaces/slashes -> hyphens. Full
table is in `docs/tasks/spells/atlas-reports/README.md`. Your `v2.md`
stays put as the audit trail; `v3.md` sits next to it.

If you're a first-time agent (no v2.md exists for your bucket), still
write to `v3.md` - the version tracks the round, not your participation
count.

The file follows the same 5-section template as v2, with one
adjustment: §1 should now also report your sweep through the new
fields.

```markdown
## Bucket: <name>

### 1. Fields implemented (v3 round)
- `lastUpdated`: <bumped to YYYY-MM-DDTHH:MMZ>
- Policy edge cases: <N edge cases swept; M now carry chip-only spells | none in this bucket>
- `ExecutionStep.spells` (Gap 14): <added on <subbucket_slug> (N spells, chip-only) | none real - all rosters live on edge cases | N/A>
- `count: null` snapshots (Gap 12): <added on <edge_case_handle> (N snapshots) | none real - no `?` edge cases | N/A>
- Closure-slug normalization: <fixed N labels | already normalized | N/A - no closure steps>
- Other v2 fields: <unchanged | tweaked: ...>

### 2. Verification
- Dashboard row reads honestly: yes | no - <what's wrong>
- Matrix click-through lands on my map: yes | no | source-only (dev server unreachable)
- Execution-map counts match tracker doc: yes | drift - <numbers>
- Policy edge cases now read neutral instead of rose: yes | no - <which one>
- Subbucket-level rosters render correctly (if added): yes | N/A
- `?` history bubbles render correctly (if added): yes | N/A

### 3. Gaps reported
- New entries appended to `ATLAS_GAPS_REGISTRY.md`: <Gap NN | none>
- Existing entries I added notes to: <Gap NN | none>
- Resolved gaps (12/13/14) that don't actually feel resolved: <Gap NN reason | all good>

### 4. Doc / UI friction
- <bullet>
- <bullet>
- (or "none" if the v3 docs were sufficient)

### 5. Confidence
One sentence: ready / not ready, plus what's blocking if not ready.
```

**Don't post the report contents back as a chat message.** The file is
the deliverable. A one-line acknowledgment ("wrote
`atlas-reports/range-area/v3.md`") confirms delivery.

## What happens next

The orchestrator reads the v3 reports, decides whether the model has
converged enough to stop the loop, and either:

- **Closes the round**: the Atlas is ready. Bucket agents go back to
  actually working their buckets. The dispatch loop ends.
- **Sends a v4 prompt**: if v3 surfaces new modeling needs, the loop
  continues. New round, new file (`v4.md`), same shape.

Either way, your old reports stay as the audit trail of how the model
converged.

## TL;DR

1. Re-read the Onboarding panel + gap registry (only Gap 09 still open;
   12/13/14 just landed).
2. Bump `lastUpdated`. Sweep policy edge cases for chip-only rosters.
   Sweep orphan subbuckets for `ExecutionStep.spells`. Sweep `?` edge
   cases for `count: null` history. Normalize closure slugs.
3. Verify Dashboard / Matrix / Map read honestly (source-only fallback
   if dev server isn't reachable).
4. Report what doesn't fit (or "ready, no new gaps") - don't paper over.
5. Write the report to
   `docs/tasks/spells/atlas-reports/<bucket-slug>/v3.md` using the
   5-section template. Don't post contents in chat.
