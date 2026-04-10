# Spell Description Sub-Bucket Report

This report breaks the structured-vs-canonical `Description` mismatch bucket into smaller review families.

Generated: 2026-04-09T10:52:46.625Z
Description mismatches analyzed: 51
Sub-buckets: 6

These sub-buckets are heuristic review helpers. They do not decide which description is correct; they only make the review queue more legible.

## Grouped Description Sub-Buckets

### Area And Targeting Wording Shift

- Bucket Id: `area-and-targeting-wording-shift`
- Occurrences: 23
- Rationale: The main drift is in area-of-effect or targeting phrasing, especially older vs current source wording.
- Sample spells: arcane-eye, banishment, control-water, fabricate, mordenkainens-private-sanctum, storm-sphere, vitriolic-sphere, animate-objects, bigbys-hand, conjure-volley

### General Phrasing Rewrite

- Bucket Id: `general-phrasing-rewrite`
- Occurrences: 11
- Rationale: These descriptions look like broad same-mechanic rewrites where the sentence structure and detail selection changed without one dominant narrow mismatch type.
- Sample spells: aura-of-life, aura-of-purity, freedom-of-movement, circle-of-power, contact-other-plane, hallow, mislead, raise-dead, reincarnate, resurrection

### Condition And Save Wording Shift

- Bucket Id: `condition-and-save-wording-shift`
- Occurrences: 10
- Rationale: The underlying mechanic looks similar, but the phrasing around conditions, saves, and success/failure outcomes differs.
- Sample spells: enlarge-reduce, enthrall, blight, watery-sphere, destructive-wave, modify-memory, scrying, transmute-rock, wall-of-light, whirlwind

### Uncategorized

- Bucket Id: `uncategorized`
- Occurrences: 3
- Rationale: These mismatches still need a more specific taxonomy or individual review.
- Sample spells: sickening-radiance, summon-greater-demon, greater-restoration

### 2024 Terminology Shift

- Bucket Id: `canonical-2024-terminology-shift`
- Occurrences: 2
- Rationale: Canonical text uses updated 2024 rules vocabulary while the structured description still uses older or less glossary-aligned phrasing.
- Sample spells: control-winds, swift-quiver

### Damage And Scaling Wording Shift

- Bucket Id: `damage-and-scaling-wording-shift`
- Occurrences: 2
- Rationale: The difference is concentrated in damage, healing, temporary hit points, or scaling math wording.
- Sample spells: evards-black-tentacles, polymorph

## Sample Spell Assignments

### Enlarge/Reduce

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-2\enlarge-reduce.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: For the duration, the spell enlarges or reduces a creature or an object you can see within range (see the chosen effect below). A targeted object must be neither worn nor carrie...
- Canonical Preview: For the duration, the spell enlarges or reduces a creature or an object you can see within range (see the chosen effect below). A targeted object must be neither worn nor carrie...

### Enthrall

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-2\enthrall.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: You weave a distracting string of words, causing creatures of your choice that you can see within range to make a Wisdom saving throw. Any creature you or your companions are fi...
- Canonical Preview: You weave a distracting string of words, causing creatures of your choice that you can see within range to make a Wisdom saving throw. Any creature you or your companions are fi...

### Arcane Eye

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\arcane-eye.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You create an Invisible, invulnerable eye within range that hovers for the duration. You mentally receive visual information from the eye, which can see in every direction. It a...
- Canonical Preview: You create an Invisible , invulnerable eye within range that hovers for the duration. You mentally receive visual information from the eye, which can see in every direction. It ...

### Aura of Life

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\aura-of-life.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: Life-preserving energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) has resistance to necrotic damage, and its ...
- Canonical Preview: Life-preserving energy radiates from you in an aura with a 30-foot radius. Until the spell ends, the aura moves with you, centered on you. Each nonhostile creature in the aura (...

### Aura of Purity

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\aura-of-purity.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: Purifying energy radiates from you in a 30-foot radius. For the duration, each non-hostile creature in the aura (including you) can't become diseased, has resistance to poison d...
- Canonical Preview: Purifying energy radiates from you in an aura with a 30-foot radius. Until the spell ends, the aura moves with you, centered on you. Each nonhostile creature in the aura (includ...

### Banishment

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\banishment.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration. While there, the target has the In...
- Canonical Preview: One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration. While there, the target has the In...

### Blight

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\blight.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: A creature that you can see within range makes a Constitution saving throw, taking 8d8 Necrotic damage on a failed save or half as much damage on a successful one. A Plant creat...
- Canonical Preview: A creature that you can see within range makes a Constitution saving throw, taking 8d8 Necrotic damage on a failed save or half as much damage on a successful one. A Plant creat...

### Control Water

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\control-water.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: Until the spell ends, you control any water inside an area you choose that is a Cube up to 100 feet on a side, using one of the following effects. As a Magic action on your late...
- Canonical Preview: Until the spell ends, you control any water inside an area you choose that is a Cube up to 100 feet on a side, using one of the following effects. As a Magic action on your late...

### Evard's Black Tentacles

- Bucket: `damage-and-scaling-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\evards-black-tentacles.md
- Reason: The mismatch is centered on how the spell expresses damage, healing, or scaling math rather than on a different spell effect entirely.
- Structured Preview: Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the ground in that area into Difficult Terrain. ...
- Canonical Preview: Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the ground in that area into Difficult Terrain ....

### Fabricate

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\fabricate.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You convert raw materials into products of the same material. For example, you can fabricate a wooden bridge from a clump of trees, a rope from a patch of hemp, or clothes from ...
- Canonical Preview: You convert raw materials into products of the same material. For example, you can fabricate a wooden bridge from a clump of trees, a rope from a patch of hemp, or clothes from ...

### Freedom of Movement

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\freedom-of-movement.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical effects can neither reduce the target's Sp...
- Canonical Preview: You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain , and spells and other magical effects can neither reduce the target's S...

### Mordenkainen's Private Sanctum

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\mordenkainens-private-sanctum.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You make an area within range magically secure. The area is a Cube that can be as small as 5 feet to as large as 100 feet on each side. The spell lasts for the duration. When yo...
- Canonical Preview: You make an area within range magically secure. The area is a Cube that can be as small as 5 feet to as large as 100 feet on each side. The spell lasts for the duration. When yo...

### Polymorph

- Bucket: `damage-and-scaling-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\polymorph.md
- Reason: The mismatch is centered on how the spell expresses damage, healing, or scaling math rather than on a different spell effect entirely.
- Structured Preview: You attempt to transform a creature that you can see within range into a Beast. The target must succeed on a Wisdom saving throw or shape-shift into a Beast form for the duratio...
- Canonical Preview: You attempt to transform a creature that you can see within range into a Beast. The target must succeed on a Wisdom saving throw or shape-shift into Beast form for the duration....

### Sickening Radiance

- Bucket: `uncategorized`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\sickening-radiance.md
- Reason: The mismatch did not meet any current heuristic strongly enough to assign a narrower review bucket.
- Structured Preview: 
- Canonical Preview: Dim, greenish light spreads within a 30-foot-radius sphere centered on a point you choose within range. The light spreads around corners, and it lasts until the spell ends. When...

### Storm Sphere

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\storm-sphere.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: A 20-foot-radius sphere of whirling air springs into existence centered on a point you choose within range. The sphere remains for the spell's duration. Each creature in the sph...
- Canonical Preview: A 20-foot-radius sphere of whirling air springs into existence centered on a point you choose within range. The sphere remains for the spell's duration. Each creature in the sph...

### Summon Greater Demon

- Bucket: `uncategorized`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\summon-greater-demon.md
- Reason: The mismatch did not meet any current heuristic strongly enough to assign a narrower review bucket.
- Structured Preview: 
- Canonical Preview: You utter foul words, summoning one demon from the chaos of the Abyss. You choose the demon's type, which must be one of challenge rating 5 or lower, such as a shadow demon or a...

### Vitriolic Sphere

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\vitriolic-sphere.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You point at a location within range, and a glowing, 1-foot-diameter ball of acid streaks there and explodes in a 20-foot-radius Sphere. Each creature in that area makes a Dexte...
- Canonical Preview: You point at a location within range, and a glowing, 1-foot-diameter ball of acid streaks there and explodes in a 20-foot-radius Sphere . Each creature in that area makes a Dext...

### Watery Sphere

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\watery-sphere.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: You conjure up a sphere of water with a 5-foot radius on a point you can see within range. The sphere can hover in the air, but no more than 10 feet off the ground. The sphere r...
- Canonical Preview: You conjure up a sphere of water with a 5-foot radius at a point you can see within range. The sphere can hover but no more than 10 feet off the ground. The sphere remains for t...

### Animate Objects

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\animate-objects.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: Objects animate at your command. Choose a number of nonmagical objects within range that aren't being worn or carried, aren't fixed to a surface, and aren't Gargantuan. The maxi...
- Canonical Preview: Objects animate at your command. Choose a number of nonmagical objects within range that aren't being worn or carried, aren't fixed to a surface, and aren't Gargantuan. The maxi...

### Bigby's Hand

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\bigbys-hand.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You create a Large hand of shimmering, translucent force in an unoccupied space that you can see within range. The hand lasts for the spell's duration, and it moves at your comm...
- Canonical Preview: You create a Large hand of shimmering, translucent force in an unoccupied space that you can see within range. The hand lasts for the spell's duration, and it moves at your comm...

### Circle of Power

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\circle-of-power.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: Divine energy radiates from you, warding you and your allies from harm. For the duration, each friendly creature in a 30-foot radius (including you) has advantage on saving thro...
- Canonical Preview: Divine energy radiates from you, distorting and diffusing magical energy within 30 feet of you. Until the spell ends, the sphere moves with you, centered on you. For the duratio...

### Conjure Volley

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\conjure-volley.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You fire a piece of nonmagical ammunition from a ranged weapon or throw a nonmagical weapon into the air and choose a point within range.
- Canonical Preview: You fire a piece of nonmagical ammunition from a ranged weapon or throw a nonmagical weapon into the air and choose a point within range. Hundreds of duplicates of the ammunitio...

### Contact Other Plane

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\contact-other-plane.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from another plane. Contacting this otherworldly intelligence can break your m...
- Canonical Preview: You mentally contact a demigod, the spirit of a long-dead sage, or some other knowledgeable entity from another plane. Contacting this otherworldly intelligence can break your m...

### Control Winds

- Bucket: `canonical-2024-terminology-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\control-winds.md
- Reason: The canonical description uses 2024-era rules terminology or glossary language that the structured description still expresses in older wording.
- Structured Preview: 
- Canonical Preview: You take control of the air in a 100-foot cube that you can see within range. Choose one of the following effects when you cast the spell. The effect lasts for the spell's durat...

### Destructive Wave

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\destructive-wave.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: Destructive energy ripples outward from you in a 30-foot Emanation. Each creature you choose in the Emanation makes a Constitution saving throw. On a failed save, a target takes...
- Canonical Preview: Destructive energy ripples outward from you in a 30-foot Emanation . Each creature you choose in the Emanation makes a Constitution saving throw. On a failed save, a target take...

### Greater Restoration

- Bucket: `uncategorized`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\greater-restoration.md
- Reason: The mismatch did not meet any current heuristic strongly enough to assign a narrower review bucket.
- Structured Preview: You touch a creature and magically remove one of the following effects from it:
- Canonical Preview: You touch a creature and magically remove one of the following effects from it: 1 Exhaustion level The Charmed or Petrified condition A curse, including the target's Attunement ...

### Hallow

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\hallow.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already un...
- Canonical Preview: You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already un...

### Infernal Calling

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\infernal-calling.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: Uttering a dark incantation, you summon a devil from the Nine Hells. You choose the devil's type, which must be one of challenge rating 6 or lower, such as a barbed devil or a b...
- Canonical Preview: Uttering a dark incantation, you summon a devil from the Nine Hells. You choose the devil's type, which must be one of challenge rating 6 or lower, such as a barbed devil or a b...

### Maelstrom

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\maelstrom.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: A mass of 5-foot-deep water appears and swirls in a 30-foot radius centered on a point you can see within range. The point must be on ground or in a body of water. Until the spe...
- Canonical Preview: A swirling mass of 5-foot-deep water appears in a 30-foot radius centered on a point you can see within range. The point must be on the ground or in a body of water. Until the s...

### Mass Cure Wounds

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\mass-cure-wounds.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains h...
- Canonical Preview: A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains h...

### Mislead

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\mislead.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You become invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration, but the invisibility ends if you attack o...
- Canonical Preview: You become invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration, but the invisibility ends if you attack o...

### Modify Memory

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\modify-memory.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting the creature, it has Advantage on the savi...
- Canonical Preview: You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting the creature, it has advantage on the savi...

### Planar Binding

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\planar-binding.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to your service. The creature must be within range for the entire casting of the spell. (Typica...
- Canonical Preview: With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to your service. The creature must be within range for the entire casting of the spell. (Typica...

### Raise Dead

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\raise-dead.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature's soul is both willing and at liberty to rejoin the body, th...
- Canonical Preview: You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature's soul is both willing and at liberty to rejoin the body, th...

### Reincarnate

- Bucket: `general-phrasing-rewrite`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\reincarnate.md
- Reason: The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.
- Structured Preview: You touch a dead Humanoid or a piece of one. If the creature has been dead no longer than 10 days, the spell forms a new body for it and calls the soul to enter that body. Roll ...
- Canonical Preview: You touch a dead humanoid or a piece of a dead humanoid. Provided that the creature has been dead no longer than 10 days, the spell forms a new adult body for it and then calls ...

### Scrying

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\scrying.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well yo...
- Canonical Preview: You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well yo...

### Swift Quiver

- Bucket: `canonical-2024-terminology-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\swift-quiver.md
- Reason: The canonical description uses 2024-era rules terminology or glossary language that the structured description still expresses in older wording.
- Structured Preview: You transmute your quiver so it produces an endless supply of nonmagical ammunition, which seems to leap into your hand when you reach for it. On each of your turns until the sp...
- Canonical Preview: You transmute your quiver so it produces an endless supply of nonmagical ammunition, which seems to leap into your hand when you reach for it. On each of your turns until the sp...

### Telekinesis

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\telekinesis.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell and as a Magic action on your later turns before the spell ends, you can exer...
- Canonical Preview: You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell and as a Magic action on your later turns before the spell ends, you can exer...

### Transmute Rock

- Bucket: `condition-and-save-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\transmute-rock.md
- Reason: Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.
- Structured Preview: You choose an area of stone or mud that you can see that fits within a 40-foot cube and that is within range, and choose one of the following effects. Transmute Rock to Mud: Non...
- Canonical Preview: You choose an area of stone or mud that you can see that fits within a 40-foot cube and is within range, and choose one of the following effects. Transmute Rock to Mud. Nonmagic...

### Wall of Force

- Bucket: `area-and-targeting-wording-shift`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\wall-of-force.md
- Reason: The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.
- Structured Preview: An Invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at a...
- Canonical Preview: An Invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at a...

