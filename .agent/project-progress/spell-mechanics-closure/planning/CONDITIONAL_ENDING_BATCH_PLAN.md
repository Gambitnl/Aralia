# Conditional Ending Batch Plan

Status: active batching aid
Last updated: 2026-05-14
Source report timestamp: `2026-05-14T08:57:23.608Z`

This file groups the remaining open `conditional_ending` findings by mechanic shape. It exists to make the closure pass faster: add or revise a schema shape once, apply it to every spell in the matching batch, then run the gates once for the batch.

The generated reports remain the source of truth for current counts. This file is a planning layer for efficient manual execution, not a replacement for `ACTIONABLE_SCHEMA_BUCKETS.json` or the manual-review override files.

## Current Generated State

- Actionable open findings: 1240
- Open `conditional_ending` findings: 57
- Closed `conditional_ending` findings: 180

## Recommended Batch Order

1. Reuse-first tiny closures.
   - Goal: close rows that already fit existing `Conditional Ending Triggers`, `SustainRequirement`, `EffectEndCleanup`, `fallControl`, `modeChoice`, `conditionBreakTriggers`, or the new `Conditional Ending Distance Feet`.
   - Gate strategy: use fast checks during edits, then full gates once after the batch.

2. Duration, permanence, and repeated-casting progression.
   - Goal: add a reusable duration/permanence progression shape instead of solving every "cast daily for permanence" or slot-duration row separately.
   - Likely shared fields: slot-tier duration override, concentration override, repeated-cast count/cadence/location/target/configuration, permanent/until-dispelled result.

3. Spell-end cleanup and aftermath.
   - Goal: expand the existing cleanup/end consequence model so ordinary spell end can remove conditions, remove light, drop/eject/return occupants, disintegrate created ammunition, force fallback placement, or trigger a save.
   - Keep this separate from early-ending triggers. These mechanics happen when the spell ends normally or after another ending trigger has already fired.

4. Transfer, retarget, and target-switch mechanics.
   - Goal: model "target drops to 0, then caster can retarget later" and "new target replaces previous target" as a reusable shape.
   - These should not be flattened into simple `target_drops_to_0_hp` conditional endings because the spell often continues and moves to a new target.

5. Delivery/cast-failure/cooldown/soul-availability mechanics.
   - Goal: handle failure conditions and delayed delivery/block behavior as runtime rules rather than prose.
   - This likely belongs near cast preconditions and utility delivery metadata, not just lifecycle endings.

6. Complex summon/control/possession cases.
   - Goal: handle summons, possession, control ending, post-concentration linger, host/container death, and soul return without flattening them into generic "spell ends".
   - These are higher risk and should be batched only after their shared shape is explicit.

## Batch Families

### Duration Scaling, Permanence, And Repeated Casting

These findings all need duration changes driven by slot level, daily recasting, concentration completion, or elapsed repeated-cast state.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `hex::manual_slot_scaled_concentration_duration` | slot-tier duration scaling | Closed in duration-scaling batch 01 with structured/runtime `higherLevelScaling`. |
| `hunters-mark::conditional_ending` | transfer plus duration scaling | Split into transfer batch and duration-scaling batch. |
| `animal-messenger::conditional_ending` | delivery failure plus duration scaling | Split delivery failure from +48 hours per slot. |
| `nystuls-magic-aura::manual_daily_casting_permanence` | repeated daily casting permanence | Closed in duration-progression batch 01 with `durationProgression`: same target, 30 days, until dispelled. |
| `bestow-curse::manual_slot_duration_concentration_scaling` | slot-tier duration and concentration override | Closed in duration-scaling batch 01 with structured/runtime `higherLevelScaling`. |
| `galders-tower::manual_recast_maintenance_and_permanent_tower` | recast maintenance and one-year permanence | Remains open because it needs two duration-progression rules in one spell: recast maintenance while active, plus one-year same-location/configuration permanence. |
| `magic-circle::manual_slot_duration_scaling` | slot duration scaling | Closed in duration-scaling batch 01 with structured/runtime `higherLevelScaling`. |
| `major-image::manual_slot_duration_concentration_override` | slot-tier duration and concentration override | Closed in duration-scaling batch 01 with structured/runtime `higherLevelScaling`. |
| `mordenkainens-private-sanctum::conditional_ending` | repeated same-spot casting permanence | Closed in duration-progression batch 01 with `durationProgression`: 365 daily same-location casts changes duration to until dispelled. |
| `wall-of-stone::conditional_ending` | full-duration concentration permanence | Closed in duration-progression batch 01 with `durationProgression`: full concentration makes wall permanent and non-dispellable. |
| `temple-of-the-gods::conditional_ending` | repeated daily casting permanence plus external destruction | Closed in duration-progression batch 01 with `durationProgression` for permanence plus `disintegrate_targets_effect` conditional ending for destruction. |
| `leomunds-secret-chest::conditional_ending` | delayed cumulative chance plus recast/replica endings | Daily chance after 60 days is a duration/progression branch. |

### Spell-End Cleanup, Return, Drop, Ejection, And Aftermath

These rows are not always early-ending triggers. Many need a first-class "when the spell ends, do this" sequence.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `rope-trick::conditional_ending` | end-of-duration ejection | Closed in end-cleanup contents ejection batch 01 with `effects[].endCleanup[]`: remove extradimensional space, affect contents, and `contents_drop_out` at `space_exit_anchor`. |
| `fly::conditional_ending` | end-of-spell fall consequence | Closed in end-cleanup consequence batch 01 with `effects[].endCleanup[]`: remove spell-granted flying speed, then `fall_if_aloft` unless `can_prevent_fall`. |
| `sickening-radiance::conditional_ending` | cleanup caused light and Exhaustion | Existing `EffectEndCleanup` may need caused-condition/light cleanup values. |
| `watery-sphere::conditional_ending` | ordered end sequence | Fall, extinguish flames, prone occupants, water vanishes. |
| `banishing-smite::conditional_ending` | return placement on spell end | Original space or nearest unoccupied fallback. |
| `danse-macabre::conditional_ending` | animated creature reversion | Undead become inanimate when spell ends. |
| `swift-quiver::conditional_ending` | possession ending plus created-ammunition cleanup | Split possession ending from spell-end ammunition cleanup. |
| `investiture-of-wind::conditional_ending` | end-of-spell fall consequence | Closed in end-cleanup consequence batch 01 with `effects[].endCleanup[]`: remove spell-granted flying speed, then `fall_if_aloft` unless `can_prevent_fall`. |
| `wind-walk::conditional_ending` | transformation and safe descent/fall on end | More complex version of end movement consequence. |
| `tensers-transformation::conditional_ending` | end cleanup plus end-trigger save | Temporary HP cleanup and immediate exhaustion save. |
| `control-water::conditional_ending` | mode replacement and restoration timing | Part Water fills back over next round after mode end/replacement. |
| `primordial-ward::conditional_ending` | defense replacement and delayed spell end | Reaction ends resistances, spell ends at end of next turn. |

### Transfer, Retarget, And Target-Switch Mechanics

These are not pure endings. They often end the current target effect while the spell remains active or moves to a new target.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `hex::conditional_ending` | drop-to-0 retarget transfer | Later Bonus Action moves curse to a new creature. |
| `hunters-mark::conditional_ending` | drop-to-0 retarget transfer | New visible creature plus duration scaling. |
| `telekinesis::conditional_ending` | target switch ends previous effect | Lifted creature falls unless reapplied. |
| `dream-of-the-blue-veil::conditional_ending` | per-target and caster-wide cancellation | Target damage excludes that target; caster damage cancels group. |
| `sequester::conditional_ending` | damage and custom visible-within-range ending | May need generic custom condition support. |

### Cast Failure, Delivery Failure, Cooldown, And Availability

These describe failure to cast, failure to deliver, blocked future attempts, or unavailable targets/souls.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `animal-messenger::conditional_ending` | delivery failure | Message lost and beast returns if destination not reached before duration ends. |
| `sending::conditional_ending` | delivery failure plus recipient block | Recipient-created 8-hour block affects later casts. |
| `speak-with-dead::conditional_ending` | target cooldown and question limit | Ten-day retarget failure and five-question cap. |
| `leomunds-tiny-hut::manual_cast_failure_if_not_encapsulating` | cast failure precondition | Area must fully encapsulate creatures. |
| `reincarnate::conditional_ending` | soul availability failure | Soul must be free and willing. |
| `remove-curse::conditional_ending` | curse ending and item attunement branch | Ends ordinary curses; cursed magic item branch breaks attunement only. |
| `knock::conditional_ending` | temporary suppression duration | Suppresses Arcane Lock for 10 minutes despite instantaneous spell. |

### External Spell, Object, Or Effect Destruction

These need explicit "this external event destroys/ends the created effect" data.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `drawmijs-instant-summons::conditional_ending` | token use/destruction/dispel ends spell | Object summon and sapphire-ending branches. |
| `druid-grove::conditional_ending` | subeffect dispel and all-effects-gone ending | Also animated tree cleanup. |
| `soul-cage::conditional_ending` | object destruction and use-count end | Cage destroyed or sixth exploit releases soul. |
| `temple-of-the-gods::conditional_ending` | Disintegrate external destruction | Split from permanence progression. |
| `leomunds-secret-chest::conditional_ending` | replica destruction and recast ending | Split from delayed daily chance. |
| `symbol::conditional_ending` | object movement break and triggered-duration ending | Similar movement break may share fields with Glyph of Warding. |
| `glyph-of-warding::conditional_ending` | moved-too-far and trigger consumption | Has a duplicate residual row; inspect together. |

### Save Counts, Repeat Saves, And Branch Endings

These need counters, branch outcomes, or already-known repeat-save triggers applied more precisely.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `detect-thoughts::conditional_ending` | save success and action escape check | Includes attention-shift condition. |
| `contagion::conditional_ending` | counted successes/failures | Three successes end target effect; three failures create 7-day disease branch. |
| `flesh-to-stone::conditional_ending` | counted successes/failures and concentration completion | Three successes end; three failures petrify; full concentration changes removal behavior. |
| `mental-prison::conditional_ending` | initial save and breach-trigger ending | Runtime has damage but not spell end trigger. |
| `power-word-pain::conditional_ending` | recurring save end condition | Stored in status aftermath/options, needs typed recurring end condition. |
| `enervation::conditional_ending` | branch and sustain endings | Initial save success, action use, range loss, total cover. |

### Summon, Control, Possession, And Soul-Return Lifecycle

These are high-risk because the spell may end, control may end while the creature remains, or a soul/body/container state must be resolved.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `summon-lesser-demons::conditional_ending` | summon lifecycle and component consumption | Has duplicate residual row; inspect both together. |
| `summon-greater-demon::conditional_ending` | control ending and post-concentration linger | Successful save ends control while demon may remain. |
| `infernal-calling::conditional_ending` | disappearance, command immunity, post-concentration linger | Similar but not identical to Summon Greater Demon. |
| `magic-jar::conditional_ending` | possession/soul return outcomes | Caster death, host death, body distance/death, container destruction. |
| `planar-binding::conditional_ending` | linked summon duration and service completion | Extends another summon/creation spell and changes behavior on completion. |
| `banishment::conditional_ending` | full-duration no-return branch | Creature-type filtered duration-completion outcome. |

### Mode, Area, Object, And Mutable-Effect State

These rows are tied to mode replacement, moving areas, wall length, bead/projectile state, or invalid end positions.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `control-water::conditional_ending` | mode replacement and restoration timing | Also listed under cleanup; handle once. |
| `conjure-celestial::conditional_ending` | moving area and once-per-turn affected tracking | The row is about moving cylinder/affected tracking more than ending. |
| `delayed-blast-fireball::conditional_ending` | delayed object/projectile triggers | End of spell, failed touch save, thrown bead collision/creature-space entry. |
| `wall-of-light::conditional_ending` | mutable dimension and zero-length ending | Beam use reduces wall length by 10 feet; spell ends at 0. |
| `investiture-of-stone::conditional_ending` | invalid end position ending | Spell ends if movement ends inside earth/stone. |
| `antilife-shell::conditional_ending` | caster movement forces barrier crossing | Aura ending tied to movement geometry. |

### Special Or Spell-Specific High-Risk Rows

These should be handled only after the relevant shared shape is clear, or explicitly marked special-question/AI-arbitrated if schema coverage would become fake precision.

| Finding | Mechanic Shape | Notes |
| --- | --- | --- |
| `geas::conditional_ending` | forbidden command and external spell removal | Suicidal commands end spell; specific spells can end it. |
| `immolation::conditional_ending` | ending restriction | Nonmagical extinguishing cannot end the flames. |
| `modify-memory::conditional_ending` | memory-modification success and interruption | Damage, another spell target, or early end prevents alteration. |
| `eyebite::conditional_ending` | per-option endings and per-casting target immunity | Sleep wake triggers, Panicked ending, cannot retarget successful creature. |
| `dream::conditional_ending` | messenger ending choice | Awake target creates wait/end choice. |
| `dispel-magic::conditional_ending` | dispel mechanics | Likely deserves its own dispel schema, not generic conditional endings. |
| `meld-into-stone::manual_leave_or_stone_damage_endings` | leave cost and damage branches | Spell-specific expulsion damage branches. |

## Duplicate Or Residual Rows To Inspect Together

- `glyph-of-warding::conditional_ending`
  - One residual row says broad break-condition fields are needed.
  - One detailed row names movement-break and one-shot trigger consumption.
  - Treat as one batch; close both only if the detailed mechanics are fully represented.
- `summon-lesser-demons::conditional_ending`
  - One residual row says broad break-condition fields are needed.
  - One detailed row names summon lifecycle and optional component consumption.
  - Treat as one batch; close both only if the detailed mechanics are fully represented.
- `animal-messenger::conditional_ending`
  - Split delivery failure from duration scaling if duration-scaling fields are batched elsewhere.
- `hunters-mark::conditional_ending`
  - Split transfer mechanics from duration scaling if doing the duration batch first.
- `temple-of-the-gods::conditional_ending`
  - Split repeated permanence from Disintegrate destruction if external destruction is batched first.
- `leomunds-secret-chest::conditional_ending`
  - Split delayed cumulative chance from recast/replica destruction if needed.

## Next Efficient Closure Candidate

Duration-scaling batch 01 proved that existing structured scaling rules plus runtime `higherLevelScaling` can close simple slot-duration rows without a new schema. Duration-progression batch 01 added reusable `durationProgression` coverage for simple repeated-cast permanence and full-concentration permanence. The next high-yield duration candidate is Galder's Tower only if the structured markdown representation can safely express multiple duration-progression rules for one spell:

- It is the known remaining duration-progression row in this family after batch 01.
- It should not be forced into the current single-value structured fields because it has two related rules.
- If multi-rule structured representation is too broad, move to a smaller cleanup/fall or transfer/retarget family and leave Galder's Tower open.

Before editing that batch, inspect the existing scaling and duration metadata:

```powershell
rg -n -e "durationProgression" -e "HigherLevelScaling" src scripts docs\tasks\spells\templates docs\spells\reference public\data\spells
```

Avoid PowerShell regex alternation with `|`; use repeated `-e` patterns as shown above.
