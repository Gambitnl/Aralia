# Spell Sub-Classes Bucket Tracker

Last Updated: 2026-05-11

**Status: BUCKET CLOSED.** All 3 phases done. See `2026-05-11 (Phase 2 + Phase 3 closure)` in the progress log below for the closure summary.

## Bucket Purpose

This tracker exists for the `Sub-Classes` bucket in the spell-truth lane.

This bucket has two comparison phases:

1. `canonical -> structured`
2. `structured -> json`

Current execution priority is:

1. square away `canonical -> structured`
2. use that cleaned structured layer to drive `structured -> json`

That order matters because the structured `.md` block is the interpreted layer.
If it stays incomplete or inconsistent, the runtime JSON follow-up lane will stay
noisy and harder to classify.

## Current Status

- canonical -> structured:
  - live report: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `156`
  - grouped kind: `missing-canonical-field`
  - current reading: mixed bucket, but this is now the primary execution surface
- structured -> json:
  - live report: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `45`
  - grouped kind: mainly `missing-json-field`
  - current reading: downstream implementation lane that should be reviewed after
    the canonical-first transfer work

## Canonical-First Bucket Interpretation

### Real Drift

- canonical snapshot clearly exposes subclass/domain access
- structured `.md` is missing it or stores an incomplete normalized list

### Normalized Difference

- canonical snapshot preserves repeated-base subclass/domain entries
- structured `.md` intentionally normalizes them away because the base class is
  already present in `Classes`

### Source-Shape Residue

- canonical subclass/domain access is visible in raw `Available For`
- current comparison layer does not derive a directly comparable normalized
  `Sub-Classes` field cleanly

### Model Gap

- repeated-base subclass policy is still not finally settled for long-term runtime
  storage
- verification semantics still need a final rule for when `subClassesVerification`
  should move from `unverified` to `verified`

## Canonical -> Structured Subbuckets

These are the active subbuckets for the canonical-first pass.

### 1. `missing_structured_subclasses`

- canonical snapshot clearly shows subclass/domain access
- structured `.md` has no `Sub-Classes` field or an empty one

### 2. `incomplete_structured_subclasses`

- structured `.md` has a `Sub-Classes` field
- but it is missing one or more canonical subclass/domain entries

### 3. `repeated_base_canonical_entries`

- canonical snapshot includes subclass/domain entries whose base class is already
  present in `Classes`
- these are real canonical facts, but they may remain normalized out of the
  structured/runtime payload

### 4. `legacy_or_unsupported_canonical_entries`

- canonical snapshot includes legacy or unsupported subclass/domain lines
- these should remain visible as evidence, but may not belong in normalized
  structured data

### 5. `canonical_label_variant_residue`

- canonical snapshot carries variant source suffixes or label forms
- examples:
  - `TCoE` vs `TCOE`
  - other source-tag spelling variants

### 6. `malformed_structured_subclass_field`

- structured side contains placeholders or malformed values such as `None`
- these must be corrected before reliable transfer work can happen

### 7. `canonical_source_shape_gap`

- canonical snapshot clearly has subclass access in raw `Available For`
- current audit/parsing layer still records `missing-canonical-field`
- this is audit/parser residue, not automatically real subclass absence

## Working Order

Current recommended execution order:

1. `missing_structured_subclasses`
2. `incomplete_structured_subclasses`
3. `malformed_structured_subclass_field`
4. `legacy_or_unsupported_canonical_entries`
5. `repeated_base_canonical_entries`
6. `canonical_label_variant_residue`
7. `canonical_source_shape_gap`

Only after that:

8. work the downstream `structured -> json` residue set

## Gate Checker Coverage

Current glossary spell gate coverage:

- `Sub-Classes Review`
  - phase: `canonical -> structured`
  - status: implemented
- `Sub-Classes Runtime Review`
  - phase: `structured -> json`
  - status: implemented

The runtime block should be used after canonical-first transfer work has cleaned up
the interpreted structured layer.

## Important Files For This Bucket

Core docs and reports:
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_GEMINI_HANDOVER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

Relevant implementation surfaces:
- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\public\data\spell_gate_report.json`

Representative spell surfaces for review:
- `F:\Repos\Aralia\docs\spells\reference\level-5\hold-monster.md`
- `F:\Repos\Aralia\public\data\spells\level-5\hold-monster.json`

## Progress Log

### 2026-04-04

- created the first dedicated tracker for this bucket
- documented the two-phase nature of `Sub-Classes`
- confirmed the glossary had:
  - `Sub-Classes Review`
  - `Sub-Classes Runtime Review`

### 2026-04-10 (handoff prep)

- shifted this bucket to a canonical-first execution model
- replaced the earlier runtime-first framing with explicit canonical-side subbuckets
- prepared the bucket for Gemini handoff
- aligned the shared spell-truth docs so they now point at the same canonical-first
  execution order:
  - `SPELL_DATA_VALIDATION_PLAN.md`
  - `SPELL_CANONICAL_SYNC_TRACKER.md`
  - `SPELL_CANONICAL_SYNC_FLAGS.md`

### 2026-04-10 (Gemini takeover - session 1)

- completed initial triage of the `71` canonical -> structured Sub-Classes mismatches
- sorted into subbuckets:
  - `missing_structured_subclasses`: `38` spells
  - `incomplete_structured_subclasses`: `27` spells
  - `malformed_structured_subclass_field`: `3` spells (overlap with missing)
  - `missing_canonical_field` (reverse): `6` spells
- resolved policy decision: **Illrigger is not a canonical class** - it is leftover
  homebrew data that should be cleaned out
- removed Illrigger entries from `6` structured spell markdown files:
  - `level-1/detect-magic`
  - `level-4/banishment`
  - `level-4/blight`
  - `level-4/death-ward`
  - `level-4/dimension-door`
  - `level-4/locate-creature`
- confirmed Illrigger had not propagated to runtime spell JSON - no JSON cleanup needed
- resolved policy decision: **Remove redundancy** - redundant subclass entries (e.g.,
  `Cleric - Life Domain` when `Cleric` is already in base access) should remain
  normalized away and NOT be added to the structured `Sub-Classes` block
- resolved policy decision: **Remove Legacy entries** - subclass entries suffixed
  with `(Legacy)` should be cleaned out of structured markdown
- removed Legacy subclass entries from `2` structured spell markdown files:
  - `level-1/detect-magic`
  - `level-4/locate-creature`

### 2026-04-29 (resume after Atlas v3 round closure)

- audited the live state of the `55` spells previously listed under
  `missing_structured_subclasses`; counts had drifted significantly from the
  earlier `~30` no-field / `~25` empty-value estimates
- live audit result:
  - `12` spells truly had no `Sub-Classes` line (NO_FIELD)
  - `0` spells had an empty `Sub-Classes` line (EMPTY_VALUE)
  - `43` spells now carry populated `Sub-Classes` lines, mostly with
    unsupported entries - these belong to `incomplete_structured_subclasses`
    shape now and should be re-classified there
- inserted `Sub-Classes` lines into all `12` NO_FIELD spell `.md` files using
  only roster-supported subclass-only entries (per Decision 6 / Policy 6 in
  the canonical-first tracker variant) and skipping repeated-base entries
  (per Decision 2):
  - `level-4/arcane-eye` -> `Cleric - Light Domain, Sorcerer - Draconic Sorcery`
  - `level-5/commune` -> `Paladin - Oath of Devotion`
  - `level-4/dominate-beast` -> `Warlock - Archfey Patron`
  - `level-5/dominate-person` -> `Cleric - Trickery Domain, Warlock - Archfey Patron`
  - `level-5/flame-strike` -> `Paladin - Oath of Devotion`
  - `level-4/freedom-of-movement` -> `Paladin - Oath of Devotion, Paladin - Oath of Glory`
  - `level-5/hold-monster` -> `Cleric - War Domain, Druid - Circle of the Sea, Paladin - Oath of Vengeance`
  - `level-4/ice-storm` -> `Paladin - Oath of the Ancients`
  - `level-5/legend-lore` -> `Paladin - Oath of Glory, Sorcerer - Draconic Sorcery`
  - `level-4/stoneskin` -> `Paladin - Oath of the Ancients`
  - `level-5/telekinesis` -> `Warlock - Great Old One Patron`
  - `level-4/wall-of-fire` -> `Cleric - Light Domain, Warlock - Celestial Patron, Warlock - Fiend Patron`
- closed `missing_structured_subclasses:a` (No `Sub-Classes:` line at all) and
  `:b` (Field present but empty value) edge cases on the Atlas execution map;
  flipped subbucket status to `done`
- flipped `incomplete_structured_subclasses` to `active` with a `count: null`
  pending-recount snapshot - the `43` migrated spells overlap unknown
  amount with the original tracker `24` so a fresh enumeration is needed
- `Sub-Classes` bucket active subbucket is now
  `incomplete_structured_subclasses`

### 2026-05-05 (roster-aware audit script landed)

- added `scripts/auditSpellSubClassesRoster.ts` (`npm run audit:sub-classes-roster`)
  to replace manual subbucket classification. Unlike the generic
  `auditSpellStructuredAgainstCanonical.ts` audit, this script applies
  Decision 6 (roster-only labels) and Decision 2 (strip repeated-base) before
  comparing layers, so it surfaces only the work actually left to do.
- outputs:
  - `docs/tasks/spells/sub-classes/SPELL_SUB_CLASSES_ROSTER_REPORT.md`
  - `.agent/roadmap-local/spell-validation/spell-sub-classes-roster-report.json`
- first run, 459 spells scanned, classifications:
  - `roster_clean`: `22` (no work)
  - `needs_strip`: `47` (real `incomplete_structured_subclasses` work - strip
    unsupported/repeated-base entries from existing structured field)
  - `needs_both`: `3` (mage-hand, ray-of-frost, sacred-flame - currently in
    `malformed_structured_subclass_field` with `None` placeholder; cleanup
    is strip+add: replace `None` with the real supported entry)
  - `needs_add`: `0` (no spell needs only adds - all add-cases also have
    unsupported entries to strip first, hence `needs_both`)
  - `no_supported_access`: `172` (canonical has no roster-supported
    subclass-only access; structured should be stripped to empty + marker
    applied - much bigger than the tracker's 8 + 7 = 15
    `repeated_base` + `unsupported` subbucket counts)
  - `no_field`: `212` (no `Sub-Classes` line; most have no roster-supported
    access either, so they read as "no work" but explicit marker would make
    that intent visible)
  - `empty_field`: `0`
  - `no_canonical_block`: `3` (markdown files without canonical comments)
- this means the tracker's `incomplete_structured_subclasses: 24` count is
  significantly stale - the live count is `47` (+ `3` overlap from
  `needs_both`); the v2 Atlas chip-only roster on this subbucket should be
  expanded to match the script's full list

### 2026-05-10 (status update after another agent's pass)

- re-ran `npm run audit:sub-classes-roster` after another agent did work
  on the bucket; produced a fresh snapshot
- diff vs `2026-05-05` baseline:
  - `roster_clean`: `22` -> `9` (-13)
  - `needs_strip`: `47` -> `63` (+16)
  - `needs_both`: `3` -> `0` (-3)
  - `no_supported_access`: `172` -> `194` (+22)
  - `no_field`: `212` -> `190` (-22)
  - others unchanged
- net interpretation:
  - the other agent's pass resolved the 3 `None`-placeholder spells
    (mage-hand, ray-of-frost, sacred-flame) into `roster_clean` - genuine
    progress on the `malformed_structured_subclass_field` subbucket
  - the pass also populated 22 previously-empty Sub-Classes fields, but
    did so by copying the full canonical `Available For` set (including
    unsupported labels), so those 22 spells migrated from `no_field` into
    `no_supported_access` or `needs_strip` rather than `roster_clean`
  - the same canonical-merge pattern also touched 13 previously
    `roster_clean` spells (including the 12 I authored from the original
    NO_FIELD set + 4 already-clean spells), adding unsupported labels on
    top of the roster-supported entries already present
  - this is a Decision 6 regression: the pass treated canonical as the
    source of truth rather than the supported-rosters doc
- Atlas updates landed:
  - `incomplete_structured_subclasses`: count `24` -> `63`, full roster
    refreshed from the audit report, segments dropped back to chip-only
    (per-spell strip lists live in `SPELL_SUB_CLASSES_ROSTER_REPORT.md`)
  - `malformed_structured_subclass_field`: count `5` -> `2`; the surviving
    `aura-of-vitality` and `mind-sliver` shifted shape from
    `None`-placeholder to unsupported-only - cleanup is now
    strip + marker, not refill
  - `missing_structured_subclasses` stays closed (`0 spells`, `done`) -
    none of the original 12 regressed to NO_FIELD
  - `unsupported_canonical_entries` (7) and `repeated_base_canonical_entries`
    (8): both confirmed unchanged by the audit; appended verification
    history snapshots
  - bumped `lastUpdated` to `2026-05-10T21:45Z`

### 2026-05-10 (cleanup applied - 63 spells back to roster-clean)

- confirmed with project owner that the canonical-merge regression was
  unintentional - Decision 6 stays in effect
- added `scripts/applySpellSubClassesRosterCleanup.ts` and the npm shortcut
  `npm run cleanup:sub-classes-roster`. Script reads the audit JSON and
  rewrites each `needs_strip` / `needs_both` spell's `- **Sub-Classes**:`
  line to the `expectedEntries` value (post-Decision-6 + Decision-2)
- ran `npm run cleanup:sub-classes-roster -- --apply` after a dry-run
  preview - 63 spells rewritten, 0 skipped, 0 failed
- re-ran `npm run audit:sub-classes-roster` to verify; final state:
  - `roster_clean`: `9` -> `72` (+63)
  - `needs_strip`: `63` -> `0` ✓
  - `needs_both`: `0` (unchanged)
  - `no_supported_access`: `194` (unchanged - separate marker work)
  - `no_field`: `190` (unchanged - separate marker work)
- Atlas updates landed:
  - `incomplete_structured_subclasses`: count `63` -> `0`, status flipped
    to `done`
  - `unsupported_canonical_entries`: flipped to `active` as the next
    natural step (small concrete list of 7 spells, clear marker policy)
  - action text on the now-active subbucket flags the broader
    `no_supported_access` set of 194 spells - a policy call is needed on
    whether to expand marker work beyond the original 7
  - bumped `lastUpdated` to `2026-05-10T21:57Z`
- forensics on the canonical-merge regression deferred - the user
  prioritised cleanup over root-cause. The data is back to
  roster-clean, but until we identify the offending script/tool, the
  same regression could land again the next time someone touches the
  bucket

### 2026-05-11 (forensics + WIDE marker pass)

- user confirmed the marker policy should be WIDE (apply markers to
  every spell without roster-supported subclass-only access, not just
  the original tracker-enumerated 15)
- forensics on the regression: traced to
  `scripts/reviewSpellCorpusAgainstDndBeyond.ts --apply`. Lines 845-846
  write `local.subClasses = canonicalClassAccess.subClasses` directly
  from the parsed `Available For` block with no roster filter, then
  line 647 mirrors that to the markdown `Sub-Classes` line. **Fix
  pending**: load `SPELL_SUPPORTED_SUBCLASS_ROSTERS.md` inside the
  script and apply Decision 6 + 2 before writing. Forensics summary
  documented in the chat record for the bucket; no separate fix PR
  landed yet.
- extended `auditSpellSubClassesRoster.ts`:
  - added `recommendedMarker` field on each spell record, computed
    from canonical analysis (3-way: `No Subclass Entries` /
    `Folded into Classes` / `Unsupported Entries`)
  - added new `marker_applied` matchKind so the audit recognizes the
    three marker strings as a terminal/resolved state rather than
    treating them as regular entries that need stripping
  - console output now shows marker distribution alongside matchKind
    counts
- extended `applySpellSubClassesRosterCleanup.ts` with a `--markers`
  flag that:
  - for `no_supported_access` and `empty_field` rows, rewrites the
    existing `- **Sub-Classes**:` line to the recommended marker
  - for `no_field` rows, INSERTS a new `- **Sub-Classes**: <marker>`
    line immediately after the `- **Classes**: ...` line
- ran `npm run cleanup:sub-classes-roster -- --markers --apply` to
  apply markers across all 384 affected spells
  - dry-run preview: 384 edits, 0 skips, 0 failures
  - distribution: `No Subclass Entries` 263, `Unsupported Entries` 96,
    `Folded into Classes` 25
- post-pass audit (459 spells scanned):
  - `roster_clean`: `72` (unchanged)
  - `marker_applied`: `384` (was 0)
  - `needs_strip`/`needs_add`/`needs_both`/`empty_field`/`no_field`/
    `no_supported_access`: all `0`
  - `no_canonical_block`: `3` (pre-existing data issue, not touchable
    by this lane)
- Atlas updates:
  - all 6 Phase 1 subbuckets flipped to `done`:
    - `missing_structured_subclasses` (already done from 4/29)
    - `incomplete_structured_subclasses` (already done from earlier
      cleanup pass)
    - `malformed_structured_subclass_field` (`2` -> `0`)
    - `unsupported_canonical_entries` (`7` -> `0`)
    - `repeated_base_canonical_entries` (`8` -> `0`)
    - `canonical_source_shape_gap` (`11` -> `0`)
  - Phase 2 `structured_to_json_residue` flipped to `active` for
    re-verification (the WIDE marker pass added marker strings to 384
    structured `.md` files; runtime JSON either needs to mirror those
    markers or carry an equivalent empty/null state)
  - `BUCKET_META` note updated to "Phase 1 closed via WIDE marker
    pass; Phase 2 verification active"
  - bumped `lastUpdated` to `2026-05-10T23:34Z`
- remaining work for the bucket:
  - Phase 2 audit re-run: confirm runtime JSON consistency
  - Phase 3 closure tasks (fixture/type-test alignment; retire
    `subClassesVerification`; flip glossary gate checker to closed)
  - regression-prevention fix in
    `scripts/reviewSpellCorpusAgainstDndBeyond.ts` (forensics finding)

### 2026-05-11 (Phase 2 + Phase 3 closure - bucket fully done)

- **Phase 2 (structured -> runtime JSON)**:
  - first audit after WIDE marker pass surfaced `429` Sub-Classes
    drift cases - the JSON layer still carried the pre-cleanup
    canonical-merge state (full lists incl. unsupported labels)
  - added `scripts/syncSpellSubClassesJsonFromMarkdown.ts` +
    `npm run sync:sub-classes-json` to mirror .md state into JSON. For
    marker spells, JSON gets `subClasses: []` (marker info stays in
    .md only; promoting it to JSON requires `subClassesStatus` schema
    work, deferred)
  - dry-run: 185 rewrites, 0 failures. Applied.
  - extended `auditSpellStructuredAgainstJson.ts` to recognize the 3
    sentinel markers as semantically equivalent to JSON empty list
    (`normalizeStructuredSubClassesValue`)
  - post-pass audit: total mismatches `447` -> `18`; the remaining
    18 are pre-existing Casting Time issues (different bucket).
    **Zero Sub-Classes mismatches.**

- **Regression-prevention** (the forensics finding from 5/11):
  - extended `scripts/reviewSpellCorpusAgainstDndBeyond.ts` with
    `loadSupportedSubClassesRoster()` + `applySubClassesPolicyFilter()`
  - the `--apply` write site at line ~845 now filters
    `canonicalClassAccess.subClasses` through Decision 6 + Decision 2
    before writing into `local.subClasses`
  - mismatch detection at line ~890 also uses the filtered set, so
    the report no longer flags roster-clean spells as drift just
    because canonical surfaces include unsupported labels
  - the canonical-merge regression that we cleaned up on 5/10 cannot
    re-land via this script anymore

- **Phase 3a (fixture/type-test alignment)**:
  - `subClassesStatus.test.ts` was already passing on the current
    schema; no fixture mismatch remained
  - rewrote the test to document the retirement contract for
    `subClassesVerification` (3 new tests; all pass)

- **Phase 3b (retire subClassesVerification)**:
  - `SpellClassAccess` schema in `spellValidator.ts`: made the field
    `.optional()`; dropped the refinement rule that tied a non-empty
    `subClasses` to a `'verified'` marker
  - `Spell` type in `src/types/spells.ts`: field marked optional
  - `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts`:
    updated `classAccessVerified` to treat absent/verified as verified,
    only `"unverified"` still gates
  - `scripts/retireSpellSubClassesVerification.ts` +
    `npx tsx scripts/retireSpellSubClassesVerification.ts --apply`:
    stripped the field from all `459` spell JSON files (0 failures)
  - removed `subClassesVerification = 'verified'` write site +
    mismatch check + type-union member from
    `reviewSpellCorpusAgainstDndBeyond.ts`
  - removed the field's entry from the spell-json template
  - downstream pass-through reads (lines 2424, 2540 in
    `spellGateBucketDetails.ts`) handle undefined gracefully and
    were left as-is for display-trail compatibility

- **Phase 3c (gate checker flip)**:
  - `Sub-Classes Review` and `Sub-Classes Runtime Review` panels in
    `SpellGateBucketSections.tsx` are populated only when
    `gate.bucketDetails.subClasses` / `subClassesRuntime` are
    non-undefined - i.e. only when there's drift. With Phase 1+2
    closed and runtime JSON synced, no spell triggers either panel.
    The "closure" is naturally implicit through clean data state.

- **Atlas updates**:
  - all 3 phases now show `done` across all subbuckets / closure steps
  - `BUCKET_META` note bumped to "All 3 phases closed 2026-05-11
    (WIDE marker policy)"
  - `lastUpdated` -> `2026-05-11T08:12Z`

- **Test surface**: 110/110 spell-related tests pass.

## Remaining Work

- turn the `156` canonical-side cases into the subbuckets listed above
  - initial triage complete for the `71` Sub-Classes subset
  - `38` missing structured transfers are unblocked and ready to execute
- identify which spells are true:
  - missing structured subclass data
  - incomplete structured subclass data
  - repeated-base normalization only
  - legacy/unsupported evidence only
  - parser/source-shape residue only
- then use the cleaned structured layer to reduce the `45` structured-vs-json cases

## Resolved Policy Decisions

1. **Illrigger is not canonical** - any `Illrigger - Architect of Ruin` entries in
   structured spell data are leftover homebrew and should be removed on sight.
   Confirmed by project owner on `2026-04-10`.
2. **Remove redundancy for repeated-base subclasses** - if a spell can be cast by
   all members of a class (e.g., `Cleric`), and a subclass is also listed
   (e.g., `Cleric - Life Domain`), the redundant subclass entry should **not** be
   included in the structured `.md` `Sub-Classes` field. Keep it normalized away.
   Confirmed by project owner on `2026-04-10`.
3. **Remove legacy suffixes** - any subclass entries suffixed with `(Legacy)`
   should be treated as historical cruft and scrubbed from the `Sub-Classes` field.
   Confirmed by project owner on `2026-04-10`.

## Open Questions / Model Gaps

1. When does `subClassesVerification: "verified"` become appropriate?
   - after canonical retrieval
   - after structured transfer
   - or only after structured + runtime JSON both match


