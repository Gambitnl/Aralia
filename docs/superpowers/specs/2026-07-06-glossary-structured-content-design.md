# Glossary structured content layer — design spec

**Date:** 2026-07-06
**Status:** APPROVED 2026-07-06 (Remy); **slice 1 BUILT 2026-07-06** — compiler, graph, and gate live at the end of `npm run glossary:rebuild` and as a vitest corpus gate; 0 issues over all 1,571 entries after the ingest pipe-corruption root-cause fix and the ~850-entry source cleanup. Decisions: one v2 bundle file; gate fails on ALL flaws from day one (no grandfathered baseline); source files get fixed, not permanently auto-repaired.
**Mission:** Replace the glossary's regex-and-`dangerouslySetInnerHTML` string pipeline with a typed content model, one link primitive, and a build-time validation gate.

## The problem in one paragraph

Every glossary rendering bug we have chased — unparsed headings, tables eaten by
adjacent HTML, dead inline links, borderless grids — has the same root cause:
each entry's markdown is re-parsed at click time by `marked`, patched with regex
(double-colon cleanup, `<hr/>` injection to stop table swallowing, corrupted
`[[token word]]` repair), sanitized, DOM-walked to wrap collapsible cards, and
finally injected with `dangerouslySetInnerHTML`. Five separate implementations
of "clickable term" sit on top of that. Fixing one bug means guessing which
regex to touch and hoping the other four surfaces don't regress.

## The fix in one paragraph

Parse each entry **once, at build time**, into a typed block tree. Validate it
there — broken cross-references, malformed tables, dirty tokens, and dead link
targets fail the build, not the render. Ship the compiled blocks plus a
precomputed cross-reference graph. Render blocks with real React components,
with a single `<GlossaryLink>` primitive carrying all link behavior. No parser,
no sanitizer, no regex, and no `dangerouslySetInnerHTML` in the render path.

---

## 1. Current state (what we're replacing)

Mapped 2026-07-06; file references are to the tree as of that date.

### Data
- **1,572 entry JSON files** under `public/data/glossary/entries/` — each holds
  `id`, `title`, `category`, `tags`, `excerpt`, `aliases`, `seeAlso`,
  `filePath`, and a raw `markdown` string (headings, GFM tables, `[[term]]` /
  `{{term}}` / `<g t="…">` link shorthands, and stray HTML).
- **Index files** under `public/data/glossary/index/` (671 rows) and a
  flattened **`public/data/glossary_bundle.json`** loaded once at startup by
  `src/context/GlossaryContext.tsx`.
- **Spells are special:** the glossary carries a manifest row with
  `hasSpellJson: true`; real spell data lives in
  `public/data/spells/level-{n}/{id}.json` and renders through
  `SpellCardTemplate` (already data-driven — mostly out of scope here).
- A **spell-referenced-rules enrichment file** is fetched at render time and
  appended to rule entries as a "Referenced By Spells" markdown section.

### Render path (the string pipeline)
`FullEntryDisplay.tsx` fetches the entry JSON, strips the H1, appends the
enrichment section, then `GlossaryContentRenderer.tsx`:
1. regex-expands three link shorthands into `<span data-term-id>` HTML,
   repairing corrupted tokens (`[[magic_initiate Initiate]]`) and possessive
   ids (`calligrapher_s_supplies`) along the way (lines 93–189);
2. collapses doubled colons; rewrites `---` to `<hr/>` so `marked`'s HTML-block
   rule doesn't swallow the table that follows (lines 218–228);
3. `marked.parse` + `DOMPurify.sanitize` (lines 230–231);
4. walks the resulting DOM to wrap H3 sections in `<details>` cards, manually
   preserving open/closed state across re-renders (lines 233–285);
5. injects via `dangerouslySetInnerHTML` and handles term clicks with a
   delegated listener reading `data-term-id` (lines 292–357).

### Link surfaces (five implementations of one idea)
1. Inline `<span data-term-id>` from the shorthand expansion — 3,842
   occurrences across 942 entries.
2. "See Also" footer chips in `GlossaryEntryTemplate.tsx` — 2,855 occurrences —
   with its **own copy** of the id-normalization logic.
3. `GlossaryPill.tsx` (spell tags, conditions, ability scores).
4. `GlossaryTooltip.tsx`-wrapped pills (hover excerpt + click navigate).
5. Auto rule-chips in `SpellCardTemplate.tsx`.

Only the inline surface knows whether a target actually loads (red styling);
the other four can render dead links.

### Validation today
- `.agent/scratch/glossary-render-audit.mjs` — replicates the pipeline over all
  non-spell entries and flags leftover markdown artifacts (leaked headings,
  bold, shorthand, tables, list markers). Throwaway script, not in CI.
- `scripts/audits/inventory-glossary-link-surfaces.ts` — counts redirect
  surfaces, writes `docs/tasks/glossary/GLOSSARY_LINK_SURFACES_INVENTORY.md`.
- No tests cover `GlossaryContentRenderer`, `FullEntryDisplay`, link
  resolution, or click delegation.

---

## 2. The content model

One TypeScript module owns these types: `src/systems/glossary/contentModel.ts`.
The compiler (build time) produces them; the renderer (run time) consumes them;
nothing else parses markdown.

```ts
/** A fully compiled glossary entry. */
interface GlossaryDoc {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  blocks: Block[];          // the body, in order
  schemaVersion: 1;
}

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: InlineNode[]; anchorId: string }
  | { kind: 'paragraph'; text: InlineNode[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'table'; caption?: string; header: InlineNode[][]; rows: InlineNode[][][] }
  | { kind: 'callout'; variant: 'note' | 'rule' | 'warning'; blocks: Block[] }
  | { kind: 'section'; title: InlineNode[]; defaultOpen: boolean; blocks: Block[] } // collapsible card (today's <details> wrap)
  | { kind: 'divider' }                                        // today's <hr>
  | { kind: 'referencedBy'; source: 'spells' | 'entries'; refs: TermRef[] }; // replaces the render-time enrichment append

interface ListItem { text: InlineNode[]; children?: ListItem[] }

type InlineNode =
  | { kind: 'text'; text: string; marks?: Mark[] }
  | { kind: 'termLink'; ref: TermRef; display: string; marks?: Mark[] }
  | { kind: 'extLink'; href: string; text: string };

type Mark = 'bold' | 'italic' | 'code';

/** A resolved cross-reference. The compiler guarantees `id` exists and is renderable. */
interface TermRef { id: string; kind: 'entry' | 'spell' }
```

Rules the model enforces by construction:
- **No raw HTML and no markdown strings anywhere.** If content needs a new
  visual, it gets a new block kind — never an escape hatch.
- **Every `termLink` is pre-resolved.** The compiler either resolves a token to
  a real, loadable entry or fails the build. "Red link" stops being a runtime
  style and becomes a build error. (During migration, a compiler flag can
  downgrade known-broken refs to warnings — see slice 1.)
- **Collapsible sections are structural**, decided by the compiler (H3 grouping
  today), not by DOM surgery after parse.
- **`referencedBy` is data**, emitted from the graph — the render-time
  enrichment fetch and markdown append are deleted.

### The cross-reference graph

A second build artifact, `public/data/glossary_graph.json`:

```ts
interface GlossaryGraph {
  nodes: Record<string, {
    title: string;
    category: string;
    renderable: boolean;      // has compiled blocks or spell JSON
    isGroupingNode: boolean;  // category/container rows — never clickable
  }>;
  // edge lists, deduplicated, both directions precomputed
  outbound: Record<string, TermRefWithSource[]>;  // what this entry links to
  inbound: Record<string, TermRefWithSource[]>;   // "Referenced By", for free
}
interface TermRefWithSource { id: string; via: 'inline' | 'seeAlso' | 'spellRule' }
```

This is what makes "Referenced By" real and bidirectional, keeps grouping nodes
unclickable everywhere, and is the query surface the stretch goal ("what rules
affect me this turn") builds on.

---

## 3. The compiler and the build gate

New script: `scripts/glossary/compile-glossary.ts` (tsx, run in the build and
in CI). Steps:

1. **Load** all entry JSON + indexes + spell manifests (same walk the audit
   script does today).
2. **Normalize** the source markdown with the pipeline's existing repairs, done
   once and recorded: doubled colons, corrupted `[[token word]]` shorthands,
   possessive ids, alias whitespace. Each repair is logged; the long-term goal
   is to fix the source files and delete the repair.
3. **Parse** with `marked.lexer` (tokens, never HTML) and map tokens →
   `Block[]` / `InlineNode[]`. Unknown or unmappable tokens are build errors,
   not silent passthrough.
4. **Resolve** every link token against the id/alias table; classify targets as
   renderable / grouping / missing.
5. **Build the graph** from inline links + `seeAlso` + the spell-referenced-
   rules enrichment data (which moves from render-time fetch to compile input).
6. **Validate** — fail the build on:
   - unresolvable or non-renderable `termLink` target,
   - malformed table (ragged rows, empty header),
   - leftover markdown artifacts in compiled text (port the seven detectors
     from `glossary-render-audit.mjs`, now run on the model, not on HTML),
   - renderable entry with zero meaningful blocks (the ~59 content-less
     entries),
   - `seeAlso` pointing at a grouping or missing node,
   - duplicate ids / alias collisions.
7. **Emit** `public/data/glossary_bundle.v2.json` (docs, minus raw markdown)
   and `public/data/glossary_graph.json`, deterministic output (stable key
   order) so diffs are reviewable.

CI wiring: a `glossary:compile` npm script; the Pages build runs it before
`vite build`; a vitest suite asserts the compiler is clean so local `npm test`
catches breakage too.

**Gate hardness (decided by Remy 2026-07-06):** every validation failure is a
hard build error from day one — no grandfathered baseline. Slice 1 therefore
includes fixing all flagged source content until the compiler runs clean.
This matches the no-fallback directive: one real path, fail honestly.

### Source of truth during and after migration

Markdown stays the **authoring format**; compiled blocks are the **shipping
format**. The 1,572 entry files are not hand-migrated wholesale — the compiler
is the migration — but flawed source files ARE fixed at the source (decided by
Remy 2026-07-06): corrupted link tokens, doubled colons, malformed tables, and
content-less entries get repaired in the entry JSON itself, so the compiler's
normalizer stays minimal and temporary repairs never become permanent
infrastructure.

---

## 4. The renderer

New components under `src/components/Glossary/blocks/`:

- **`GlossaryDocView`** — maps `Block[]` to components. Replaces
  `GlossaryContentRenderer` for compiled entries. No `marked`, no `DOMPurify`,
  no `dangerouslySetInnerHTML`, no delegated click listener.
- **`GlossaryTable`**, **`GlossaryCallout`**, **`GlossarySection`**
  (controlled `<details>` with state owned by React, killing the manual
  open-state DOM tracking), **`GlossaryDivider`**, **`ReferencedByBlock`**.
  Spacing and borders become one decision per component — the four demo fixes
  (hr spacing, empty-state message, table cell borders, HTML-adjacent tables)
  become that component's defaults plus a test each.
- **`GlossaryLink`** — the one primitive:

```tsx
<GlossaryLink termId="rage" variant="inline" | "pill" | "chip" tooltip>
  {display}
</GlossaryLink>
```

  It resolves through the graph (`renderable`? `isGroupingNode`?), renders the
  broken style when unresolvable (only reachable for runtime-supplied ids —
  compiled content can't produce one), renders plain text for grouping nodes,
  wires the hover excerpt when `tooltip` is set, and calls the navigation
  context. All five current surfaces become thin wrappers or direct uses:
  inline links (from `termLink` nodes), See Also chips, `GlossaryPill`,
  tooltip pills, and spell rule-chips. One edit to link behavior touches one
  file. `GlossaryEntryTemplate`'s duplicate normalization logic is deleted.

### What does NOT change
- The look. This is a re-plumb; visual output should be pixel-equivalent apart
  from the four already-approved demo fixes.
- `SpellCardTemplate`'s data-driven spell rendering (its rule-chips move onto
  `GlossaryLink`; its inline description text moves to compiled blocks in a
  late slice).
- `GlossaryContext`'s load-once bundle pattern; it just loads v2 + graph.
- Navigation flow (`onNavigate` → entry/path lookup) — though
  `findGlossaryEntryAndPath`'s recursive scan can later read the graph instead.

---

## 5. Slice order

Each slice lands independently behind the compiler gate, with the render audit
re-run and a visual eyeball (per the visual-inspection rule) before the next.

1. **Compiler + model + graph + source cleanup, no UI change.**
   Write `contentModel.ts`, the compiler, the validators, and the vitest
   suite. Emit v2 bundle + graph alongside the existing data. Promote the
   scratch render audit into `scripts/audits/` as a compiler sub-check. Fix
   every source file the gate flags (corrupted tokens, malformed tables,
   content-less entries, dead refs) until the compiler runs clean — the gate
   is a hard error from day one. *Proof:* compiler exits zero over all 1,572
   entries; CI runs it.

2. **Entry modal renders from blocks.**
   `GlossaryDocView` + block components; `SingleGlossaryEntryModal` /
   `FullEntryDisplay` path switches to compiled docs. The enrichment fetch is
   replaced by the `referencedBy` block. `dangerouslySetInnerHTML` leaves this
   path. *Proof:* the four demo-fix cases render correctly; side-by-side
   eyeball of a stratified sample (rules with tables, conditions, feats,
   races with images, an entry with collapsible sections).

3. **Three-pane browser onto the same renderer.**
   `Glossary.tsx`'s entry panel uses `GlossaryDocView`. Legacy
   `GlossaryContentRenderer` now has zero callers for non-spell content.
   *Proof:* browser eyeball + existing `Glossary.test.tsx` green.

4. **`GlossaryLink` unification.**
   Build the primitive on the graph; migrate See Also chips, `GlossaryPill`,
   tooltip pills, and spell rule-chips; delete the duplicated normalization.
   Grouping nodes stop being clickable on every surface at once.
   *Proof:* dead-link check on all five surfaces; character sheet, combat, and
   spellbook eyeball.

5. **Delete the string pipeline.**
   Remove `GlossaryContentRenderer`, the marked/DOMPurify usage in the glossary
   path, the render-time enrichment fetch, and the raw `markdown` field from
   the shipped bundle. *Proof:* grep shows no `dangerouslySetInnerHTML` under
   `src/components/Glossary/`; audit reports zero leftover-markdown and zero
   dead targets.

6. **Stretch (design only in this campaign): live game-state layer.**
   The model reserves the hooks now so nothing needs re-migrating later:
   `Block` gets an optional `appliesWhen?: RuleCondition` tag the compiler can
   populate from structured rule metadata, and the graph's query surface
   ("entries referencing condition X") is already the data needed for "what
   rules affect me this turn." No implementation in slices 1–5.

---

## 6. Decisions (resolved by Remy 2026-07-06)

1. **One v2 bundle file** (not per-entry files) — matches today's load-once
   pattern. Per-entry files remain possible later if startup weight becomes a
   problem.
2. **The gate fails on everything from day one** — no grandfathered baseline;
   slice 1 includes the source cleanup that makes the compiler pass.
3. **Fix the source files** — the compiler's normalizer stays minimal;
   repairs land at the true source, not as permanent render-time patching.
   Implementation note (found during slice 1): the entry JSON files are
   themselves generated by `npm run glossary:rebuild`
   (`scripts/ingestPhbGlossary.ts` reading `vendor/5etools-src/data`), so
   "fix the source" means fixing the ingest converter's markdown emission —
   corrupted `[[token word]]` shorthands, doubled colons, and malformed
   tables get fixed where they are produced. The new compiler becomes the
   final stage of `glossary:rebuild`, gating its own input.

## Done looks like (restated, testable)

- Zero `dangerouslySetInnerHTML` in the glossary render path.
- One `GlossaryLink` primitive and one `GlossaryDocView` renderer used by every
  surface (modal, three-pane browser, character/combat/spell inline).
- CI fails on a broken cross-reference, malformed table, dirty token, or
  content-less link target.
- Render audit: zero leftover-markdown, zero dead link targets, empty baseline.
