# Regenerated Spell Reference Official Check

Last Updated: 2026-03-23

This report records the first official-source verification pass for the `23` spell reference docs that had previously been zero-byte files and were regenerated from local JSON.

The purpose of this report is not to pretend that those regenerated docs are now canonically correct. The purpose is to distinguish between:

- regenerated docs that now faithfully mirror local JSON
- local JSON that still appears wrong when compared to official spell pages
- spells that could not be fully verified from a public official online page during this pass

## Scope

The regenerated spell reference docs that were checked in this pass are:

- `catnap`
- `aura-of-life`
- `aura-of-purity`
- `elemental-bane`
- `find-greater-steed`
- `galders-speedy-courier`
- `gravity-sinkhole`
- `guardian-of-nature`
- `shadow-of-moil`
- `sickening-radiance`
- `staggering-smite`
- `storm-sphere`
- `summon-greater-demon`
- `vitriolic-sphere`
- `banishing-smite`
- `bigbys-hand`
- `circle-of-power`
- `conjure-volley`
- `control-winds`
- `swift-quiver`
- `temporal-shunt`
- `gravity-fissure`
- `tether-essence`

## Sources Used

This pass treated the following as the primary evidence sources:

- signed-in D&D Beyond spell pages
- official D&D Beyond spell search/index pages
- official marketplace or product surfaces only when a dedicated spell page was not publicly exposed

Additional rule for the 2026-03-22 follow-up:

- the project owner explicitly allowed fandom/wiki sources for the previously unresolved spell-page gaps, so those were used as secondary verification sources for the remaining missing spells

This means the report now distinguishes between:

- `official online verification`
- `official listing-level verification`
- `user-approved secondary-source verification`

## Important Verification Boundary

This pass only verifies **top-level canonical spell facts that D&D Beyond publicly exposes on the spell page**. Those include:

- spell level
- school
- casting time
- range/area
- components
- duration
- attack/save
- damage/effect
- available classes
- official source citation

This pass does **not** fully verify repo-only internal structured fields that D&D Beyond does not expose in the same shape, such as:

- internal effect-object decomposition
- internal trigger payload structure
- internal target filter objects
- repo-specific utility subtype modeling

So when this report says a local spell is "verified," that means its top-level canonical fields were compared against an official online spell page. It does **not** mean every nested repo field is now canonically proven.

## Summary

- `18` spells had an official D&D Beyond spell page located and compared.
- `1` spell had an official D&D Beyond listing/search surface located and compared at the listing level.
- `4` additional spells were verified through user-approved secondary-source pages after the initial D&D Beyond-only pass failed to surface a usable public spell page.

The main conclusion is:

- the regenerated markdown docs are no longer blank, which is good
- but many of them now accurately mirror **bad local JSON**
- the deeper problem is therefore a `json-vs-official-canonical-top-level-data` issue, not a markdown-regeneration issue

2026-03-23 follow-up:

- the grouped `classes missing in regenerated batch` issue has now been acted on
- the verified regenerated batch was backfilled so local JSON now stores:
  - base/default class access in `classes`
  - subclass/domain-specific access in `subClasses`
- the matching markdown docs now mirror that split through `Classes` and `Sub-Classes`
- this closed the regenerated-batch class-availability issue without flattening subclass access into the base class list

Additional 2026-03-23 grouped repair follow-up:

- a first grouped JSON repair pass was also applied for the strongest placeholder-default top-level drift cases
- that pass updated clearly evidenced top-level facts for:
  - `find-greater-steed`
  - `guardian-of-nature`
  - `shadow-of-moil`
  - `sickening-radiance`
  - `storm-sphere`
  - `summon-greater-demon`
  - `vitriolic-sphere`
  - `banishing-smite`
  - `control-winds`
  - `galders-speedy-courier`
  - `staggering-smite`
  - `temporal-shunt`
  - `tether-essence`
  - `gravity-sinkhole`
- the repair intentionally stayed at the top-level canonical-fact lane and did not claim to settle the deeper effect-object modeling for those spells

## Repeated Drift Patterns

### 1. Classes Are Missing From Local JSON

This was the broadest repeated issue in the verified set.

For the officially comparable pages, the local JSON frequently has:

- `"classes": []`

even though the official spell page clearly lists one or more classes.

This affects both:

- obviously placeholder-like spells
- spells whose other top-level fields are otherwise fairly close to correct

This matters because class availability is a first-order spell fact, not optional metadata.

### 2. Placeholder-Like Top-Level Defaults Exist In The Local JSON

A cluster of regenerated spells still uses obviously placeholder-like top-level values, often in the same repeated pattern:

- school set to `Evocation` when the official page says something else
- range distance set to `0`
- duration set to `instantaneous` when the official page shows concentration or timed duration
- classes left empty
- material data flattened away
- description left blank

This is a grouped data-quality issue, not a one-off typo problem.

### 3. Some Regenerated Docs Are Fine As Mirrors But Still Not Trustworthy As References

Several regenerated docs now mirror local JSON successfully, but the local JSON still drifts from official canonical top-level spell facts.

That means those markdown files are now:

- structurally present
- locally consistent
- but not yet trustworthy as canon-facing spell references

## Per-Spell Findings

### Official Spell Page Located And Compared

#### `catnap`

- Official page found: yes
- Local result: **partially correct, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Bard, Sorcerer, Wizard, and Artificer availability
  - official page exposes material detail (`S, M *`) while local JSON keeps material description blank

#### `aura-of-life`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Cleric and Paladin availability
  - local JSON still does not capture the official class availability surface

#### `aura-of-purity`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Cleric and Paladin availability

#### `elemental-bane`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Druid, Warlock, Wizard, and Artificer availability

#### `find-greater-steed`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Conjuration`
  - local JSON casting time is `1 action`, official page says `10 minutes`
  - local JSON range is effectively `0`, official page shows `30 ft.`
  - local JSON classes are empty, official page shows Paladin

#### `guardian-of-nature`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Transmutation`
  - local JSON casting time is `1 action`, official page says `1 bonus action`
  - local JSON range is modeled as `ranged 0`, official page says `Self`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Minute`
  - local JSON classes are empty, official page shows Druid and Ranger

#### `shadow-of-moil`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Necromancy`
  - local JSON range is modeled as `ranged 0`, official page says `Self`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Minute`
  - local JSON material data is flattened away while the official page shows `V, S, M *`
  - local JSON classes are empty, official page shows Warlock

#### `sickening-radiance`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, official page shows `120 ft. (30 ft.)`
  - local JSON duration is `instantaneous`, official page says `Concentration 10 Minutes`
  - local JSON classes are empty, official page shows Sorcerer, Warlock, and Wizard
  - local JSON describes the spell with a generic utility-like placeholder shape rather than the official top-level damage/debuff profile

#### `staggering-smite`

- Official page found: yes
- Local result: **material drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Enchantment`
  - local JSON duration is `Concentration 1 Minute`, official page presents the spell as `Instantaneous`
  - local JSON classes are empty, official page shows Paladin

#### `storm-sphere`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, official page shows `150 ft. (20 ft.)`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Minute`
  - local JSON classes are empty, official page shows Sorcerer and Wizard
  - the local JSON top-level shape looks placeholder-like rather than canon-facing

#### `summon-greater-demon`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, official page shows `60 ft.`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Hour`
  - local JSON school is `Evocation`, official page says `Conjuration`
  - local JSON classes are empty, official page shows Warlock and Wizard
  - local JSON omits official material detail (`V, S, M *`)

#### `vitriolic-sphere`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, official page shows `150 ft. (20 ft.)`
  - local JSON omits official material detail (`V, S, M *`)
  - local JSON classes are empty, official page shows Sorcerer and Wizard

#### `banishing-smite`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Conjuration`
  - local JSON casting time is `1 action`, official page says `1 bonus action *`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Minute`
  - local JSON range is modeled as `ranged 0`, official page says `Self`
  - local JSON classes are empty, official page shows Paladin

#### `bigbys-hand`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Sorcerer, Wizard, and Artificer availability
  - official page exposes `V, S, M *`, while local material description is still blank

#### `circle-of-power`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Cleric, Paladin, and Wizard availability
  - local JSON models the primary effect generically rather than preserving the official class/access surface

#### `conjure-volley`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Ranger availability
  - official page exposes area/material nuance (`150 ft. (40 ft. *)`) that the local data does not fully preserve in top-level human-facing form

#### `control-winds`

- Official page found: yes
- Local result: **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, official page says `Transmutation`
  - local JSON range is effectively `0`, official page shows `300 ft. (100 ft.)`
  - local JSON duration is `instantaneous`, official page says `Concentration 1 Hour`
  - local JSON classes are empty, official page shows Druid, Sorcerer, and Wizard

#### `swift-quiver`

- Official page found: yes
- Local result: **mostly correct top-level shape, but incomplete**
- Main mismatches:
  - local JSON classes are empty
  - official page lists Ranger availability
  - official page exposes `V, S, M *`, while local material description is still blank

### Official Listing Surface Located And Compared

#### `galders-speedy-courier`

- Official spell-detail page found: **no clean public detail page in the standard spell-page shape**
- Official surface found: **yes**
- Notes:
  - D&D Beyond search surfaces the spell as a 4th-level entry with top-level listing data
  - the listing shows `Conjuration`, `1 Action`, `10 Minutes`, and `10 ft.`
  - the linked official page did not provide the same clean public spell-detail structure as the normal spell pages during this pass
- Local result:
  - **major drift**
  - local JSON school is `Evocation`, while the official listing shows `Conjuration`
  - local JSON casting time is `1 action`, which matches the listing
  - local JSON range is effectively `0`, while the official listing shows `10 ft.`
  - local JSON duration is `instantaneous`, while the official listing shows `10 minutes`
  - local JSON classes are empty

### User-Approved Secondary-Source Verification

#### `gravity-sinkhole`

- D&D Beyond public spell page found during initial pass: no
- Secondary source used: [Critical Role Wiki - Gravity Sinkhole](https://criticalrole.fandom.com/wiki/Gravity_Sinkhole)
- Local result:
  - **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, while the secondary source lists `120 feet`
  - local JSON omits material detail, while the secondary source lists `V, S, M (a black marble)`
  - local JSON classes are empty, while the secondary source lists `Wizard`
  - local JSON uses a generic utility placeholder effect shape rather than the reported force-damage-and-pull spell profile

#### `temporal-shunt`

- D&D Beyond public spell page found during initial pass: no
- Secondary source used: [Critical Role Wiki - Temporal Shunt](https://criticalrole.fandom.com/wiki/Temporal_Shunt)
- Local result:
  - **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, while the secondary source lists `Transmutation`
  - local JSON casting time is `1 action`, while the secondary source lists `1 reaction`
  - local JSON range is effectively `0`, while the secondary source lists `120 feet`
  - local JSON duration is `instantaneous`, while the secondary source lists `1 round`
  - local JSON classes are empty, while the secondary source lists `Wizard`

#### `gravity-fissure`

- D&D Beyond public spell page found during initial pass: no
- Secondary source used: [Critical Role Wiki - Gravity Fissure](https://criticalrole.fandom.com/wiki/Gravity_Fissure)
- Local result:
  - **major drift**
- Main mismatches:
  - local JSON range is effectively `0`, while the secondary source lists `100-foot line from self`
  - local JSON omits material detail, while the secondary source lists `V, S, M (a fistful of iron filings)`
  - local JSON classes are empty, while the secondary source lists `Wizard`
  - local JSON uses a generic utility placeholder effect shape rather than the reported force-damage-and-pull line spell profile

#### `tether-essence`

- D&D Beyond public spell page found during initial pass: no
- Secondary source used: [Critical Role Wiki - Tether Essence](https://criticalrole.fandom.com/wiki/Tether_Essence)
- Local result:
  - **major drift**
- Main mismatches:
  - local JSON school is `Evocation`, while the secondary source lists `Necromancy`
  - local JSON range is effectively `0`, while the secondary source lists `60 feet`
  - local JSON duration is `instantaneous`, while the secondary source lists `Up to 1 hour` with concentration
  - local JSON omits material detail, while the secondary source lists `V, S, M` with a consumed platinum cord worth at least `250 gp`
  - local JSON classes are empty, while the secondary source lists `Wizard`

## Practical Conclusion

The zero-byte regeneration work was still worth doing, because blank files were polluting parity results. But the official-source pass shows that this regenerated batch now splits into two different maintenance lanes:

### Lane A: Repair Local JSON That Is Clearly Wrong At The Canonical Top Level

The strongest examples are:

- `find-greater-steed`
- `guardian-of-nature`
- `shadow-of-moil`
- `sickening-radiance`
- `storm-sphere`
- `summon-greater-demon`
- `vitriolic-sphere`
- `banishing-smite`
- `control-winds`

These do not mainly need markdown work. They need JSON repair first.

### Lane B: Backfill Missing Top-Level Canonical Metadata On Otherwise Closer Spells

The strongest repeated example is:

- empty `classes` arrays even when the official spell page clearly lists classes

This affects multiple spells whose other top-level facts are otherwise close enough that they do not look like placeholder records.

### Lane C: Mark Official Online Verification Gaps Explicitly

The following spells should be treated as **not fully verifiable from a public official D&D Beyond spell-detail page in the standard page shape**, even though this report now uses a user-approved secondary source for them:

- `gravity-sinkhole`
- `temporal-shunt`
- `gravity-fissure`
- `tether-essence`

`galders-speedy-courier` is slightly different:

- it is discoverable on the official D&D Beyond listing/search surface
- but it did not expose a clean public spell-detail page during this pass

So the verification issue is now much narrower than before:

- the top-level comparison batch is no longer blocked by missing pages
- but the source-quality label for some spells is still weaker than the fully official D&D Beyond spell-page comparisons used for the other entries
