# Agent Prompt 02 - Non-ASCII / Mojibake Guardrails for Spells + References

Repo: `AraliaV4/Aralia`

Goal: Prevent recurring cleanup work caused by mojibake and disallowed characters in spell references and spell JSON (and keep it from regressing).

## Problem
Some source text imports can introduce:
- mojibake sequences and broken decodes
- non-printing/control characters (BOM, zero-width spaces)
- inconsistent quotes/dashes

These make it harder to diff, review, and sometimes break UI rendering.

## Task
### 1) Define the policy
Decide and document (in this repo) what is allowed:
- Option A: ASCII-only for all reference `.md` and JSON string content (simplest).
- Option B: Allow a small whitelist of Unicode characters (e.g. curly quotes, em-dash) but forbid mojibake/control chars.

Recommendation: ASCII-only for `docs/spells/reference/**/*.md` and `public/data/spells/**/*.json`, plus explicit banning of mojibake/control characters everywhere.

### 2) Implement a scanner script
Create a script that scans:
- `docs/spells/reference/**/*.md`
- (recommended) `docs/**/*.md` (to catch mojibake in general documentation)
- `public/data/spells/**/*.json`
- (optional) `public/data/glossary/entries/**/*.json`

The script should:
- flag any characters outside the allowed policy
- specifically detect common mojibake markers (by code point and/or substring), including at minimum:
  - U+FFFD replacement character
  - U+00C3 sequences (common UTF-8/Latin-1 mixups)
  - U+00E2/U+20AC/U+2122 triplet (common mis-decoded right-quote)
  - U+0192 (Latin Small Letter F With Hook; common mojibake artifact)
- also detect "unexpected scripts" in otherwise English/ASCII content:
  - Cyrillic block U+0400..U+04FF (e.g., U+0413, U+041B often show up in broken decodes)
- detect non-breaking spaces that look like normal spaces:
  - U+00A0 (NBSP)
- detect zero-width and control characters:
  - BOM: U+FEFF
  - zero-width: U+200B, U+200C, U+200D
  - control range: U+0000..U+001F (allow tabs/newlines as appropriate per file type)
- output a report with:
  - file path
  - line number
  - offending character + code point
  - suggested replacement

Suggested location:
- `scripts/check-non-ascii.ts`

### 3) Implement an auto-fix mode
Add an optional `--write` mode that performs safe normalization:
- curly quotes -> straight quotes
- em/en dashes -> `-`
- ellipsis -> `...`
- NBSP -> normal space (U+00A0 -> U+0020)
- strip BOM and zero-width spaces

If you implement targeted mojibake repairs, keep them conservative and fully deterministic.

### 4) Integrate into validation
Add a new npm script (or integrate into existing data validation) so regressions are caught:
- Prefer: extend `scripts/validate-data.ts` to run this check before parsing/validating spells.
  - Or add `npm run validate:charset` and call it from CI.

### 5) Confirm no regressions
Run:
- `npm run validate`

## Deliverable
- A documented character policy (ASCII-only or whitelisted Unicode).
- A scanner script with report output and `--write` mode.
- Validation integration so future regressions are blocked.

## After completion (required)
Append to this file:
- "Completion Notes"
- "Detected TODOs (Out of Scope)"
See `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.
