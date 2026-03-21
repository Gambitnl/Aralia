# Jules Spell Migration - IDE Agent Instructions

> **Audience**: IDE Agent (Gemini CLI, Cursor, etc.)
> **Purpose**: Explain how to dispatch spell-migration work to Jules without duplicating stale prompt bodies.
>
> **Status Note (2026-03-11):**
> - the `jules` CLI exists on this machine, so this workflow is still situationally usable
> - this file has been narrowed to a dispatch wrapper around the current prompt and acceptance docs
> - older duplicated prompt blocks and stale glossary-path instructions were removed so this file stops fighting the current subtree workflow

## Workflow

1. Read this file.
2. Select pending spells from the current status/completeness surfaces.
3. Adapt [`SPELL_MIGRATION_PROMPT.md`](./SPELL_MIGRATION_PROMPT.md) for the target level and spell batch.
4. Dispatch via `jules new "<task prompt>"` or the equivalent IDE-side Jules command available in your environment.
5. Let Jules work asynchronously, then review the result against the current acceptance criteria.

---

## Use These Files Together

- [`SPELL_MIGRATION_PROMPT.md`](./SPELL_MIGRATION_PROMPT.md) for the current reusable task template
- [`JULES_ACCEPTANCE_CRITERIA.md`](./JULES_ACCEPTANCE_CRITERIA.md) for the strict local migration contract
- [`SPELL-WORKFLOW-QUICK-REF.md`](./SPELL-WORKFLOW-QUICK-REF.md) for compact schema/workflow guardrails
- the applicable level rollup or gaps file if one already exists

## Dispatch Checklist

1. Pick pending spells from the current status/completeness surfaces.
2. Start from [`SPELL_MIGRATION_PROMPT.md`](./SPELL_MIGRATION_PROMPT.md) instead of copying older prompt blocks.
3. Keep the output focused on nested JSON under `public/data/spells/level-{N}/`.
4. Do not assume a spell-glossary markdown lane exists; verify companion-doc targets first.
5. If a level rollup or gaps doc does not exist yet, create it deliberately instead of pretending it already exists.
6. Validate with:
   - `npx tsx scripts/regenerate-manifest.ts`
   - `npm run validate`
   - `npx tsx scripts/check-spell-integrity.ts`
7. Log completion in the applicable rollup or batch doc, not in shared status tables, unless the current workflow explicitly requires a status update.

## When To Use This Doc

Use this file only when you are actually dispatching work to Jules from an IDE-side workflow. If you are working directly in this repo, go straight to:

- [`SPELL_MIGRATION_PROMPT.md`](./SPELL_MIGRATION_PROMPT.md)
- [`JULES_ACCEPTANCE_CRITERIA.md`](./JULES_ACCEPTANCE_CRITERIA.md)
- [`SPELL-WORKFLOW-QUICK-REF.md`](./SPELL-WORKFLOW-QUICK-REF.md)
