# Icon Attribution

## Game Icons Armor Set

The SVG armor and shield icons in `public/assets/icons/general/armor/` are adapted from Game Icons.

- Source: https://game-icons.net
- Repository: https://github.com/game-icons/icons
- License: CC BY 3.0
- License URL: https://creativecommons.org/licenses/by/3.0/
- Imported via Iconify JSON package `@iconify-json/game-icons`.

Imported icons and local filenames:

- `leather_cap.svg` (Leather Cap) from `game-icons:billed-cap`
- `chainmail_coif.svg` (Chainmail Coif) from `game-icons:chain-mail`
- `steel_helmet.svg` (Steel Helmet) from `game-icons:visored-helm`
- `leather_gloves.svg` (Leather Gloves) from `game-icons:gloves`
- `chainmail_gauntlets.svg` (Chainmail Gauntlets) from `game-icons:gauntlet`
- `plate_gauntlets.svg` (Plate Gauntlets) from `game-icons:mailed-fist`
- `cloth_pants.svg` (Cloth Pants) from `game-icons:trousers`
- `leather_greaves.svg` (Leather Greaves) from `game-icons:greaves`
- `plate_greaves.svg` (Plate Greaves) from `game-icons:leg-armor`
- `soft_boots.svg` (Soft Boots) from `game-icons:leather-boot`
- `studded_boots.svg` (Studded Boots) from `game-icons:walking-boot`
- `steel_boots.svg` (Steel Boots) from `game-icons:steeltoe-boots`
- `leather_bracers.svg` (Leather Bracers) from `game-icons:bracer`
- `reinforced_bracers.svg` (Reinforced Bracers) from `game-icons:bracers`
- `padded_armor.svg` (Padded Armor) from `game-icons:armor-vest`
- `leather_armor.svg` (Leather Armor) from `game-icons:leather-armor`
- `studded_leather_armor.svg` (Studded Leather Armor) from `game-icons:spiked-armor`
- `hide_armor.svg` (Hide Armor) from `game-icons:fur-shirt`
- `chain_shirt.svg` (Chain Shirt) from `game-icons:mail-shirt`
- `scale_mail.svg` (Scale Mail) from `game-icons:scale-mail`
- `breastplate.svg` (Breastplate) from `game-icons:breastplate`
- `half_plate_armor.svg` (Half Plate Armor) from `game-icons:layered-armor`
- `ring_mail.svg` (Ring Mail) from `game-icons:chain-mail`
- `chain_mail.svg` (Chain Mail) from `game-icons:mail-shirt`
- `splint_armor.svg` (Splint Armor) from `game-icons:shoulder-armor`
- `plate_armor.svg` (Plate Armor) from `game-icons:chest-armor`
- `shield_std.svg` (Shield) from `game-icons:shield`
- `shield_plus_one.svg` (+1 Shield) from `game-icons:magic-shield`

## Mannequin Slot Icon Set

The SVGs in `public/assets/icons/mannequin/<light|medium|heavy>/<slot>.svg` back the
character sheet paper doll's empty-slot icons (`DynamicMannequinSlotIcon.tsx`). Armor
and shield glyphs are verbatim copies of files from the Game Icons Armor Set above
(same license); the remaining glyphs were fetched from the same Game Icons library via
the Iconify API (`https://api.iconify.design`) and re-wrapped in this repo's slate
silhouette conventions.

- Source: https://game-icons.net
- Repository: https://github.com/game-icons/icons
- License: CC BY 3.0
- License URL: https://creativecommons.org/licenses/by/3.0/

Armor/shield slots copied from `general/armor/` (source file in parentheses):

- `<tier>/head.svg` — light (`leather_cap`), medium (`chainmail_coif`), heavy (`steel_helmet`)
- `<tier>/torso.svg` — light (`leather_armor`), medium (`breastplate`), heavy (`plate_armor`)
- `<tier>/hands.svg` — light (`leather_gloves`), medium (`chainmail_gauntlets`), heavy (`plate_gauntlets`)
- `<tier>/wrists.svg` — light (`leather_bracers`), medium and heavy (`reinforced_bracers`)
- `<tier>/legs.svg` — light (`cloth_pants`), medium (`leather_greaves`), heavy (`plate_greaves`)
- `<tier>/feet.svg` — light (`soft_boots`), medium (`studded_boots`), heavy (`steel_boots`)
- `medium/offhand.svg` (`shield_std`)

Fetched from Game Icons via Iconify:

- `<tier>/mainhand.svg` — light from `game-icons:pointy-sword`, medium from `game-icons:sword-brandish`, heavy from `game-icons:battle-axe`
- `light/offhand.svg` from `game-icons:round-shield`; `heavy/offhand.svg` from `game-icons:spiked-shield`
- Accessory slots (same glyph in every tier): `neck` from `game-icons:necklace`, `cloak` from `game-icons:cloak`, `belt` from `game-icons:belt`, `ring1`/`ring2` from `game-icons:ring`

The accessory glyphs are identical across tiers because accessories do not change with
armor training; only armor, weapon, and shield slots vary by proficiency. There is no
`unarmored/` tier: `DynamicMannequinSlotIcon` falls back to the slot's default icon for
unarmored characters.
