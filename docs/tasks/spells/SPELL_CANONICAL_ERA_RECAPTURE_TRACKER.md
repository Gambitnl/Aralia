# Spell Canonical Era Re-Capture Tracker

This tracker exists for a narrow canonical-snapshot maintenance lane:

- identify spell reference markdown files whose stored canonical snapshot is still
  a 2014 / legacy page snapshot
- keep that lane separate from the broader structured-vs-canonical audit
- re-capture the canonical snapshot from the correct 2024 page when the project
  wants the canonical comparison lane to use the 2024 spell text

This file does **not** claim that the runtime spell JSON is wrong.
It only tracks whether the copied canonical snapshot inside the spell markdown is
the right era for future review.

## Why This Lane Is Separate

The structured-vs-canonical audit only compares the structured spell block
against whatever canonical snapshot is currently stored in the markdown file.

That means a spell can look "in sync" for the audit while still using the wrong
edition of canonical source text.

So this tracker answers a different question:

- is the stored canonical snapshot the correct era?

It should not be merged back into:

- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`

until the era-correctness lane has been resolved.

## Status Key

- `pending-2024-recapture`
  - the markdown currently stores a legacy / 2014 canonical snapshot and should
    be re-captured from the 2024 page
- `legacy-consistent`
  - both the current markdown snapshot and the spell JSON are still marked
    legacy; this is consistent for now, but still part of the 2024 re-capture
    review set
- `stale-canonical-mismatch`
  - the markdown snapshot is still marked legacy, but the spell JSON is not;
    this is the clearest "canonical snapshot is behind the current
    implementation lane" case
- `unmarked-snapshot`
  - the markdown has a canonical snapshot block but no `Legacy Page` or
    `Capture Method` marker, so its era should be inspected before it is used as
    a trustworthy comparison surface

## Active 2024 Re-Capture Set

Current repo-state reading on `2026-04-18`:

- `25` spell markdown files currently contain `Legacy Page: true`
- all `25` belong to the active 2024 re-capture lane
- subgroup split:
  - `18` are `legacy-consistent`
  - `7` are `stale-canonical-mismatch`

### Stale Canonical Mismatch

These are the highest-confidence stale canonical snapshots because the markdown
is still legacy while the matching spell JSON is no longer marked `legacy: true`.

- [ ] `fire-bolt`
- [ ] `alarm`
- [ ] `charm-person`
- [ ] `aid`
- [ ] `alter-self`
- [ ] `shining-smite`
- [ ] `feeblemind`

### Legacy-Consistent Set

These are still legacy on both sides right now. They are internally consistent,
but they remain part of the 2024 re-capture lane because the canonical snapshot
itself is still a legacy-page capture.

- [ ] `aura-of-life`
- [ ] `aura-of-purity`
- [ ] `staggering-smite`
- [ ] `mislead`
- [ ] `scrying`
- [ ] `circle-of-power`
- [ ] `reincarnate`
- [ ] `raise-dead`
- [ ] `swift-quiver`
- [ ] `conjure-volley`
- [ ] `synaptic-static`
- [ ] `steel-wind-strike`
- [ ] `rarys-telepathic-bond`
- [ ] `planar-binding`
- [ ] `passwall`
- [ ] `modify-memory`
- [ ] `mass-cure-wounds`
- [ ] `bigbys-hand`

## Unmarked Canonical Snapshots

Current repo-state scan on `2026-04-18` found `10` spell markdown files that
contain a canonical snapshot block but have neither:

- `Legacy Page: ...`
- `Capture Method: ...`

This appears to be the pre-marker capture cohort in the current corpus. These do
not automatically belong to the legacy re-capture set, but they should not be
treated as era-certain without inspection.

- [ ] `acid-splash`
- [ ] `arcane-sword`
- [ ] `blade-ward`
- [ ] `booming-blade`
- [ ] `chill-touch`
- [ ] `create-bonfire`
- [ ] `dancing-lights`
- [ ] `druidcraft`
- [ ] `eldritch-blast`
- [ ] `goodberry`

## Working Rule

When this lane is active, do the work in this order:

1. inspect or re-capture the active `Legacy Page: true` set
2. classify the unmarked snapshot cohort so they stop being era-ambiguous
3. only then treat structured-vs-canonical disagreements on those spells as
   trustworthy era-correct comparisons

## Current Scope Boundary

This tracker only covers canonical snapshot era correctness.

It does **not** itself decide:

- whether the runtime spell JSON should stay legacy
- whether the structured markdown block should be rewritten
- whether a structured-vs-canonical mismatch is a real spell-truth issue

Those are follow-up lanes.
