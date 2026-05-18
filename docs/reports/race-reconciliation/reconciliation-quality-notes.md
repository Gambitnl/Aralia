# Race Reconciliation Quality Notes

## Corrections From The First Reconciliation Pass

- Breath Weapon was previously able to fall into weak keyword buckets such as weapon proficiency or environmental adaptation. It is now its own unsupported `breath_weapon` family because Aralia has no breath action, save DC, area, scaling, damage type, or rest-reset engine for it.
- Speed and darkvision are no longer marked implemented merely because their text contains those words. They are `enforced_now` only because the capability matrix cites character creation and rehydration code paths that consume them.
- Fixed skill proficiency is no longer treated as globally implemented from text alone. It is enforced only for the known hardcoded racial skill paths in character assembly and skill selection utilities.
- Tool, weapon, and language proficiencies are display-only until Race gains structured fields and validation/sheet code consumes them.
- Creature Type and Size are kept as display/lore identity text; they are not treated as creature communication mechanics.

## Remaining Weaknesses

- The classifier still uses text to suggest a mechanic family, so ambiguous traits remain human-review items.
- Vendor candidates are reference evidence only. They are not imported into Aralia race data.
- Some Aralia traits combine enforced and unsupported pieces in one sentence, such as walk speed plus swim speed. The report can classify the trait family, but future runtime data should split those details structurally.
