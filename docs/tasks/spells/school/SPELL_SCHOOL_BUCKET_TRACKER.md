# Spell School Bucket Tracker

**Bucket added: 2026-04-30** (after the V3 Atlas dispatch loop closed).
**First-time dispatch v4 closed: 2026-05-01** with no live drift.

## Bucket Purpose

Track School-field consistency across the canonical → structured → JSON
migration. The School field is one of the eight standard D&D schools:
`abjuration`, `conjuration`, `divination`, `enchantment`, `evocation`,
`illusion`, `necromancy`, `transmutation`.

The field appears in **412 structured-md files** per
`public/data/spell_audit_coverage.json`.

## Current Status (v4 first-time, 2026-05-01)

The v4 first-time dispatch was authored against the premise that no
parity script existed. The agent confirmed that this premise was wrong:
School is already wired into all three live audit lanes, and all three
report **zero mismatches**.

| Lane | Script | School coverage | Mismatches |
| --- | --- | --- | --- |
| canonical → structured | `scripts/auditSpellStructuredAgainstCanonical.ts` | explicit `field: 'School'` (line ~849) | 0 / 456 compared files |
| structured → runtime JSON | `scripts/auditSpellStructuredAgainstJson.ts` | explicit `field: 'School'` (line ~817) | 0 / corpus |
| markdown-vs-JSON parity | `scripts/validateSpellMarkdownParity.ts` | derived field map at `fields.set('School', ...)` (line ~219) | 0 / 412 markdown files |

Sources: `.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json`
(generated 2026-04-30T08:24Z),
`.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json`
(generated 2026-04-30T08:25Z), and
`.agent/roadmap-local/spell-validation/spell-markdown-parity-report.json`
(generated 2026-04-29T15:40Z).

The bucket therefore lands at v4 first-time in a fully-done shape:
- Phase 1 closed (`school_canonical_parity_clean` at `0 live`).
- Phase 2 closed (`school_runtime_parity_clean` at `0 live`).
- `BUCKET_META` gates flipped from `todo/todo` to `implemented/implemented`.
- `lastUpdated` bumped to `2026-05-01T10:00Z`.

## Bucket Interpretation

### Canonical → Structured

The canonical extract carries School information either as a dedicated
`School:` line inside the canonical comment block or as part of a
level/school header. The structured layer normalizes this to a
`- **School**: <token>` line on the controlled vocabulary.

`auditSpellStructuredAgainstCanonical.ts` extracts the canonical-side
value via `extractCanonicalField(commentBlock, 'School')` and compares
it to `structured.labels.get('School')` after the standard text
normalization pass. Zero mismatches today; the canonical extracts and
the structured tokens already agree on every spell.

### Structured → Runtime JSON

The runtime JSON `school` field carries the same single-token value as
the structured layer. Both runtime audit lanes already check it:

- `auditSpellStructuredAgainstJson.ts` builds parallel
  `comparableJson.labels` and `structured.labels` maps and explicitly
  compares the `School` entries.
- `validateSpellMarkdownParity.ts` derives `fields.set('School', spell.school)`
  from the spell JSON and compares it to the `- **School**:` markdown
  label via the dynamic `for (const [fieldName, jsonValue] of structuredJsonFields.entries())`
  loop.

Zero mismatches on either side.

## Per-Phase Plan

Both phases are closed as of v4 first-time. Future work on this bucket
is reactive only:

- If a future canonical refresh introduces a school-field mismatch, the
  canonical-audit run will surface it; reopen Phase 1 and append a real
  subbucket alongside the closed `school_canonical_parity_clean` row.
- If a runtime JSON regeneration introduces drift, the structured-vs-
  JSON or markdown-vs-JSON audit will surface it; reopen Phase 2.
- If a future bucket adds a non-standard school value (an Aralia-only
  carve-out, a homebrew school, etc.), revisit the controlled-vocabulary
  list in this tracker before letting the structured layer accept it.

## Notes

- `lastUpdated` in `BUCKET_META`: `2026-05-01T10:00Z` (bumped at v4 close).
- `kind`: `parity` - same three-layer migration as Sub-Classes /
  Components / Duration etc.
- Long-term goal: the runtime JSON spell template already carries
  `school` as a top-level field; the canonical and structured layers
  retire alongside the rest of the pipeline once the JSON template is
  the single source of truth.
- Coverage-scanner false negative: `parityScript: false` on the School
  row of `spell_audit_coverage.json` is a scanner artifact (the parity
  script reads the field via a derived map rather than a literal
  `'School'` string) and not a real coverage gap. Filed as a separate
  Atlas-gap entry rather than corrected inline.
