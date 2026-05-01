# Spell Damage Type Bucket Tracker

> Bucket opened 2026-05-01. Inventory and chooser-shape **recommendation**
> landed 2026-05-02 (v4 follow-up). Parity scripts still **not authored**.

## Bucket Purpose

Track parity for the **damage type token** of damage-dealing spells
across the three pipeline layers:

1. **Canonical** (`docs/spells/reference/`) - the raw extract.
   Damage type appears in narrative prose ("...takes 6d6 fire
   damage...") and sometimes in a `Damage/Effect:` line in the
   canonical HTML-comment snapshot block.
2. **Structured md** (same files) - normalized to a single token
   field: `- **Damage Type**: <token>`. Tokens are typically
   single-word (`Acid`, `Cold`, `Fire`, `Force`, `Lightning`,
   `Necrotic`, `Poison`, `Psychic`, `Radiant`, `Thunder`,
   `Bludgeoning`, `Piercing`, `Slashing`).
3. **Runtime JSON** (`public/data/spells/`) — primary field
   `effects[i].damage.type` as a string token **when** singleton;
   composite cases move to `damage.typeSelection` /
   `damage.typeResolution` once migrated (see below).

The bucket converges these to a single representation in the JSON
template end state.

## Headline issue — composite damage type strings

Some spells let the caster pick a damage type from a set at cast
time. The **canonical narrative** spells this out clearly ("X, Y, Z,
or W damage (your choice)"); the **structured layer currently stores
this as a slash-glued string** (e.g.
`Acid/Cold/Fire/Lightning/Thunder`); the **runtime JSON pipes that
string straight through** as `damage.type`. The runtime can't
dispatch on a slash-glued string as a damage type, so the shape is
silently broken for these spells.

**Seed example**: `glyph-of-warding` (level 3).

- canonical narrative (line 30 of the .md file): *"5d8 Acid, Cold,
  Fire, Lightning, or Thunder damage (your choice when you create
  the glyph)"*
- structured (line 29): `- **Damage Type**: Acid/Cold/Fire/Lightning/Thunder`
- runtime JSON: `effects[0].damage.type: "Acid/Cold/Fire/Lightning/Thunder"`

### Runtime inventory (funnel)

Authoritative **machine-generated** list:

- [`SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md`](./SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md) — produced by
  `node scripts/inventory-spell-damage-runtime.mjs`

**Funnel (re-run script to refresh):**

1. **459** spell JSON files under `public/data/spells/level-*`.
2. **312** have **no** `DAMAGE` effect at all (buffs, summons without a DAMAGE row, utility, etc.).
3. **147** have ≥1 `DAMAGE` effect; of those **135** use only **non-empty single known tokens** on every DAMAGE row (these are **out of scope** for composite-type work).
4. **12** **remainder** — any DAMAGE row with **empty** `damage.type` **or** a string **not** in the PHB-like allowlist (slash lists, prose, `variable`, …). **Start here** for `typeSelection` / multi-effect fixes.

The 12 IDs: `absorb-elements`, `chromatic-orb`, `conjure-elemental` (`type="variable"`),
`conjure-minor-elementals`, `dragons-breath`, `elemental-weapon`, `fire-shield`,
`glyph-of-warding`, `hunger-of-hadar`, `illusory-dragon`, `prismatic-spray`,
`spirit-guardians`.

**False negative:** Spells whose damage exists only in narrative or summons (e.g. `elemental-bane`)
sit in bucket (2); they never hit the DAMAGE-type funnel until modeled.

**Not in DAMAGE pipeline:** `find-steed` has **no** `DAMAGE` effect; `Celestial/Fey/Fiend` lives on
`summon.statBlock.type`, which is a **creature-type hint**, not `damage.type` — still wrong shape for
summon metadata, separate cleanup.

### Inventory — structured reference (`- **Damage Type**:`) slash patterns

Slash-glued lines (matches `docs/spells/reference/**/*.md`):

- `chromatic-orb`, `dragons-breath`, `elemental-weapon`, `glyph-of-warding`, `hunger-of-hadar`, `spirit-guardians`

`absorb-elements` has no `- **Damage Type**:` row (damage type is contextual).

---

## Resolved design direction (chooser + composites)

**Adopt structured fields orthogonal to single-token spells** so scanners can
classify rows without substring heuristics on `/` or commas.

### Runtime JSON (`effects[].damage`)

1. **`type`** remains a **single** string token (PascalCase: `Fire`, `Cold`,
   …) **only** when the effect has exactly one intrinsic damage energy type.

2. For **caster pick one of a fixed set at cast time** (orb / glyph /
   elemental weapon / dragons breath / spirit guardians / shield mode /
   illusory dragon breath / conjure-minor elemental strike, etc.):

   ```json
   "damage": {
     "dice": "3d8",
     "typeSelection": {
       "kind": "one_of",
       "options": ["Acid", "Cold", "Fire", "Lightning", "Poison", "Thunder"]
     }
   }
   ```

   Omit `type` **or** set `type` to `null` for that effect (`zod`/TS must
   allow optional `type` when `typeSelection` is present). Downstream damage
   code must branch on `typeSelection`, not on glued strings.

3. For **follows triggering event** (absorb elements extra damage):

   ```json
   "typeResolution": "triggering_damage_type"
   ```

   …with **`type`** omitted — or a dedicated `kind` on `typeSelection`:
   `{ "kind": "triggering", "allow": ["Acid","Cold","Fire","Lightning","Thunder"] }`
   if the allowed set matters mechanically.

4. **Multi-effect timings** (`hunger-of-hadar`): prefer **multiple DAMAGE
   effects** (cold vs acid) plus notes/scaling linkage instead of one
   glued `Cold/Acid` string.

5. **wrong-axis summon fields** (`find-steed`): `summon.statBlock.type` abuses a
   slash string for celestial/fey/fiend choice — not `damage.type`, but belongs
   in summon modeling, not a damage-token field.

Random multi-type (`prismatic-spray`): treat under a future **weighted /
ordered / table** subbucket (not `one_of`).

### Structured markdown (parallel)

For chooser rows, replace slash glue with explicit fields, e.g.:

```markdown
- **Damage Type Selection**: one_of
- **Damage Type Options**: Acid, Cold, Fire, Lightning, Poison, Thunder
```

…or equivalent machine-friendly list aligned with runtime `options`.

**Why not** `damage.type` as `{ kind, options }` for all spells?
Mass migration of every SPELL row; validators and content tools expect a plain
string today. Keeping `type` only for singletons minimizes churn while
parity scripts whitelist `typeSelection`/`typeResolution`.

Scripts should normalize canonical prose (“or”, commas, slashes) onto the same
canonical option list **before** diffing.

## Current Status

- Bucket added: 2026-05-01
- Runtime funnel inventory: **automated** in
  [`SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md`](./SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md)
- Recommended chooser/composite schema: **documented** (`typeSelection` /
  `typeResolution`; multi-effect for hunger-of-hadar)
- Phase 1 (canonical -> structured) parity script: **not authored**
- Phase 2 (structured -> runtime JSON) parity script: **not authored**
- Inventory count of strictly single-token damage-dealing spells: **deferred**
  to script roll-up (estimate: bulk of corpus minus rows above plus empty /
  specials)

## Subbuckets - candidates (refine counts when scripts land)

The Atlas execution map currently carries placeholder subbuckets
(`land_damage_type_canonical_parity_script` in P1,
`land_damage_type_runtime_parity_script` in P2). After the parity
script lands and the inventory pass produces a count, replace the
placeholders with real subbuckets - likely candidates:

- `single_token_damage_type_clean` (most damage-dealing spells)
- `chooser_damage_type_one_of` (orb, glyph, dragons breath,
  elemental weapon, spirit guardians, fire shield mode, illusory dragon,
  conjure minor elementals slam, …)
- `triggering_damage_type` (`absorb-elements` extra strike)
- `multi_effect_damage_timing` (`hunger-of-hadar`; split DAMAGE rows)
- `random_or_table_damage_type` (`prismatic-spray`; not `one_of`)
- `taxonomy_mismatch_summon_field` (`find-steed`; creature-type glued string on
  `summon.statBlock.type`, no `DAMAGE` row)
- `legacy_missing_damage_effect` (`elemental-bane` JSON shape)
- `missing_damage_type_field` (damage in prose but no structured /
  typed effect)
- `non_damage_dealing` (no damage; field should stay empty/absent)

## Per-Phase Plan

### Phase 1: canonical -> structured

1. **Chooser/composite shape** — **recommended** schema documented
   above; lock in during implementation (`typeSelection`,
   `typeResolution`, markdown `Damage Type Options`).
2. **Author / extend canonical-audit script** to compare structured
   `Damage Type` against canonical narrative. Should detect: present
   in canonical but absent in structured, present in structured but
   absent from canonical narrative, type mismatches, chooser-shape
   mismatches.
3. **Run inventory pass**. Record the count.
4. **Classify subbuckets**. Replace Atlas placeholders.
5. **Update this tracker** as the inventory takes shape.

### Phase 2: structured -> runtime JSON

Blocked on Phase 1 per Gap 15. Once Phase 1 closes:

1. Author / extend structured-vs-runtime parity script that compares
   structured damage-type fields against runtime `effects[i].damage`
   (`type`, `typeSelection`, `typeResolution`, multi-effect rows).
2. Run inventory, classify subbuckets, update this tracker.

## Notes

- Damage Dice (`5d8`, `1d4 + 1`) is a related but separate field;
  out of scope for this bucket unless the parity script bundles
  them. If bundled, capture as an `overlapsWith` relation.
- Higher-level scaling ("damage increases by 1d8 for each spell
  slot level above 3rd") lives on the Higher Levels bucket; out of
  scope here.
- Saving throws and damage application logic live in the runtime
  damage-resolution code, not in this bucket.
