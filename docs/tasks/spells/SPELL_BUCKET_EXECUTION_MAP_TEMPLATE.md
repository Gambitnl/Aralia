# Spell Bucket Execution Map — Authoring Template

This document explains how to add a new execution map to the **Spell Pipeline
Atlas** (`misc/spell_pipeline_atlas.html`). An execution map is the per-bucket
"what to actually do, in what order" view the Atlas shows when you click a
bucket row on the Dashboard (Shape C).

## Who this is for

You need this doc when:

- a bucket's tracker has enough structure to name its mismatch families, and
- the Atlas still shows `stub` in the `Map` column for that bucket.

You don't need this doc for:

- authoring a tracker from scratch — use the existing tracker docs as precedent
  (e.g. `docs/tasks/spells/sub-classes/SPELL_SUB_CLASSES_BUCKET_TRACKER.md`)
- changing the Atlas UI itself — that lives in
  `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.

## Where the map lives

Every execution map is a plain TypeScript constant in:

```
src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx
```

There is no database, no MDX, no JSON. The hand-authored narrative IS the
source of truth. The matrix (Shape B) and dashboard (Shape C) are the dynamic
parts; the execution map (Shape A) is intentionally hand-written because the
ordering and the policy wording matter.

## Data shape (what you're filling in)

The full type is declared in `PreviewSpellDataFlow.tsx`. Shortened:

```ts
type EdgeCaseStatus = 'resolved' | 'in-progress' | 'open' | 'policy';
type StepStatus     = 'active'   | 'done'        | 'queued';
type StepKind       = 'mismatch families' | 'closure steps' | 'follow-up tasks';

interface EdgeCase {
  label: string;          // short identifier of a sub-pattern
  count?: string;         // '?' is fine when unknown
  status: EdgeCaseStatus;
  note?: string;          // one sentence, plain English
}

interface ExecutionStep {
  order: number;          // 1-based, continuing across phases (1..N)
  subbucket: string;      // snake_case; matches the tracker's family name
  count: string;          // '12 spells' | '0 live' | 'on demand' | '—'
  action: string;         // imperative, one sentence: "do this"
  doneWhen: string;       // one sentence: what success looks like
  status: StepStatus;     // exactly one step per bucket should be 'active'
  edgeCases?: EdgeCase[]; // only when the tracker surfaces distinct patterns
}

interface PhaseBlock {
  phase: string;          // "Phase 1 — canonical → structured"
  phaseNote: string;      // one sentence orientation
  color: string;          // border-emerald-500 | border-sky-500 | border-amber-500
  stepKind: StepKind;     // P1/P2 use 'mismatch families'; P3 uses closure/follow-up
  steps: ExecutionStep[];
}
```

## Conventions

**Phase colors are fixed:**

| Phase | Color class |
| --- | --- |
| Phase 1 — canonical → structured | `border-emerald-500` |
| Phase 2 — structured → json      | `border-sky-500`     |
| Phase 3 — closure / follow-up    | `border-amber-500`   |

**Exactly one step should be `active` per bucket** — the one you'd pick up right
now. Everything else is `queued` or `done`. If the bucket is genuinely idle,
leave no step active.

**`subbucket` names match the tracker.** If the tracker calls a family
`missing_structured_subclasses`, don't rename it to `missing-subclasses` here.
Keep it `snake_case`.

**`count` is a human string, not a number.** Prefer `"12 spells"` over `"12"`.
For non-spell-count phases use `"—"`, `"on demand"`, `"0 live"`, `"schema move"`.

**`action` is imperative, `doneWhen` is declarative.** Read them as a pair:

> do: _Insert a `- **Sub-Classes**: ...` line with roster entries._
> done when: _Every listed spell has a Sub-Classes line whose entries are all
> in SPELL_SUPPORTED_SUBCLASS_ROSTERS.md._

**Use edge cases sparingly.** Only add `edgeCases` when the tracker actually
enumerates discovered sub-patterns within a family, not just to add visual
depth. Policy decisions (e.g. "canonical uses `**`, structured uses a
normalized footnote") go in edge cases with `status: 'policy'`.

**Glossary-term pills are automatic.** Writing _residue_, _drift_, _boundary_,
or _runtime_ anywhere in an `action`, `doneWhen`, `phaseNote`, or edge-case
`note` automatically wraps the word in the Aralia glossary pill with a
definition tooltip. Don't add HTML — just write the word.

## How to add a map (step-by-step)

1. Open `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.
2. Copy the `EMPTY_BUCKET_EXECUTION` constant (it's right above
   `EXECUTION_BY_BUCKET`). Paste it, rename to e.g. `DURATION_EXECUTION`.
3. Fill in `phaseNote`, `steps[]`, and `edgeCases[]` from the tracker.
   - Remove any Phase 3 block if the tracker has no closure tasks.
   - Keep Phase 2 even if it has `steps: []` — it signals "pipeline exists,
     nothing live right now".
4. Register the map:
   ```ts
   const EXECUTION_BY_BUCKET: Record<string, PhaseBlock[]> = {
     'Sub-Classes': SUB_CLASSES_EXECUTION,
     'Components':  COMPONENTS_EXECUTION,
     'Duration':    DURATION_EXECUTION,   // ← new
   };
   ```
5. Dev-run the atlas (`npm run dev`, open `/Aralia/misc/spell_pipeline_atlas.html`)
   and click the bucket row. The `Map` column should flip from `stub` to
   `authored`.

## Deep-linking

The atlas reads `?tab=` and `?bucket=` from the URL on load. When authoring,
you can jump straight to a specific bucket's map with:

```
/Aralia/misc/spell_pipeline_atlas.html?bucket=Duration
```

Dropping the link into a tracker doc is a nice way to point collaborators at
the current shape of a bucket.

Valid `tab` values: `dashboard`, `matrix`, `all`. Valid `bucket` values are
whatever appears in `BUCKET_META` in `PreviewSpellDataFlow.tsx`.

## Keeping maps honest

- If a tracker's `0 spells` count drops to 0 for a family, mark that family's
  step `done`. Don't delete it — the history is useful.
- If the tracker splits a family in two, split the step. Renumber `order`.
- Closure tasks (Phase 3) only belong on buckets where Phase 1 and Phase 2 are
  empty. Otherwise they're forward-looking notes, which belong in a
  `follow-up tasks` phase instead.
