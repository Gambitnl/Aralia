# How Baldur's Gate 3 measures and shows distance in turn-based combat

Research date: 2026-09-30. Purpose: map BG3 behavior onto Aralia, a D&D 5e web game.
Question sheet that uses it: https://claude.ai/artifact/FcxNo9bDmdiDLDMh1kMTBz (plan-map topic `combat-gridless`).
Aralia uses a 5 ft square grid today and wants to move to BG3-style gridless combat.

## Source labels

- **[primary: game data]**: raw stat entries from BG3's shipped game files, as shown by
  Norbyte's BG3 search index (`bg3.norbyte.dev`). Each value was pulled with a
  script that read the page directly. No summarizer was involved. Lines are quoted as
  `data "Key" "Value"`.
- **[primary: Larian]**: Larian's own sites: the BG3 modding docs (`docs.baldursgate3.game`),
  the Divinity Engine docs (`docs.larian.game`, which covers DOS2), and baldursgate3.game news.
- **[wiki]**: bg3.wiki. It is community-written, but its spell and item boxes come from game
  data and in-game tooltips.
- **[secondary]**: guides, forums, Steam, Reddit, and news sites. Use these with care.
- **UNVERIFIED** marks a claim that no source found here confirms. Check it in the game.

## Summary

1. BG3 uses meters. 5 ft = 1.5 m. Speeds are 7.5 / 9 / 10.5 m. Most ranges are capped at 18 m.
2. Movement is a free, pathfound line with no grid. The engine has a hidden navigation grid
   (the "AI grid"). The DOS2 engine docs give its cells as 0.5 m. BG3 uses the same AI grid
   for placement and surfaces. Difficult terrain doubles the cost. Jump costs a bonus action
   plus a flat 3 m of movement.
3. Melee reach is 1.5 m. Reach weapons have 2.5 m, not 3 m. Opportunity attacks and
   "Threatened" use that reach. Auras count the target's hitbox. The ranged "too close"
   check (3 m) measures from the center point.
4. Range is a flat circle (really a vertical cylinder) around the attacker. Height is
   ignored, except that high ground extends range. Weapons have one normal range. Past it,
   and only when high ground extends the range, the attack takes disadvantage. There is no
   cover system. Line of sight is still required.
5. **BG3 turned every 5e sphere, cube, and square that is placed at a point into a circle
   (a radius).** Examples: Grease, Web, Entangle, Faerie Fire, and Cloud of Daggers.
   **5e cubes and lines that start at the caster became "Zone" spells.** A zone is either
   a Square (a rectangle pushed out from the caster) or a Cone. Thunderwave is a Square
   zone, 5 m long × 5 m wide, pushed forward from the caster. It is not a cone, and it is
   not centerd on the caster. Lightning Bolt is a Square zone 30 m long × 2 m wide.
6. Creatures have an "AI bound" footprint used for placement and pathing. The public docs
   give no per-size radius table.
7. There is no visible grid in the BG3 UI. It shows a path line, a distance readout, range
   and AoE previews, and warning icons.
8. Surfaces live on the AI grid. Spells make them as circles. Puddles and spills grow as
   irregular tile blobs.

---

## 1. Units

**Claim 1.1.** BG3 gives all ranges and areas in meters. An option shows rounded feet
instead. Quote: "Ranges and areas are specified in metres. These can be displayed as an
equivalent (rounded) number of feet by setting the relevant game option."
Source: https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

**Claim 1.2.** The setting is Options > Gameplay > User Options > System of Measurement
(Metric or Imperial).
Source: https://kotaku.com/baldurs-gate-4-bg3-settings-combat-camera-1850729597 [secondary]

**Claim 1.3.** The conversion factor is **1.5 m per 5 ft**, which is 0.3 m per ft. The
wiki always writes a pair such as "9 m (30 ft)". The base speeds are:
- Slow: 7.5 m (25 ft). Dwarves, halflings, and gnomes.
- Normal: 9 m (30 ft). Most races.
- Fast: 10.5 m (35 ft). Wood elves and wood half-elves.

Movement speed "determines how far a creature can move on its turn, on a 1:1 ratio."
Source: https://bg3.wiki/wiki/Resources#Movement_speed (Movement_speed redirects here) [wiki]

**Claim 1.4.** Fire Bolt has a range of 18 m (60 ft). The game data says
`Projectile_FireBolt`: `data "TargetRadius" "18"`.
Sources: https://bg3.wiki/wiki/Fire_Bolt [wiki];
https://bg3.norbyte.dev/search?q=Projectile_FireBolt [primary: game data]

**Claim 1.5.** Rounding is not always "×0.3". Some numbers were rounded to whole meters,
and some sizes were changed on purpose:
- "15 ft cones become 5 m (17 ft) cones, whereas 15 ft spheres and cubes usually become
  13 ft (4 m) spheres."
- Reach weapons: 10 ft in 5e became **2.5 m** (shown as "8 ft" or "8.3 ft"). A strict
  conversion would give 3 m.
- Touch spells are 1.5 m (5 ft).
- Almost every spell range is capped at 18 m (60 ft). Dimension Door (50 m) is the one
  exception.

Sources: https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki];
https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

**Claim 1.6.** In the game data, spell sizes are plain numbers in meters. Examples:
`TargetRadius "18"`, `AreaRadius "4"`, `Range "5"`.
Source: any entry at https://bg3.norbyte.dev (for example `?q=Projectile_Fireball`)
[primary: game data]

A community schema says these fields are in centimeters ("1800" = 18 m). The real data
does not support this. Ignore that part of the schema.
Source: https://github.com/NellsRelo/bg3-schema/blob/main/stats/types/SpellData.md [secondary]

---

## 2. Movement

### 2.1 Free path, pathfinding, no player-facing grid

**Claim 2.1.1.** BG3 has no movement grid. You pick a point, and the character walks a
pathfound line to it. The UI draws that line.
- "The white line indicates the path the character will take to reach the target."
  Source: https://www.shacknews.com/article/136590/combat-explainer-baldurs-gate-3
  (2023-08-09) [secondary]
- BG3 "replaces the grid-based movement system with a line-based movement system", and "you
  can be surrounded by more than eight creatures at a time."
  Source: https://www.thegamer.com/baldurs-gate-3-biggest-differences-dnd-dungeons-dragons/
  [secondary]

**Claim 2.1.2.** Placement looks continuous to the player. Underneath, the engine keeps a
navigation grid called the **AI grid**.
- The DOS2 Divinity Engine docs say: "every patch of 0.5m² gets a property that either
  allows creatures to stand on it, or prevents them from doing so."
- Characters take up cells based on their AI bound: "No matter if a character has a box or
  a cylinder AI bound, they will always take up a rectangle with the size of the bound."

Source: https://docs.larian.game/AI_grid [primary: Larian; DOS2 engine docs]

BG3's own modding docs use the same AI grid:
- TeleportToPosition: "If `_SourceObject` is a character, and the destination location is
  not valid on the AI Grid, the game will find a nearby valid location on the AI grid and
  place the character there."
  Source: https://docs.baldursgate3.game/index.php?title=TeleportToPosition [primary: Larian]
- FindValidPosition "Finds a valid position for an object on the AI-grid near a source
  position using a flood fill up to a specified radius." It also accounts for the object's
  AI bounds.
  Source: https://docs.baldursgate3.game/index.php?title=FindValidPosition [primary: Larian]

The BG3 docs found here do not state BG3's AI-grid cell size. The 0.5 m figure comes from
the DOS2 engine docs only. UNVERIFIED for BG3.

**Claim 2.1.3.** A misclick cannot be undone. Once you commit to a move, it happens.
Source: https://kevinleung.com/archives/comparing-baldurs-gate-3-and-tabletop-dd/ [secondary]

### 2.2 Difficult terrain

**Claim 2.2.1.** Difficult terrain "halves the Movement Speed of creatures moving through
it, requiring 2 m of movement to move 1 m through this type of area."
- Examples: vines, Web, spikes, mud, Grease, ice, lava, deep water, and Hunger of Hadar.
- Plant Growth is the one case that *quarters* speed.
- Jumping inside difficult terrain also costs double.
- Actions that spend movement, such as Brace and Prepare, do not work in difficult terrain.

Source: https://bg3.wiki/wiki/Difficult_Terrain [wiki]

### 2.3 Dash

**Claim 2.3.1.** Dash costs an action. Its text is: "Cover more distance this turn: double
your Movement Speed."
- Dashing more than once in a turn stacks by *addition*. Two dashes give 3× speed. Three
  dashes give 4× speed. A fourth dash does nothing.
- Click Heels, from Boots of Speed, is different. It multiplies.
- Bonus-action versions exist, such as the Rogue's Cunning Action: Dash.

Source: https://bg3.wiki/wiki/Dash [wiki];
`Shout_Dash` (uses DASH / DASH_STACKED / DASH_STACKED_2 statuses):
https://bg3.norbyte.dev/search?q=Shout_Dash [primary: game data]

### 2.4 How remaining movement is shown

**Claim 2.4.1.** Remaining movement shows as a ring or circle next to the End Turn
button. The guides call it "the blue circle in the bottom-right of your screen" and "the
bluish ring around the End Turn icon".
Sources: https://www.shacknews.com/article/136590/combat-explainer-baldurs-gate-3 [secondary];
https://game8.co/games/Baldurs-Gate-III/archives/419902 [secondary]

**Claim 2.4.2.** The cursor shows a distance readout. One player reports that the tooltip
"constantly switches states anytime it passes over an object, character or enemy." The
same player asked for a separate ruler tool, because the path line measures walking
distance and not the straight-line distance a spell uses.
Source: https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=877736 (2023-10-08)
[secondary]

**Claim 2.4.3.** When the destination is past your remaining movement, the path is said to
change color (red) and the character stops at the limit. UNVERIFIED. No primary source or
wiki page describing this was found. It is a common player description only.

### 2.5 Jump

**Claim 2.5.1.** Jump costs a bonus action plus a flat 3 m (10 ft) of movement, however far
you jump.
- Base jump distance is 4.5 m (15 ft) at Strength 10 or below.
- Each 2 points of Strength above 10 adds 1 m (3 ft).
- A jump can therefore add up to about 20 ft of net movement at Strength 20.
- There are no Athletics or Acrobatics checks to clear obstacles or to land.
- Encumbered halves jump distance. Heavily Encumbered prevents jumping.
- Enhance Leap triples jump distance.

Quote: "Jumping is a bonus action which consumes 10ft of movement speed... The jump always
consumes 10 feet of movement regardless of the actual distance jumped."
Sources: https://bg3.wiki/wiki/Jump [wiki]; https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

### 2.6 High ground and low ground

**Claim 2.6.1.** Attack roll modifiers:
- "At 2.5 m (8 ft) above a target, an attacker receives a +2 'High Ground' bonus to attack
  rolls."
- "At 2.5 m (8 ft) below a target, an attacker receives a -2 'Low Ground' penalty."
- The modifier appears under the target's HP bar while you aim.
- The Sharpshooter feat removes the low-ground penalty for ranged weapon attacks.
- The rule applies to all attack rolls, melee included. In practice melee rarely reaches
  far enough for it to matter.

Source: https://bg3.wiki/wiki/High_ground_rules [wiki]

**Disagreement.** The same wiki's rule-changes page gives the threshold as "at least 10ft",
and says the rule is for *ranged* attacks. The dedicated High ground rules page says 2.5 m
(8 ft) and *all* attack rolls. The dedicated page is newer and more detailed.
Source: https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

### 2.7 Falling damage

**Claim 2.7.1.** BG3 does not use the 5e rule of 1d6 per 10 ft.
- Falls under 4 m deal no damage.
- Above 4 m, the approximate formula is
  `damage = (MaxHP + TempHP) × (height − 4) / 17 + 1`.
- A fall of about 21 m is lethal from full HP. Falling into a chasm is always lethal.
- The fall knocks the creature Prone when the damage is more than 25% of max HP. That is
  about 8 m (27 ft) with no resistance.
- The jump preview shows the fall damage it will cause, or "Dead".

Sources: https://bg3.wiki/wiki/Falling_damage [wiki];
https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

**Claim 2.7.2.** A spell flag, `AddFallDamageOnLand`, lets forced movement cause fall
damage. It is set on Thunderwave, Shove, and Throw.
Source: https://bg3.norbyte.dev/search?q=Zone_Thunderwave [primary: game data]

---

## 3. Melee reach and opportunity attacks

**Claim 3.1.** "The typical range for melee weapons is 1.5 m (5 ft). Reach Weapons have a
melee range of 2.5 m (8 ft)."
- The Reach weapons are the Glaive, Halberd, and Pike.
- Reach weapons do *not* get extra vertical reach.

Sources: https://bg3.wiki/wiki/Extra_Reach [wiki]; https://bg3.wiki/wiki/Weapons
(weapon table lists 1.5 m or 2.5 m for each weapon) [wiki];
https://bg3.wiki/wiki/High_ground_rules [wiki]

5e rule change: "Reach weapons have an effective range of 2.5m/8.3ft, rather than 10ft."
Source: https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

**Claim 3.2.** In the game data, the melee attack range comes from the weapon itself:
- `Target_MainHandAttack`: `data "TargetRadius" "MeleeMainWeaponRange"`.
- Shove is fixed at `data "TargetRadius" "1.5"`.

Sources: https://bg3.norbyte.dev/search?q=Target_MainHandAttack ;
https://bg3.norbyte.dev/search?q=Target_Shove [primary: game data]

**Claim 3.3.** A melee targeting cylinder usually does not reach above the attacker's own
height (`TargetCeiling` 0). Ranged abilities have an unlimited cylinder height.
Source: https://bg3.wiki/wiki/High_ground_rules (footnote 1) [wiki]

**Claim 3.4. Is reach measured center to center or edge to edge?** The public sources show
BG3 mixes the two:
- Auras account for the target's hitbox. The "Target is too close" ranged penalty measures
  from the attacker's *center*. Quote: "the effect measures the distance from the center
  of the attacker to the target, while an aura accounts for the size of a creature's
  hitbox."
  Source: https://bg3.wiki/wiki/Threatened_(Condition) [wiki]
- Very large targets have more than one hitbox part. Quote: "When attacking a very large
  target, like the Dominated Red Dragon, multiple parts of it may threaten the attacker at
  once, as if surrounded by multiple enemies."
  Source: https://bg3.wiki/wiki/Threatened_(Condition) (Bugs) [wiki]
- UNVERIFIED: whether the 1.5 m melee range is measured to the target's hitbox edge or to
  its center. No source states it. The auras above suggest that at least some distance
  checks add the creature's size. Test this in the game: stand next to a Large creature
  such as an Ogre and measure how far away you can still start a melee attack.

**Claim 3.5.** Opportunity attacks and Threatened:
- Opportunity Attack: "Automatically attack an enemy moving out of your reach."
- It does not trigger when the attacker holds a ranged weapon, cannot take reactions
  (Prone, Incapacitated, Sleeping), or cannot see the target.
- Disengage prevents it.
- Polearm Master also triggers it when a creature moves *into* reach.
- Dual wielders make two attacks with one reaction.

Source: https://bg3.wiki/wiki/Opportunity_Attack [wiki]

- "Opportunity Attacks seem to be tied directly to the Threatened condition, which only
  occurs in the reach of a melee-equipped hostile."
  Source: https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]
- Threatened is caused by "Being within the melee range of a hostile creature in combat."
  Its effect is disadvantage on ranged attack rolls. The weapon's reach changes the range.
  Source: https://bg3.wiki/wiki/Threatened_(Condition) [wiki]

**Disagreement.** The rule-changes page says Threatened imposes disadvantage "within 10ft
of the target, unlike in 5e, where this penalty's range is 5ft." The Threatened page says
it depends on melee range, and names a *separate* "Target is too close" penalty within
**3 m**. Both statements can be true together: BG3 keeps two separate close-range checks.
Sources: https://bg3.wiki/wiki/D%26D_5e_rule_changes ;
https://bg3.wiki/wiki/Threatened_(Condition) [wiki]

**Claim 3.6. How the threat is shown.**
- A red arrow or icon on the move path warns that the move will provoke an opportunity
  attack. Source: https://gamerant.com/baldurs-gate-3-bg3-how-avoid-opportunity-attacks-reaction-hit-melee-move/
  [secondary]
- A white circle around your character shows your melee attack range. Source:
  https://steamcommunity.com/sharedfiles/filedetails/?id=3122428771 (2023-12-26) [secondary]

No primary source was found for these UI details.

**Claim 3.7.** Early Access players complained that the threat range felt like "10-15
feet". This is historical. It is from October 2020.
Source: https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=698634 [secondary]

**Pattern worth noting.** Several 5e "within 5 ft" rules became **3 m (10 ft)** in BG3:
- Advantage against a Prone creature applies "if they're made within 3 m (10 ft)"
  (https://bg3.wiki/wiki/Grease, Prone condition box) [wiki].
- The "Target is too close" penalty for ranged attacks is 3 m [wiki].
- Paralyzed auto-crits within 3 m (https://bg3.wiki/wiki/D%26D_5e_spell_changes, Hold
  Person row) [wiki].

A likely reason is that "adjacent" in a gridless game needs some slack when measured
center to center. This is inference only. No source states the reason.

---

## 4. Range, long range, line of sight, cover

**Claim 4.1. Range is a vertical cylinder, not a sphere.** "Normally for range
considerations, only the horizontal distance between an attacker and target matters and
vertical distance is ignored... the targetable region of an ability is a vertical
cylinder (where the attacker is at the center of this cylinder) with a radius equal to
the ability's range."
Source: https://bg3.wiki/wiki/High_ground_rules [wiki]

**Claim 4.2. High ground extends range.** Abilities with the `HasHighGroundRangeExtension`
flag gain range equal to how far the target is below the attacker. Example: an 18 m
attack against a target 9 m lower can reach 27 m horizontally. The reverse does not
apply. A target above you costs no range.
Source: https://bg3.wiki/wiki/High_ground_rules [wiki]. The flag is on Fire Bolt,
Fireball, Grease, Web, and ranged weapon attacks (`Projectile_MainHandAttack`):
https://bg3.norbyte.dev/search?q=Projectile_MainHandAttack [primary: game data]

**Claim 4.3. Weapon ranges.**
- Longbow, shortbow, light crossbow, and heavy crossbow: 18 m (60 ft).
- Hand crossbow: 15 m (50 ft).
- The wiki's rule-changes page says "the normal range of ranged weapons has been reduced to
  60ft, except hand crossbows, whose range has been increased to 50 ft."

Sources: https://bg3.wiki/wiki/Weapons [wiki]; https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]

**Claim 4.4. Long range. The wiki pages disagree.**
- The High ground rules page says a ranged weapon's maximum effective range equals its
  normal range. Beyond that, "Target outside normal range" gives disadvantage. That
  distance is measured in true 3D, not horizontally. So in practice the penalty "is only
  encountered when extending the attack range with elevation". Spell attacks never get
  this penalty.
  Source: https://bg3.wiki/wiki/High_ground_rules [wiki]
- The Weapons page table note says ranged weapons "have an extended range which exceeds
  this... not more than 5% of standard range, but confers disadvantage."
  Source: https://bg3.wiki/wiki/Weapons [wiki]
- The Weapons page property row says "Every ranged weapon has a normal range and a long
  range." This is generic 5e wording and is contradicted by the two items above.

Bottom line: BG3 has **no real 5e long-range band**, such as 150/600 ft for a longbow. The
only disadvantage band is a thin margin, mostly reached through high ground.

**Claim 4.5. Close range.** A ranged attack gets disadvantage when the target is within
3 m ("Target is too close"). This is measured from the attacker's center. Crossbow Expert
removes it.
Source: https://bg3.wiki/wiki/Threatened_(Condition) [wiki]

**Claim 4.6. Cover and line of sight.** "Cover mechanics are not implemented, but a line
of sight to the target is still required for ranged weapon attacks, Throw attacks, and
projectile spells." So BG3 has no half cover and no three-quarters cover.
- Clouds such as Fog and Darkness block ranged attacks into or out of them.
Sources: https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]; https://bg3.wiki/wiki/Clouds [wiki]

**Claim 4.7. How range is shown.** While you aim, a ring on the ground shows the ability's
range, and targets outside it cannot be picked. UNVERIFIED in primary sources. This is the
common in-game experience, but no source found here documents it. Larian's patch notes
confirm trajectory previews exist:
- Patch 3 "Added trajectory preview for force application when using spells."
  Source: https://baldursgate3.game/news/community-update-11-inspiration-freedom-pacifism_17
  (2020-12-02) [primary: Larian]
- Patch 8 fixed "previews of spell and ranged attack trajectories" (as summarized by
  search). Source: https://baldursgate3.game/news/patch-8_56 [primary: Larian; wording
  unconfirmed]

---

## 5. Areas of effect

### 5.1 BG3's AoE model (from the game data)

BG3 spell data has these shape types [primary: game data]:

- **Radius at a point.** Used by Target and Projectile spells. The fields are
  `TargetRadius` (cast range) and `AreaRadius` / `ExplodeRadius` (circle radius). Every
  5e sphere, cylinder, cube, or square that you place at a point became one of these
  circles.
- **Zone.** Used by `SpellType "Zone"`. It starts at the caster and points the way you aim.
  - `Shape "Cone"` uses `Range` (length) and `Angle` (degrees).
  - `Shape "Square"` uses `Range` (length) and `Base` (width). It is a rectangle pushed
    out from the caster.
  - `FrontOffset` moves the start point along the aim direction. A community schema says
    that "Negative values start behind caster"
    (https://github.com/NellsRelo/bg3-schema/blob/main/stats/types/SpellData.md) [secondary].
- **Shout / aura.** Used by `SpellType "Shout"`. It is a radius centerd on the caster, for
  example Spirit Guardians.
- **Wall.** Used by `SpellType "Wall"`. It is a line segment you draw, with `MaxDistance`.

### 5.2 Spell by spell

All game-data lines below were extracted directly from `https://bg3.norbyte.dev/search?q=<UID>`.

**Fireball** (5e: 20 ft radius sphere = 6 m).
- BG3: range 18 m, **radius 4 m (13 ft)**. That is smaller than 5e.
- Data: `Projectile_Fireball`: `TargetRadius "18"`, `AreaRadius "4"`, `ExplodeRadius "4"`.
  It also has `GROUND:SurfaceChange(Ignite)`, so it sets flammable surfaces alight.
- Sources: https://bg3.norbyte.dev/search?q=Projectile_Fireball [primary: game data];
  https://bg3.wiki/wiki/Fireball [wiki]; spell-changes row "Reduced range 18 m, Reduced
  AOE radius 4 m" https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

**Thunderwave** (5e: 15 ft cube starting at the caster).
- BG3: **a Square zone. `Range "5"` (length) × `Base "5"` (width). No `FrontOffset`.**
  This is a 5 m × 5 m rectangle pushed out from the caster in the aimed direction.
- **It is not a cone and not a circle.** The wiki calls it "AoE: 5 m (17 ft) Cube",
  range "Melee: 1.5 m", and push "8 m (27 ft)".
- Data: `SpellSuccess "DealDamage(2d8,Thunder,Magical);Force(8, OriginToTarget)"`.
  `TargetConditions` does not exclude `Self()` by name.
- The data has no FrontOffset. The zone likely starts at the caster, so the caster is
  outside their own square. BG3 treats it as face-anchored like 5e, not as a self-centerd
  cube. UNVERIFIED: the default FrontOffset value. Check that the caster is never hit.
- Sources: https://bg3.norbyte.dev/search?q=Zone_Thunderwave [primary: game data];
  https://bg3.wiki/wiki/Thunderwave [wiki]; spell-changes row "Slightly increased AoE:
  5 m (17 ft) Cube" https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

**Burning Hands** (5e: 15 ft cone).
- BG3: a Cone zone, `Range "5"`, `Angle "60"`, `FrontOffset "-2"`. The wiki shows
  "5 m (17 ft) Cone". A 60 degree opening matches the 5e cone, where width equals length.
- With FrontOffset -2, the cone's apex sits about 2 m behind the caster. That makes the
  cone already wide at the caster's position. This is inference from the community
  schema. UNVERIFIED: whether the 5 m length is measured from the apex or from the caster.
- Sources: https://bg3.norbyte.dev/search?q=Zone_BurningHands [primary: game data];
  https://bg3.wiki/wiki/Burning_Hands [wiki]

**Color Spray** (5e: 15 ft cone). Data: Cone, `Range "5"`, `Angle "60"`, `FrontOffset "-2"`.
Source: https://bg3.norbyte.dev/search?q=Zone_ColorSpray [primary: game data]

**Cone of Cold** (5e: 60 ft cone). Data: Cone, `Range "9"`, `Angle "60"`. It is 9 m long,
much shorter than 5e.
Source: https://bg3.norbyte.dev/search?q=Zone_ConeOfCold [primary: game data]

**Lightning Bolt** (5e: 100 ft × 5 ft line).
- BG3: a Square zone, `Range "30"`, `Base "2"`, `FrontOffset "-2"`. That is a 30 m × 2 m
  rectangle, wider than the 5e line (5 ft = 1.5 m).
- Sources: https://bg3.norbyte.dev/search?q=Zone_LightningBolt [primary: game data];
  https://bg3.wiki/wiki/Lightning_Bolt ("aoe = line", 30 m) [wiki]

**Grease** (5e: 10 ft **square**, centerd on a point).
- BG3: **a circle, radius 4 m (13 ft)**, range 18 m. It is much larger than 5e, and it is
  a circle, not a square.
- Data: `Target_Grease`: `TargetRadius "18"`, `AreaRadius "4"`,
  `SpellProperties "GROUND:CreateSurface(4,10,Grease)"`. That is a 4 m surface lasting 10
  turns.
- **The square-centerd-or-face-anchored question does not arise in BG3.** The spell is a
  circle centerd on the clicked point.
- Sources: https://bg3.norbyte.dev/search?q=Target_Grease [primary: game data];
  https://bg3.wiki/wiki/Grease [wiki]

**Web** (5e: 20 ft cube). BG3: a circle, radius 4 m, range 18 m. It creates a Web surface,
`CreateSurface(4,10,Web,true)`.
Sources: https://bg3.norbyte.dev/search?q=Target_Web [primary: game data];
https://bg3.wiki/wiki/Web [wiki]

**Cloud of Daggers** (5e: 5 ft cube).
- BG3: "Slightly increased radius: 2 m (circle)". Data: `AreaRadius "2"`.
- It is made as a *summoned* area with an aura status (`CLOUD_OF_DAGGERS_AURA`).
- It deals damage when cast and at the start of the enemy's turn. It also deals damage
  each time an enemy is shoved or thrown through it.
- Sources: https://bg3.norbyte.dev/search?q=Target_CloudOfDaggers [primary: game data];
  https://bg3.wiki/wiki/Cloud_of_Daggers [wiki]

**Entangle** (5e: 20 ft **square**). BG3: "AoE: 3 m (10 ft) Radius (circle)". Data:
`AreaRadius "3"`, a Vines surface.
Sources: https://bg3.norbyte.dev/search?q=Target_Entangle [primary: game data];
https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

**Faerie Fire** (5e: 20 ft cube). BG3: "6 m (20 ft) Radius (circle)". Data: `AreaRadius "6"`.
Sources: https://bg3.norbyte.dev/search?q=Target_FaerieFire [primary: game data];
https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

**Spirit Guardians** (5e: 15 ft radius around the caster).
- BG3: a Shout spell, "Range: Self, AoE: 3 m (10 ft) Radius". Data: `AreaRadius "3"`.
- It is an aura centerd on the caster. Per the Threatened page, auras account for the
  target's hitbox size.
- Sources: https://bg3.norbyte.dev/search?q=Shout_SpiritGuardians [primary: game data];
  https://bg3.wiki/wiki/Spirit_Guardians [wiki]; https://bg3.wiki/wiki/Threatened_(Condition) [wiki]

**Other radius spells from the game data** [primary: game data, each at
`bg3.norbyte.dev/search?q=<UID>`]:

| Spell | 5e area | BG3 area |
|---|---|---|
| Shatter | 10 ft sphere | `AreaRadius "3"` |
| Moonbeam | 5 ft radius cylinder | `AreaRadius "1"` |
| Darkness | 15 ft sphere | `AreaRadius "5"`, surface 5 |
| Fog Cloud | 20 ft sphere | `AreaRadius "4"`, `CreateSurface(4.5,...)` (the two numbers differ) |
| Hunger of Hadar | 20 ft sphere | `AreaRadius "6"` |
| Silence | 20 ft sphere | `AreaRadius "6"` |
| Spike Growth | 20 ft radius | `AreaRadius "6"` |
| Stinking Cloud | 20 ft sphere | `AreaRadius "6"` |
| Ice Storm | 20 ft cylinder | `AreaRadius "6"` |
| Sleet Storm | 40 ft cylinder | `AreaRadius "9"` |

**Wall of Fire.**
- The data says `Wall_WallOfFire`: `MaxDistance "9"`, `SurfaceType "Fire"`.
- The wiki spell-changes page says "Increased line: 36 m" and "There is no option to create
  a circular wall."
- **The two disagree.** MaxDistance may mean something other than the total length.
  UNVERIFIED.
- Sources: https://bg3.norbyte.dev/search?q=Wall_WallOfFire [primary: game data];
  https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

### 5.3 Did BG3 turn 5e cubes and squares into circles or cones?

- **Cubes and squares placed at a point → circles.** Examples: Grease (10 ft square → 4 m
  circle), Entangle (20 ft square → 3 m circle), Web (20 ft cube → 4 m circle), Faerie Fire
  (20 ft cube → 6 m circle), Cloud of Daggers (5 ft cube → 2 m circle). The wiki writes
  "(circle)" next to several of these on purpose.
- **Cubes that start at the caster → a Square zone (a rectangle out from the caster).**
  Thunderwave: 5 × 5 m. **It is not a cone.**
- **Lines → a Square zone (a long thin rectangle).** Lightning Bolt: 30 × 2 m.
- **Cones → a Cone zone with a 60° angle.** Examples: Burning Hands, Color Spray, and Cone
  of Cold.
- **General rule, from the wiki:** "15 ft spheres and cubes usually become 13 ft (4 m)
  spheres." Source: https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki]

### 5.4 Is a creature hit if any part of it overlaps, or only its center?

- **Auras (and summoned areas that use aura statuses): the hitbox counts.** "An aura
  accounts for the size of a creature's hitbox."
  Source: https://bg3.wiki/wiki/Threatened_(Condition) [wiki]
- **Ranged "too close" check: center point.** Same source.
- **Explosions (Fireball) and zones (Thunderwave, Burning Hands): not documented.** No
  source found here states whether BG3 tests the target's center or its bound.
  UNVERIFIED. Test this in the game with a Large target at the edge of a Fireball ring.
- Large creatures made of several parts, such as dragons, can register more than once in
  proximity checks. Source: https://bg3.wiki/wiki/Threatened_(Condition) (Bugs) [wiki]
- Historical contrast from DOS2, the same engine family: players complained that spells
  "are hitting beyond the displayed radius". No Larian reply.
  Source: https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=625652 (2017)
  [secondary; DOS2, not BG3]

---

## 6. Creature footprint and size

**Claim 6.1.** Size affects space and interaction. "Creature size roughly communicates
other parameters like the model's dimensions, how much space it physically occupies, their
weight, and their ability to interact with the environment."
- Sizes are Tiny, Small, Medium, Large, Huge, and Gargantuan.
- The wiki's size table is keyed by *weight*. For example: Medium is 45–200 kg, Large is
  205–5,000 kg, and Huge is 5,005–50,000 kg.
- Weight decides who can Throw or Shove a creature. A creature can throw up to
  0.2 × STR² kg.
- Enlarge moves a creature up one size and scales its model by 33%.

Sources: https://bg3.wiki/wiki/Creature_size [wiki]; https://bg3.wiki/wiki/Enlarge [wiki]

**Claim 6.2.** The collision footprint is the **AI bound**. It can be a box or a cylinder.
On the navigation grid it covers a rectangle the size of the bound.
- The DOS2 docs say: "No matter if a character has a box or a cylinder AI bound, they will
  always take up a rectangle with the size of the bound."
  Source: https://docs.larian.game/AI_grid [primary: Larian; DOS2 engine docs]
- The BG3 docs say FindValidPosition places an object so that it fits its AI bounds.
  Source: https://docs.baldursgate3.game/index.php?title=FindValidPosition [primary: Larian]

**Claim 6.3.** No public source found here gives a standard bound radius for each size,
such as "Medium = 0.5 m". Bounds are set in each creature's template. UNVERIFIED.

**Claim 6.4.** Size affects hits and melee through the hitbox:
- Auras include the hitbox (5.4).
- Multi-part large creatures can threaten you more than once (3.4).
- Tiny creatures can pass through gaps that Small creatures cannot, such as pipes and
  fence bars.

Source: https://bg3.wiki/wiki/Enlarge/Reduce [wiki]

---

## 7. UI: what BG3 draws on the ground

**Claim 7.1. There is no grid overlay.** No source describes a grid display option in BG3.
Movement is a free line (2.1.1). The AI grid exists only inside the engine and the editor.
Its colored-cell view is an editor tool (https://docs.larian.game/AI_grid) [primary:
Larian]. Treat "no grid is shown" as confirmed only by the absence of any grid in the
guides and wiki. [secondary]

**Claim 7.2.** Elements the sources confirm:

| UI element | What it does | Source |
|---|---|---|
| Path line | "white line indicates the path the character will take" | https://www.shacknews.com/article/136590/combat-explainer-baldurs-gate-3 [secondary] |
| Remaining movement | blue ring near End Turn | same; https://game8.co/games/Baldurs-Gate-III/archives/419902 [secondary] |
| Distance readout at cursor | flickers as it passes over objects and creatures | https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=877736 [secondary] |
| Opportunity attack warning | red arrow or icon on the path | https://gamerant.com/baldurs-gate-3-bg3-how-avoid-opportunity-attacks-reaction-hit-melee-move/ [secondary] |
| Own melee range | white circle around the character | https://steamcommunity.com/sharedfiles/filedetails/?id=3122428771 [secondary] |
| High/low ground | +2/-2 shown under the target's HP bar while aiming | https://bg3.wiki/wiki/High_ground_rules [wiki] |
| Fall damage | preview shows damage, or "Dead" | https://bg3.wiki/wiki/Falling_damage [wiki] |
| Force/push | trajectory preview (Patch 3) | https://baldursgate3.game/news/community-update-11-inspiration-freedom-pacifism_17 [primary: Larian] |
| Zone shape | Shape "decides how the area is visualized and which targets are hit" | https://github.com/NellsRelo/bg3-schema/blob/main/stats/types/SpellData.md [secondary] |

**Claim 7.3.** Commonly described, but UNVERIFIED here. No primary or wiki source was found:
- A range ring on the ground while aiming.
- AoE templates (circle, cone, or rectangle) that follow the cursor.
- Creatures inside the AoE preview highlighted in red for enemies and green for allies.
- A path that turns red past remaining movement.
- Chance-to-hit shown as a percentage over the target.
- Surface hazard icons along the path.

Confirm these with in-game screenshots before copying them.

**Claim 7.4. Contrast with other games.**
- **Solasta: Crown of the Magister** uses a visible 3D grid of "cells". Its director
  explained: "using cells (5 'x 5 'x 5' block) instead of feet to avoid confusion and
  conversion problems for countries using the metric system."
  Source: https://www.solasta-game.com/news/11-directors-log-2-adapting-the-ruleset
  (2019-07-22) [primary: developer]
- **Pathfinder: Wrath of the Righteous** is gridless and measured in feet. Its turn-based
  mode shows "the exact path your character will take toward their target, taking static
  obstacles and other characters into account" and "any attacks of opportunity that
  enemies are going to make if the character takes this path."
  Source: https://wrath.owlcat.games/news/16 [primary: developer]
- **Divinity: Original Sin 2** is gridless and measured in meters. It uses Action Points
  instead of a movement budget. The UI shows AP as green circles, and the cost of the move
  you are planning shows as red circles.
  Source: https://divinity.fandom.com/wiki/Original_Sin_2_Action_Points [secondary]
- BG3 inherited DOS2's movement system, per
  https://www.thegamer.com/baldurs-gate-3-biggest-differences-dnd-dungeons-dragons/ [secondary]

---

## 8. Surfaces are free-form shapes on the AI grid

**Claim 8.1.** "A surface is a flat layer of some type of substance that covers the
ground."
- Examples: fire, grease, water, ice, acid, web, and blood.
- Surfaces change into each other. Grease or alcohol plus fire becomes a fire surface.
  Water plus cold becomes ice. Water plus lightning becomes electrified water.
- Flying avoids surfaces.
- Clouds are a separate layer above the ground. Examples: Fog, Stinking Cloud, Cloudkill,
  and Darkness.
- Ice, lava, and web surfaces count as difficult terrain.

Sources: https://bg3.wiki/wiki/Surfaces [wiki]; https://bg3.wiki/wiki/Clouds [wiki];
https://bg3.wiki/wiki/Areas [wiki]

**Claim 8.2. Spells make surfaces as circles.**
- CreateSurfaceAtPosition "Creates a circular surface of type `_SurfaceType`, with a
  radius of `_Radius` meters".
- "the surface is created on the AI grid anyway". Because of this, the Y (height) argument
  is ignored.
- Spell data uses the same form: `CreateSurface(radius, turns, type)`. For example,
  Grease is `CreateSurface(4,10,Grease)`.

Sources: https://docs.baldursgate3.game/index.php?title=CreateSurfaceAtPosition [primary: Larian];
https://bg3.norbyte.dev/search?q=Target_Grease [primary: game data]

**Claim 8.3. Puddles grow as irregular blobs of grid tiles.** CreatePuddle grows a surface
"in a random fashion, to a random final size between `_CellAmountMin` and
`_CellAmountMax` (in AI grid tiles)". Unlike CreateSurface, it grows in "semi-randomized
directions".
Source: https://docs.baldursgate3.game/index.php?title=CreatePuddle [primary: Larian]

**Claim 8.4.** Zone spells change surfaces inside their shape and grow over time.
- Examples: `SurfaceChange(Ignite)` and `SurfaceChange(Melt)` on Burning Hands and
  Fireball.
- Fields such as `SurfaceGrowStep` and `SurfaceGrowInterval` control growth.
- Surfaces can also be sampled at a single point. GetSurfaceTurns reads the surface at an
  object's "AI-grid position".

Sources: https://bg3.norbyte.dev/search?q=Zone_BurningHands [primary: game data];
BG3 modding docs search for "AI grid" at https://docs.baldursgate3.game [primary: Larian]

**Meaning for Aralia.** BG3's surfaces are *raster* shapes, stored per nav-grid tile. They
are not vector polygons. A gridless combat UI can still keep a fine hidden grid for
surfaces and pathing, around 0.5 m if it copies the DOS2 engine value.

---

## 5e rule → BG3 behavior → source

| 5e rule | BG3 behavior | Source |
|---|---|---|
| Distances in feet, 5 ft squares | Meters, gridless. 5 ft = 1.5 m. Optional feet display (rounded) | https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki] |
| Speed 25 / 30 / 35 ft | 7.5 / 9 / 10.5 m, spent 1:1 along the path | https://bg3.wiki/wiki/Resources#Movement_speed [wiki] |
| Movement square by square | Free pathfound line. A hidden AI grid (0.5 m cells in DOS2 docs) is used for placement and pathing | https://docs.larian.game/AI_grid [primary: Larian, DOS2]; https://docs.baldursgate3.game/index.php?title=TeleportToPosition [primary: Larian] |
| Difficult terrain: 1 extra ft per ft | 2 m cost per 1 m. Plant Growth ×4. Also applies to jumps | https://bg3.wiki/wiki/Difficult_Terrain [wiki] |
| Dash = extra move equal to speed | Same, as an action. Repeat dashes add, not multiply. Maximum 3 | https://bg3.wiki/wiki/Dash [wiki] |
| Long jump = STR score in ft, costs movement | Bonus action plus a flat 3 m. 4.5 m base + 1 m per 2 STR over 10 | https://bg3.wiki/wiki/Jump [wiki] |
| No high-ground rule | +2 attack when ≥2.5 m above, −2 when ≥2.5 m below. Range grows by the height drop (the wiki's rule-changes page says 10 ft) | https://bg3.wiki/wiki/High_ground_rules [wiki] |
| Falling: 1d6 per 10 ft | None under 4 m. Then a % of max HP. Prone if the fall deals over 25% | https://bg3.wiki/wiki/Falling_damage [wiki] |
| Melee reach 5 ft | 1.5 m. Shove is also 1.5 m | https://bg3.wiki/wiki/Extra_Reach [wiki]; https://bg3.norbyte.dev/search?q=Target_Shove [primary: game data] |
| Reach weapons 10 ft | **2.5 m**, not 3 m. Glaive, halberd, pike | https://bg3.wiki/wiki/Extra_Reach [wiki] |
| Opportunity attack on leaving reach | Same. Tied to the Threatened condition. Needs a melee weapon in hand. Path shows a warning | https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki]; gamerant [secondary] |
| Ranged disadvantage when a hostile is within 5 ft | Two checks: Threatened (inside enemy melee reach) and "Target is too close" (≤3 m, from center) | https://bg3.wiki/wiki/Threatened_(Condition) [wiki] |
| Weapon normal/long range (longbow 150/600) | One range: 18 m (hand crossbow 15 m). Disadvantage only past normal range, which in practice happens only with high-ground extension | https://bg3.wiki/wiki/High_ground_rules ; https://bg3.wiki/wiki/Weapons [wiki] |
| Spell ranges 60–150+ ft | Capped at 18 m (Dimension Door 50 m). Touch = 1.5 m | https://bg3.wiki/wiki/D%26D_5e_spell_changes [wiki] |
| Range measured in 3D | Horizontal cylinder around the attacker. Height is ignored except for high-ground extension | https://bg3.wiki/wiki/High_ground_rules [wiki] |
| Half and three-quarters cover | Not implemented. Line of sight is still required | https://bg3.wiki/wiki/D%26D_5e_rule_changes [wiki] |
| Fireball: 20 ft radius sphere | 4 m radius circle, range 18 m | https://bg3.norbyte.dev/search?q=Projectile_Fireball [primary: game data] |
| Thunderwave: 15 ft cube from the caster | Square zone 5 m long × 5 m wide, pushed out from the caster (no FrontOffset). Push 8 m | https://bg3.norbyte.dev/search?q=Zone_Thunderwave [primary: game data] |
| Burning Hands: 15 ft cone | Cone zone 5 m, 60°, FrontOffset −2 | https://bg3.norbyte.dev/search?q=Zone_BurningHands [primary: game data] |
| Lightning Bolt: 100 × 5 ft line | Square zone 30 m × 2 m, FrontOffset −2 | https://bg3.norbyte.dev/search?q=Zone_LightningBolt [primary: game data] |
| Cone of Cold: 60 ft cone | Cone zone 9 m, 60° | https://bg3.norbyte.dev/search?q=Zone_ConeOfCold [primary: game data] |
| Grease: 10 ft square | **Circle, radius 4 m**, a surface | https://bg3.norbyte.dev/search?q=Target_Grease [primary: game data] |
| Web: 20 ft cube | Circle, radius 4 m, a surface | https://bg3.norbyte.dev/search?q=Target_Web [primary: game data] |
| Entangle: 20 ft square | Circle, radius 3 m | https://bg3.norbyte.dev/search?q=Target_Entangle [primary: game data] |
| Faerie Fire: 20 ft cube | Circle, radius 6 m | https://bg3.norbyte.dev/search?q=Target_FaerieFire [primary: game data] |
| Cloud of Daggers: 5 ft cube | Circle, radius 2 m (a summoned aura) | https://bg3.norbyte.dev/search?q=Target_CloudOfDaggers [primary: game data] |
| Spirit Guardians: 15 ft radius around self | 3 m aura around self. Counts the target's hitbox | https://bg3.norbyte.dev/search?q=Shout_SpiritGuardians [primary: game data]; https://bg3.wiki/wiki/Threatened_(Condition) [wiki] |
| Wall of Fire: 60 ft line or ring | Line only, no ring. Length disputed: data MaxDistance 9 vs wiki 36 m | https://bg3.norbyte.dev/search?q=Wall_WallOfFire ; https://bg3.wiki/wiki/D%26D_5e_spell_changes |
| Creature is in an area if part of its space is in it | Auras: the hitbox counts. Explosions and zones: undocumented (UNVERIFIED) | https://bg3.wiki/wiki/Threatened_(Condition) [wiki] |
| Creature space by size (5/10/15 ft squares) | AI bound (box or cylinder) per template. No public per-size radius table | https://docs.larian.game/AI_grid [primary: Larian, DOS2] |
| Grid templates for areas | No grid overlay. Areas are circles, cones, and rectangles. Surfaces are tile-raster blobs | https://docs.baldursgate3.game/index.php?title=CreatePuddle [primary: Larian] |

## Open items to check in the game (not settled by sources)

1. Are Fireball and zone spells tested against the target's center or its bound? Test
   with a Large target at the edge of the AoE ring.
2. Is the 1.5 m melee range measured to the target's edge or to its center? Test against
   an Ogre.
3. What is the default `FrontOffset` for Thunderwave? Confirm that the caster is never
   inside their own square.
4. Is Burning Hands' 5 m measured from the offset apex or from the caster?
5. What is the Wall of Fire length (9 m or 36 m)?
6. The exact UI colors: the path past the movement limit, AoE target highlights, and the
   range ring.
