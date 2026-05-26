# Package 13 Classification & Completion Notes

## Classifications

* **mold-earth**: `already_represented_after_proof` - Existing TerrainCommand excavate/difficult/normal/cosmetic logic covers the structured options, with focused tests added in this package.
* **prestidigitation**: `not_really_terrain_surface` - Cosmetic soil/clean actions are handled via Utility/Options rather than strict terrain manipulation.
* **thaumaturgy**: `not_really_terrain_surface` - Harmless tremors/doors are Utility effects.
* **snare**: `already_represented_after_proof` - The area trigger and restraint logic are correctly mapped to STATUS_CONDITION on_enter_area in JSON.
* **catapult**: `not_really_terrain_surface` - The object targeting logic handles the "lying on the ground" constraint implicitly via standard object filters.
* **comprehend-languages**: `not_really_terrain_surface` - Surface reading is a Utility interaction, not a mechanical terrain change.
* **tensers-floating-disk**: `defer_broader_system` - Movement over elevation changes requires a broader movement/following engine.
* **unseen-servant**: `defer_broader_system` - Interacting with surfaces is a broader object interaction and summon AI problem.
* **spider-climb**: `already_represented_after_proof` - Already represented as a UTILITY effect granting climb speed, which is the current mechanical abstraction for moving on vertical surfaces and ceilings.
* **spike-growth**: `implement_now` - The JSON currently has a `TERRAIN` `damaging` effect, but the prose also mandates difficult terrain. We will add a `TERRAIN` `difficult` effect to enforce movement cost.
* **web**: `implement_now` - Needs a `TERRAIN` `difficult` effect added to mechanically block movement.
* **flaming-sphere**: `defer_broader_system` - Surface jumping/barriers require advanced Summon AI/movement engine.
* **levitate**: `defer_broader_system` - Pushing off surfaces requires a more advanced movement modification system.
* **rope-trick**: `defer_broader_system` - Extra-dimensional space creation on surfaces is a broad structure/utility system.
* **cordon-of-arrows**: `defer_broader_system` - Planting objects requires trap authoring.
* **phantasmal-force**: `defer_broader_system` - Illusion arbitration on terrain requires a broader system.
* **erupting-earth**: `already_represented_after_proof` - The JSON already contains a `TERRAIN` `difficult` effect, with focused TerrainCommand tests covering the shared movement-cost behavior.
* **plant-growth**: `implement_now_with_residual_gap` - Change Overgrowth mode from `UTILITY` to `TERRAIN` `difficult` so it becomes mechanically visible now. The exact 4-feet-per-1-foot movement multiplier remains a residual gap for a future custom movement-cost multiplier system.
* **sleet-storm**: `implement_now` - Needs a `TERRAIN` `difficult` effect added.
* **speak-with-plants**: `defer_broader_system` - Turning difficult plant terrain into normal terrain requires dynamic tagging of terrain origins which we don't have yet.
* **gaseous-form**: `defer_broader_system` - Passing through cracks is an advanced movement collision feature.
* **glyph-of-warding**: `defer_broader_system` - Inscribing on surfaces is trap authoring.
* **meld-into-stone**: `defer_broader_system` - Merging into stone objects requires object possession/targeting.
* **melfs-minute-meteors**: `defer_broader_system` - Surface impact triggers require projectile collision engine.
* **summon-lesser-demons**: `defer_broader_system` - Summoning.
* **tidal-wave**: `defer_broader_system` - Extinguishing flames requires environmental hazard interaction system.
* **tiny-servant**: `defer_broader_system` - Summoning/object animation.
* **wall-of-sand**: `defer_broader_system` - Wall engine.
* **wall-of-water**: `defer_broader_system` - Wall engine.
* **water-walk**: `defer_broader_system` - Walking on liquids requires advanced movement system.
* **wind-wall**: `defer_broader_system` - Wall engine.
