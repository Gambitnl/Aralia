# Spell Alignment Arbitration Ledger

Last Updated: 2026-03-20

This ledger records spell-alignment mismatches that need arbitration or that were already arbitrated.

The point of this file is not to treat every mismatch as equally urgent. The point is to make sure every mismatch is captured somewhere durable, so repeated patterns can be discovered and handled in grouped passes instead of being rediscovered one spell at a time.

## Working Rule

- record all meaningful mismatches
- group recurring mismatch families where possible
- prioritize larger grouped patterns before isolated one-off mismatches
- do not silently let JSON, markdown, validator, or runtime behavior "win" when the mismatch affects modeling, semantics, or completion claims
- use group keys to spot the same problem across many spells before drilling into isolated cases

## Suggested Statuses

- `open`
- `grouped`
- `arbitrated`
- `accepted-adaptation`
- `fixed`

## Suggested Mismatch Families

- `markdown-vs-json`
- `json-vs-validator`
- `json-vs-phb`
- `runtime-vs-data`
- `workflow-doc-vs-current-schema`

## Record Template

Use one entry per mismatch unless it is clearly part of an already tracked grouped family.

### Required Fields

- `id`
- `status`
- `family`
- `group_key`
- `spell`
- `field_or_mechanic`
- `source_a`
- `source_b`
- `mismatch_summary`
- `why_it_matters`
- `arbitration_needed`
- `resolution`

### Recommended Group-Key Shape

Use:
- `mismatch family / field_or_mechanic`

Examples:
- `markdown-vs-json / effects[].type`
- `json-vs-validator / targeting.validTargets`
- `json-vs-phb / Goodberry healing model`

Guiding principle:
- group by repeated mismatch pattern first
- do not group by spell name first unless the issue is truly unique to that one spell

### Optional Fields

- `notes`
- `links_to_related_entries`
- `phb_reference`
- `runtime_evidence`
- `introduced_by`
- `date_detected`

### Entry Template

- `id`:
- `status`:
- `family`:
- `group_key`:
- `spell`:
- `field_or_mechanic`:
- `source_a`:
- `source_b`:
- `mismatch_summary`:
- `why_it_matters`:
- `arbitration_needed`:
- `resolution`:
- `notes`:

## Current Entries

### Entry 001

- `id`: `spell-align-001`
- `status`: `fixed`
- `family`: `json-vs-validator`
- `group_key`: `json-vs-validator / source`
- `spell`: `all-spells`
- `field_or_mechanic`: `source`
- `source_a`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `source_b`: `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- `mismatch_summary`: `The isolated spell schema validator now runs successfully, and the first repo-wide failure is that the validator requires a top-level source field while the current spell JSON files do not provide one. The current grouped impact is 469 invalid spell files out of 469 scanned.`
- `why_it_matters`: `This blocks honest schema-validation completion for the whole spell dataset and is large enough that it should be handled as one grouped arbitration bucket rather than as hundreds of separate spell fixes. It is also a clean example of why the validator, JSON, and later markdown parity work must be treated as separate implementation layers.`
- `arbitration_needed`: `Yes. The project needs to decide whether source should become a required field in all spell JSON files, whether the validator requirement should be relaxed or made optional, or whether the field should be derived elsewhere instead of stored per spell.`
- `resolution`: `Arbitrated on 2026-03-20: the top-level source field is deprecated and should be removed from the live validator rather than reintroduced into every spell JSON file. The validator was updated accordingly.`
- `notes`: `Detected on 2026-03-20 by the repaired isolated validator path in F:\Repos\Aralia\scripts\validateSpellJsons.ts using npm run validate:spells. After removing the dead source requirement from F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts, npm run validate:spells reported 469 valid / 0 invalid.`

### Entry 002

- `id`: `spell-align-002`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Status`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Status`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `The spell reference markdown files exposed a structured Status field, usually set to Complete, even though the live spell JSON parity layer contains no matching status field.`
- `why_it_matters`: `Status is workflow/progress metadata rather than spell-truth data. Leaving it in the structured spell fact block mixes project state with spell facts and makes the reference docs look more authoritative than the parity layer can support.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: remove Status from the spell reference markdown files entirely rather than keeping it as a structured parity field.`
- `notes`: `Bulk removal was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 003

- `id`: `spell-align-003`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Source`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Source`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `The spell reference markdown files exposed a structured Source field, typically a PHB citation like "PHB 2024 p.xxx", even though the live spell JSON parity layer contains no matching source field.`
- `why_it_matters`: `Source citations may still be valuable reference information, but they are not backed by the live spell JSON parity layer. Keeping them in the structured spell fact block makes them look like parity data instead of separate provenance metadata.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: remove Source from the spell reference markdown files entirely rather than keeping it as a structured parity field.`
- `notes`: `Bulk removal was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 004

- `id`: `spell-align-004`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Utility Type`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Utility Type`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `Many spell reference markdown files omitted Utility Type even though the primary JSON effect was UTILITY and already carried a concrete utilityType value.`
- `why_it_matters`: `UTILITY by itself is too broad to preserve trustworthy spell-reference parity. The subtype carries meaningful structure for human interpretation, parity validation, and later roadmap modeling.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: whenever the relevant JSON effect is UTILITY, the spell reference markdown must include Utility Type and mirror the exact JSON utilityType value.`
- `notes`: `Bulk backfill was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 005

- `id`: `spell-align-005`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / missing reference body`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `missing reference body`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `A subset of spell reference markdown files were zero-byte placeholders rather than real structured spell reference docs. Because those files had no body at all, they generated broad downstream parity failures for fields like Effect Type, Utility Type, Duration, and targeting even when the matching JSON files already contained the necessary data.`
- `why_it_matters`: `Blank reference docs are a parent issue rather than an isolated field mismatch. They prevent honest parity reporting because the collector cannot distinguish between true modeling drift and the absence of any spell reference body at all.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: blank or structurally missing spell reference docs may be regenerated directly from verified JSON rather than waiting for manual per-spell rewrites.`
- `notes`: `A dedicated regeneration script was added at F:\Repos\Aralia\scripts\regenerateBlankSpellReferenceDocs.ts and used to rebuild 23 zero-byte spell reference docs. After a clean rerun of npm run validate:spell-markdown, the mismatch surface dropped from 1057 mismatches in 31 grouped buckets to 637 mismatches in 23 grouped buckets.`
