# Character Encoding Policy

**Status**: Active guardrail  
**Last Reviewed**: 2026-03-14

## Purpose

This file defines the current character-encoding guardrails used to prevent mojibake, invisible characters, and cross-platform formatting drift in spell-related data and docs.

## Verified Current Enforcement

A 2026-03-14 repo check confirmed:
- `scripts/validate-data.ts` still runs charset validation as part of the main data-validation flow
- `scripts/check-non-ascii.js` is still the referenced checker implementation
- the current validation flow distinguishes strict failures from softer warnings

## ASCII-Strict Targets

The following directories are intended to remain ASCII-strict:
- `docs/spells/reference/**/*.md`
- `public/data/spells/**/*.json`
- `public/data/glossary/entries/**/*.json`

## Prohibited In ASCII-Strict Targets

Do not introduce:
- curly quotes instead of straight `'` or `"`
- en dashes or em dashes instead of `-`
- the single-character ellipsis instead of `...`
- non-breaking spaces or invisible spacing characters
- BOM markers or zero-width characters
- mojibake sequences caused by broken UTF-8 decoding

## Current Working Rule

Use this file as an active policy note, not a historical artifact.

When spell docs or spell JSON are edited:
- keep schema-facing fields ASCII-clean
- run the validation flow instead of relying on eyeballing alone
- treat charset regressions as data-quality issues, not cosmetic cleanup

## Commands

- `npm run validate`
- `npm run validate:charset`
- `npm run fix:charset`
