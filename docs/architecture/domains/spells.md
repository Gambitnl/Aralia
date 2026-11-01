# Spells

Verified: 2026-10-29 (outside-combat preparation lifetime/speed path; other lanes retain their earlier verification)

## Purpose

The Spells domain covers spell data, validation, loading, translation into executable abilities, targeting support, effect execution, and spell-facing UI surfaces.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/systems/spells/
- src/types/spells.ts
- public/data/spells/
- public/data/spells_manifest.json
- src/hooks/useSpellGateChecks.ts
- src/services/SpellService.ts
- src/context/SpellContext.tsx
- src/utils/character/spellAbilityFactory.ts

## Current Domain Shape

The domain currently includes these active lanes:
- targeting systems under src/systems/spells/targeting/
- validation and schema under src/systems/spells/validation/ and src/systems/spells/schema/
- mechanics such as concentration and related spell execution support under src/systems/spells/mechanics/
- AI-assisted spell support under src/systems/spells/ai/
- spell JSON data and manifest files under public/data/
- React consumers through spellbook, glossary, character, and combat-facing surfaces
- composite area-trigger routing through src/hooks/spellEffectUtils.ts,
  src/commands/factory/SpellCommandFactory.ts, and
  src/systems/spells/effects/triggerHandler.ts; specialized controlled-entity
  and initial-cast branches remain separate runtime paths

## Boundaries And Constraints

- Spell JSON remains the primary runtime data lane for spell definitions.
- Validation and schema checks matter because downstream systems assume structured spell fields exist.
- The spell domain is data-driven, but not fully free of hybrid legacy behavior; some translation still falls back to description parsing.
- Gate-check and fidelity tooling still bridge between code/data truth and older migration-gap documentation.

## Historical Drift Corrected

The older version of this file drifted in several ways:
- it pointed at src/utils/character/spellAbilityFactory.ts instead of the current src/utils/character/spellAbilityFactory.ts path
- it presented the spell JSON lane as a cleaner single-source-of-truth story than the broader migration workflow currently supports
- it implied migration percentages and progress states that are no longer trustworthy without a fresh count

## What Is Materially Implemented

This pass verified that the following are materially present:
- manifest-driven spell loading
- schema and runtime validation
- spell gate checking
- spellbook UI integration
- spell-to-ability translation
- multi-effect command creation support
- large-scale per-level spell JSON coverage across the manifest and level folders

## Open Follow-Through Questions

- Which spell execution paths still rely on silver-standard description parsing instead of fully structured effect handling?
- Which spell gap documents remain live inputs versus purely historical migration records?
- Which spell-facing docs should remain active reference surfaces versus preserved migration history?

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/spells.md","sha256WithoutMarker":"22c0799fbce8736b6fe5733ca0dee90c431a0502cbc243019525b3ca57ae27d7","markedAtUtc":"2026-08-09T20:14:15.941Z"} -->

## Runtime authoring and delivery

Individual definitions in `public/data/spells/level-N/id.json` are the authoring authority for runtime artifacts. Canonical prose and structured migration documents remain reference and audit inputs; this pipeline does not replace that migration work.

The manifest and bundle in `public/data`, `src/data/racialSpellSubset.generated.json`, and `src/data/classes/spellLists.generated.ts` are derived outputs. Do not edit these independently.

- Run `npm run spells:generate` after changing definitions or racial spell grants.
- Run `npm run spells:check` for read-only schema, path, reference, and artifact consistency checks. Build preparation runs this check before generating other assets.
- Generation rejects invalid sources before updating the manifest, bundle, or preview subset. It preserves authored extension fields and skips writes when JSON content already matches.
- Nine known unresolved racial references remain reported debt; new missing references fail the pipeline. See [Spells gaps](../../projects/spells/GAPS.md).

The static delivery choice and alternatives are recorded in [ADR 0005](../../adr/0005-spell-data-authoring-and-delivery.md). Existing browser URLs remain unchanged.


## Outside-combat preparation and world-clock status

The existing Spellbook controls and handleResourceActions casting path own
downtime resource use. outOfCombatCasting still builds ordinary StatusEffect
records. An explicitly timed lasting cast now also records numeric game-clock
applied/expiry dates in StatusEffect.worldTime; until-dispelled effects keep
their existing lifecycle. This adds no wall-clock timer or separate spell store.

Longstrider retains its authored UTILITY/other JSON and source identity. A narrow
exact-ID bridge supplies its existing promised+10ft speed rider while the corpus
migration remains unfinished. No manifest, bundle, generated subset or canonical
prose is rewritten. Other names-only utility markers do not thereby become
implemented Light targets, world lights, summons or other mechanical benefits.

worldReducer's existing ADVANCE_TIME boundary calls advanceWorldTimedEffects.
Walking, ordinary waits, recovery and the existing six-second combat-round
callback already reach that clock. Explicit expiry removes only timed records;
remaining rounds are derived from the original deadline. No health, Hit Dice,
slots, position, permanent conditions, injuries or other consequences are reset.

The exact old generated Longstrider condition marker may be reconciled only when
its same caster and retained system cast event provide the original game-time
cause. Its ID, type, source, description and untouched600-round marker must match.
Unknown/custom, already-counted, future-event or player-authored records remain
under their existing owner. A validated expired cast is removed; loading never
grants another hour, restores a slot or repeats casting.

movementSpeedEffects extracts the existing flat-stat and legacy movement riders
for shared arithmetic. Overlapping Longstrider sources remain distinct records
but grant one strongest bonus. Tactical movement uses that shared sum. Party
pace reads only explicitly world-timed riders, leaving untracked combat-turn
statuses under their existing lifecycle. The sheet and free-roam pace use the
same pre-exhaustion value; existing exhaustion then applies without rewriting
the saved base speed or hiding its explanation.

This candidate follows actual Eldrin failure: one normal09:04:10 cast spends a
slot but leaves sheet/calculatedSpeed30ft and pace1.524m/s, with a condition-only
marker. The paid cast/original event/current feet/unused bed are saved normally
at09:04:49; all five older named payloads are exact. No refund, second cast or
manual state patch is made. Actual replay now shows Speed 40 ft in the rendered
sheet and calculated movement, with configured ground pace 2.032 m/s. The
original cast event anchors the unchanged 10:04:10 deadline; the spent slot stays
at 1/2. Ordinary movement advances the same body 5.994 m along the bank.

The normal working-travel-spell Chronicle saves at 09:07:15 and explicitly
loads after a full document reload at 09:07:48. Of 24 captured groups, 23 remain
exact; only the party's remaining spell duration changes by those 33 seconds.
All seven older manual/default payloads remain byte-identical. Base speed,
source/cast event, deadline, slots, supplies, equipment, money, accepted feet,
unused paid lodging and consequences are preserved. Rest/lodging dialogs stay
closed. Actual expiry and the subsequent paid-bed recovery remain pending.

Support:113 distinct affected cases in eight suites pass;17 scoped files report
0 errors/0 suppressed diagnostics. One new text assertion and one shared modifier
type boundary were corrected before acceptance. The relevant48 speed cases then
pass again (overlapping, not additional). One header wave7updated/2current/
8tests outside graph leaves90 dependents unwritten. Audits retain all13 prior
file bodies outside27 intended patches and all17 code/leading-doc/EOL bodies
outside the header changes. Source leases are released; the separate reaction
eligibility guard owner coordinates before the fresh native replay.

The gameplay-flow Tracker/GF-G33 and rest-and-recovery domain hold current task
status. Temporary receipts remain in ignored rest scratch, including the actual
cast failure, retained-travel-cast-save proof and source/header preservation.
