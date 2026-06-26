# Spell Runtime Template Audit Report

This report checks the strict spell conversion template across structured markdown and runtime JSON.

Generated: 2026-05-21T00:40:48.102Z
Spells scanned: 459
Total issues: 28
Errors: 0
Warnings: 28
Grouped issue families: 2

The normal spell validator can be green while this report is not. That means the game can load the JSON, but the spell corpus still has drift that can make conversion, targeting, conditions, or future runtime behavior unreliable.

## Grouped Issues

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Recurring Mechanics
- Occurrences: 14
- Sample spells: heroism, searing-smite, tashas-hideous-laughter, conjure-animals, enemies-abound, slow, confusion, elemental-bane, conjure-elemental, contagion, tree-stride, wall-of-light
- Sample messages:
  - Heroism uses "Recurring Mechanics", which is not registered in the strict template vocabulary yet.
  - Searing Smite uses "Recurring Mechanics", which is not registered in the strict template vocabulary yet.
  - Tasha's Hideous Laughter uses "Recurring Mechanics", which is not registered in the strict template vocabulary yet.
  - Conjure Animals uses "Recurring Mechanics", which is not registered in the strict template vocabulary yet.
  - Enemies Abound uses "Recurring Mechanics", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Recurring Mechanic Timing
- Occurrences: 14
- Sample spells: heroism, searing-smite, tashas-hideous-laughter, conjure-animals, enemies-abound, slow, confusion, elemental-bane, conjure-elemental, contagion, tree-stride, wall-of-light
- Sample messages:
  - Heroism uses "Recurring Mechanic Timing", which is not registered in the strict template vocabulary yet.
  - Searing Smite uses "Recurring Mechanic Timing", which is not registered in the strict template vocabulary yet.
  - Tasha's Hideous Laughter uses "Recurring Mechanic Timing", which is not registered in the strict template vocabulary yet.
  - Conjure Animals uses "Recurring Mechanic Timing", which is not registered in the strict template vocabulary yet.
  - Enemies Abound uses "Recurring Mechanic Timing", which is not registered in the strict template vocabulary yet.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md","sha256WithoutMarker":"b794a846054549e7bd88565ff9b0ac8b8eba62c5289079b62c720ffb15cda76c","markedAtUtc":"2026-06-25T22:29:38.556Z"} -->
