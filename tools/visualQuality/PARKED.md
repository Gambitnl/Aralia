# Entity quality campaign — PARKED 2026-08-12

Remy parked this campaign to focus on the img2threejs evaluation. Everything below is
the state at the moment of the pause. Read `CAMPAIGN.md` for the operating contract.

## Score at the pause

| subject | standing |
|---|---|
| dwarf-fighter | **credible TIE** vs the WoW grunt, twice (r21, r22). The reference standard — never regress. |
| human-fighter | closed most of its gap (r22); no longer the outlier. |
| orc-barbarian | now the WEAKEST humanoid. |
| elemental-large | closest creature on the wall (r24), "the round's real progress". |
| dragon head sculpt, serpent face | tie the references. |
| everything else | loses. |

Last verdicts: `humanoid-anatomy` round 22, `creature-anatomy` round 24. Round-25 creature
sheets are captured but were NEVER JUDGED — its critic was stopped mid-run.

## In flight when parked

- **humanoid round 23** (builder, stopped mid-edit): shoulder girdle "grown not bolted"
  (trapezius ramp neck-to-shoulder, lat flare under the armpit, kill the deltoid ink ring),
  three regression checks (feet, grip hands, orc face), the orc's missing neck/waist/knee
  events, and the top-panel framing bug. Its uncommitted edits are in the working tree —
  it was mid-way through "toe splay, in both files". SURVEY THE TREE BEFORE RESUMING.
- **creature round 25** (critic, stopped at the start): re-run it against the seven
  round-25 sheets. Nothing of its work is lost.

## Open items, ranked

1. Humanoid: the round-23 gap above; the orc is the ship-blocker.
2. Creature: judge round 25, then the beast's head — it cranes nose-to-sky in every panel
   (flagged by the round-25 builder, not yet critic-named).
3. Protocol: fresh critics disagree about previously praised features (feet, grip hands,
   orc face). Either those regressed or the critic pool lacks a fixed rubric. Round 23 was
   sent to determine which. UNRESOLVED — and it decides whether the loop is trustworthy.
4. The `STRUCTURAL-FIRST` rule was added late (see CAMPAIGN.md). Rounds before it patched
   surface where the blockout was wrong; that is the leading theory for why 25 rounds of
   incremental fixes disappointed.

## Decided while parked — element subtypes (Remy, 2026-08-12)

Today `CreatureType.Elemental` always produces an EARTH elemental: `creaturePlans.ts` hardcodes
`surface: 'rock'` and there is no subtype axis anywhere in the generator.

**Remy chose: a SECOND DROPDOWN next to Type and Size, shown only for types that have subtypes.**
Not an `optgroup`, not a custom cascading menu. (A native `<select>` cannot do a real flyout
submenu; `optgroup` only gives a non-selectable heading.)

Not built yet — deliberately deferred so it does not collide with humanoid-r23's stopped edits.
When it is built it touches: `creaturePlans.ts` (subtype axis in the Elemental case),
`creatureProfiles.ts` (per-element palettes and surfaces), `PreviewEntityDebug.tsx` (the dropdown
plus a query param), and `tools/visualQuality/capture.mjs` (a judged subject per element).
The 14 references and per-element rules are in `.agent/critique-refs/elementals/`.

NOTE on img2threejs: its output is a TypeScript factory for ONE model matched to one reference —
it does NOT belong in the archetype dropdown, which produces procedural rolls from
(type, size, seed). The existing slot for one-off models is the FIXTURE path (`?fixture=dragon`).

## Corrections to the record

The wing fold was NEVER broken. `groundedWingFold()` returns 1 at idle and 0 at speed, so
idle folds and walk spreads as designed. A round-24 probe read the debugger's default WALK
state and wrongly reported "the folded blade never renders"; that claim reached Remy as fact
before being disproved. Lesson recorded in CAMPAIGN.md.

## Infrastructure fixed during the campaign (keep)

- `vite.config.ts` pre-bundles GLTFLoader, SkeletonUtils, BufferGeometryUtils. The wedged
  "504 Outdated Optimize Dep" dev server was lazy dep discovery, NOT the watcher — WF-G61
  was misattributed and builders no longer need private Vite ports.
- `capture.mjs` gained `--retries`, `--goto-timeout`, `--base`/`ENTITYQ_BASE`, per-subject
  `action` pinning, and BOM-tolerant status reads.
- The judged creature set grew to seven sheets: 3 fixtures + beast/celestial/elemental
  archetype rolls + the dragon's spread-wing walk state.
