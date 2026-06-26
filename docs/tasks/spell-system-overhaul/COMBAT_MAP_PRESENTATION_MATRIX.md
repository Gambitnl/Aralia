# Combat Map Presentation Matrix

Status: v0 scaffold, created 2026-06-01 for `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`.

This file answers the project-level question that must now stay attached to every structured spell gap: what does the spell look like on the combat map in both 2D and 3D?

This is not rendered proof. It is the durable checklist future agents should use before calling a spell mechanic complete. A row is complete only when the mechanic is implemented, its 2D presentation is legible, its 3D presentation is legible, and the rendered evidence is captured in `AUDIT_OR_PROOF.md` or a linked proof artifact.

## Presentation states

| State | Meaning | Required proof |
| --- | --- | --- |
| `no-map` | The spell changes information, resources, preparation, or narrative state without a tactical map object. | UI/log proof that the spell has no hidden map obligation. |
| `instant-feedback` | The spell resolves immediately and leaves only outcome feedback. | 2D and 3D proof for damage, healing, miss, save, resist, immune, or failure labels. |
| `targeting-preview` | The spell needs player-visible target, destination, area, range, LoS, cover, or legality feedback before resolution. | Rendered targeting proof in both map modes. |
| `persistent-zone` | The spell leaves an area, terrain, light, fog, hazard, aura, or other map-owned zone after casting. | Creation, ongoing visibility, trigger behavior, and cleanup proof in both map modes. |
| `token-or-object` | The spell creates or changes a creature, object, servant, disk, mount, weapon, hand, wall, or similar map entity. | 2D token/object and 3D representation proof, including blocking/movement/cleanup rules. |
| `status-marker` | The spell primarily attaches a condition, buff, debuff, concentration marker, rider, or delayed effect to an actor. | Actor marker/status visibility proof in both renderers plus expiry/cleanup proof. |
| `hybrid` | The spell needs more than one state, such as a preview plus a persistent zone plus status markers. | Proof for every involved presentation state, not only the easiest one. |

## Effect-category matrix

| Effect or spell family | Presentation state | 2D expectation | 3D expectation | Current evidence | Open rows / gaps | Proof still needed |
| --- | --- | --- | --- | --- | --- | --- |
| Direct damage and healing | `instant-feedback` | Floating or anchored result text for damage, healing, miss, save, resist, and immunity. | Equivalent 3D result text or marker near the affected actor. | Shared damage/heal/miss feedback exists in the visual progress notes under `SSO-COMBAT-MAP-VISUALIZATION-001`. | `SSO-COMBAT-MAP-VISUALIZATION-001` | Rendered 2D/3D proof for hit, miss, heal, save success, resistance, and immunity. |
| Single-target buffs and debuffs | `status-marker` | Actor-level marker, status strip, or hover-visible label that identifies the spell effect. | Equivalent actor label or overhead/status marker. | Status labels and concentration/status notes exist, and Enhance Ability now creates a visible named buff. | `SSO-STATUS-STACKING-CONSISTENCY-001`; `SSO-STATUS-CONDITION-EXPIRY-MIRROR-001`; `SSO-COMBAT-MAP-VISUALIZATION-001` | Rendered marker and cleanup proof for representative buff, debuff, and condition effects. |
| Concentration effects | `status-marker` plus possible `persistent-zone` or `token-or-object` | Caster concentration state and affected map artifact remain understandable. | Equivalent 3D label/artifact, including cleanup after concentration breaks. | Concentration cleanup and some visual labels are tracked in existing rows. | `SSO-COMBAT-MAP-VISUALIZATION-001`; light/terrain/summon rows as applicable | Rendered proof that concentration break removes every visible artifact the spell created. |
| Area targeting previews | `targeting-preview` | Shape/radius/line/cone/cube preview before commit, with legal/illegal target feedback. | Equivalent 3D preview, including elevation where applicable. | AoE preview and shared geometry work exists, but policy holes remain. | `SSO-GEOMETRY-CYLINDER-HEIGHT-001`; `SSO-GEOMETRY-CUBE-CENTERING-001`; `SSO-LOS-COVER-MAP-VISUALS-001` | Rendered preview proof for sphere, cone, line, cube, cylinder, and blocked/covered target cases. |
| Persistent damaging or control zones | `persistent-zone` | Area remains visible after casting and communicates triggers such as enter, exit, start/end turn, or move within. | Equivalent 3D zone volume or footprint, with height/elevation rules where relevant. | Active zones are surfaced in both renderers and trigger rows exist. | `SSO-AREA-ENTRY-EXIT-001`; `SSO-AREA-MOVE-WITHIN-COVERAGE-001`; `SSO-AOE-CONTAINMENT-PARITY-001`; geometry rows | Rendered creation, trigger, repeated-save, and cleanup proof. |
| Terrain and environmental mutation | `persistent-zone` | Difficult terrain, altered tiles, fog, plants, webbing, grease, or surface changes are visible and distinguishable. | Equivalent 3D ground/volume treatment without hiding tactical readability. | Terrain mutation and mapless terrain persistence are tracked; 2D/3D environmental proof remains pending. | `SSO-TERRAIN-MAPLESS-PERSISTENCE-001`; `SSO-MAPLESS-TERRAIN-SUMMARY-UI-001`; `SSO-COMBAT-MAP-VISUALIZATION-001` | Rendered terrain-state proof in both renderers plus mapless summary decision if mapless combat is supported. |
| Light, darkness, and visibility | `persistent-zone` | Bright/dim/dark/hidden areas are visibly distinct and tied to active light sources. | Equivalent 3D light rings, masks, darkness/fog treatment, and visible-tile policy. | Light sources and visibility consumers are wired but proof is pending. | `SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001`; `SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001`; `SSO-VISIBILITY-OBSERVER-POLICY-001` | Rendered proof for bright, dim, dark, hidden, creation, movement if applicable, and cleanup. |
| Forced movement and teleport outcomes | `instant-feedback` plus `targeting-preview` when destination is chosen | Destination preview where player choice is involved; movement path or landing cue after resolution. | Equivalent 3D route/landing/vertical placement cue. | Movement and teleport outcome cues exist, but preview and vertical policy remain split. | `SSO-COMBAT-MAP-VISUALIZATION-001`; teleport/destination assignment rows; geometry/elevation rows | Rendered proof for selected destination, illegal destination, path cue, landing cue, and cleanup. |
| Summoned creatures and mounts | `token-or-object` plus possible `status-marker` | New actor token, ownership/control indication, initiative/turn cues, and disappearance behavior. | Equivalent 3D actor representation with readable ownership/control and cleanup. | Command-created summons become combat characters, but choice/economy/map categories remain open. | `SSO-SUMMONING-RUNTIME-PARITY-001`; `SSO-SUMMONING-FORM-SELECTION-001`; `SSO-SUMMONING-COMMAND-ECONOMY-001`; `SSO-SUMMONING-MAP-VISUALS-001`; `SSO-LEVEL1-FAMILIAR-RUNTIME-001` | Rendered proof for familiar, steed, obedient summon, and hostile/uncontrolled summon categories. |
| Summoned servants, disks, hands, weapons, walls, or objects | `token-or-object` or `persistent-zone` | Non-creature object has a visible location, size, blocking/interaction policy, duration, and cleanup. | Equivalent 3D object/volume representation with readable interaction rules. | Summoning map visuals row already calls out servants, disks, objects, and constructs. | `SSO-SUMMONING-MAP-VISUALS-001`; object-targeting rows; future object/entity rows | Rendered proof for at least one invisible servant, disk/object, and wall/guardian-style construct. |
| Object-targeting and object effects | `targeting-preview` plus possible `token-or-object` | Objects are selectable or highlighted with legality/failure reasons. | Equivalent 3D object selection/readability. | Object targeting is schema-supported but resolver/runtime incomplete. | `SSO-OBJECT-TARGET-001`; `SSO-TARGET-ENVELOPE-001`; `SSO-TARGET-FILTER-FEEDBACK-001` | Proof that a spell can target a map object and that invalid object/creature choices explain why. |
| Creature-type restricted targeting | `targeting-preview` | Invalid targets explain their mismatch, such as wrong creature type. | Equivalent 3D targeting feedback. | Resolver rejects filter mismatches but lacks structured UI reason. | `SSO-TARGET-FILTER-FEEDBACK-001`; creature taxonomy rows | Rendered invalid-target reason proof in both renderers. |
| Reactions and interrupts | `targeting-preview` or `status-marker` depending on spell | Prompt or marker must make timing, trigger, and selected target clear. | Equivalent 3D prompt/marker if map context matters. | Generic reaction prompt exists, but Shield-style runtime wiring remains open. | `SSO-AC-REACTION-WIREUP-001`; reaction rows if split later | Proof that a reaction offer appears at the right moment and the resulting visual state is clear. |
| Rituals, material costs, preparation, and purely informational spells | `no-map` unless the spell later creates a map artifact | No map artifact unless the resolved spell effect requires one; UI/log should make non-map resolution clear. | Same contract as 2D. | Ritual/material runtime rows are open and mostly non-map unless their spell effect later creates a map entity. | `SSO-LEVEL1-RITUAL-RUNTIME-001`; `SSO-LEVEL1-MATERIAL-RUNTIME-GATE-001`; `SSO-LEVEL1-MATERIAL-CONSUMPTION-001` | Proof that non-map spells do not create phantom map state, and map-producing rituals still use the relevant presentation category. |

## Required checklist for future spell-gap slices

Before moving a spell gap beyond `waiting`, answer these questions in the row or linked proof:

1. What presentation state applies: `no-map`, `instant-feedback`, `targeting-preview`, `persistent-zone`, `token-or-object`, `status-marker`, or `hybrid`?
2. What should a player see in 2D before the spell is committed?
3. What should a player see in 3D before the spell is committed?
4. What should a player see after resolution?
5. If the spell persists, what keeps it visible, what updates it, and what removes it?
6. If the spell creates an actor or object, what shows ownership, control, initiative, blocking, movement, and cleanup?
7. What rendered proof exists, and where is it recorded?
8. If no rendered proof exists, which exact visual gap remains open?

## Representative proof probes

These spells or spell families should be used as proof probes because they exercise different visual categories:

| Probe | Why it matters | Related rows |
| --- | --- | --- |
| Enhance Ability | Per-target choice plus actor-visible buff marker. | `SSO-PER-TARGET-CHOICE-EXECUTION-001`; `SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001` |
| Grease or Entangle | Persistent terrain/control zone with repeat interactions. | `SSO-AREA-ENTRY-EXIT-001`; `SSO-AREA-MOVE-WITHIN-COVERAGE-001`; terrain rows |
| Fog Cloud or Darkness-style effects | Visibility/obscurement and map readability. | light/visibility rows; terrain/environment rows |
| Thunderwave or forced-movement spell | Immediate movement cue and route/landing feedback. | `SSO-COMBAT-MAP-VISUALIZATION-001`; movement rows |
| Misty Step or teleport destination spell | Destination choice and legal landing feedback. | teleport/destination rows; `SSO-COMBAT-MAP-VISUALIZATION-001` |
| Find Familiar | Summoned actor, replacement/disappearance, special familiar behavior. | `SSO-LEVEL1-FAMILIAR-RUNTIME-001`; summon rows |
| Find Steed or Summon Beast | Form choice, ownership, initiative, command economy, and token readability. | `SSO-SUMMONING-FORM-SELECTION-001`; `SSO-SUMMONING-COMMAND-ECONOMY-001`; `SSO-SUMMONING-MAP-VISUALS-001` |
| Summon Lesser/Greater Demon | Hostile or uncontrolled summon behavior and AI/map ownership clarity. | `SSO-SUMMONING-COMMAND-ECONOMY-001`; `SSO-SUMMONING-MAP-VISUALS-001` |
| Shield | Reaction timing plus defensive status/result clarity. | `SSO-AC-REACTION-WIREUP-001` |
| Identify or material/ritual-only flow | Proof that non-map spells remain understandable without creating map artifacts. | material/ritual rows |

## Known holes this matrix preserves

- The matrix is effect-category-first, not a complete spell-by-spell audit of every spell JSON.
- No rendered 2D or 3D inspection was run while creating this artifact.
- Cylinder height, cube placement policy, elevation, LoS/cover explanation, object targeting, summon form choice, summon command economy, and non-creature summon map visuals remain open.
- Future agents should add concrete spell rows as each spell category is audited instead of replacing this matrix with a narrower proof note.

## Initial spell-level proof ledger

This ledger starts the spell-by-spell expansion requested by `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`. Rows begin as `pending-rendered-proof` unless a future agent links captured 2D and 3D evidence.

| Spell or family | Current presentation classification | Expected 2D appearance | Expected 3D appearance | Current proof status | Rows that own remaining work |
| --- | --- | --- | --- | --- | --- |
| Enhance Ability | `status-marker` | Target actor shows the selected ability buff clearly enough to distinguish Bear/Bull/Cat/Eagle/Fox/Owl choices. | Target actor has an equivalent readable 3D status label or marker. | `pending-rendered-proof`; command/runtime slice exists but was not visually inspected. | `SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001`; `SSO-COMBAT-MAP-VISUALIZATION-001` |
| Grease | `persistent-zone` plus repeat interaction cues | Slippery area remains visible, communicates affected footprint, and supports enter/move/end-turn interaction feedback. | Equivalent persistent footprint or volume, with clear affected tiles/space. | `pending-rendered-proof`; area/data status is partially resolved but visual proof remains open. | `SSO-AREA-ENTRY-EXIT-001`; `SSO-AREA-MOVE-WITHIN-COVERAGE-001`; `SSO-COMBAT-MAP-VISUALIZATION-001` |
| Entangle | `persistent-zone` plus `status-marker` | Plant/terrain zone is visible and restrained actors remain marked. | Equivalent 3D zone and restrained actor marker. | `pending-rendered-proof`. | `SSO-AREA-ENTRY-EXIT-001`; status rows; terrain/visual rows |
| Fog Cloud | `persistent-zone` plus visibility/obscurement | Obscured area changes visibility/readability without pretending it is a damage trigger zone. | Equivalent 3D fog/obscurement presentation with visible boundary. | `pending-rendered-proof`; data audit says it is terrain/obscurement rather than save/damage migration. | `SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001`; terrain/visual rows |
| Darkness-style visibility spell | `persistent-zone` plus visibility policy | Dark/hidden tiles are visibly distinct and observer policy is clear. | Equivalent 3D darkness/visibility mask. | `pending-rendered-proof`; observer policy still open. | `SSO-VISIBILITY-OBSERVER-POLICY-001`; `SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001` |
| Thunderwave-style forced movement | `instant-feedback` plus possible path cue | Movement direction/path and landing result are legible after resolution. | Equivalent 3D displacement cue, including vertical/elevation policy if relevant. | `pending-rendered-proof`; shared movement cues exist but were not rendered. | `SSO-COMBAT-MAP-VISUALIZATION-001`; geometry/elevation rows |
| Misty Step-style teleport | `targeting-preview` plus `instant-feedback` | Legal destination preview before commit and landing cue after resolution. | Equivalent 3D destination/landing cue. | `pending-rendered-proof`; destination assignment/teleport cue work remains tied to visual proof. | teleport/destination rows; `SSO-COMBAT-MAP-VISUALIZATION-001` |
| Find Familiar | `token-or-object` plus lifecycle/status behavior | Familiar token appears, replacement/0-HP/dismissal behavior is visible, and special senses/touch-delivery state is understandable. | Equivalent 3D familiar actor or marker with cleanup. | `pending-rendered-proof`; replacement slice exists, broader lifecycle remains open. | `SSO-LEVEL1-FAMILIAR-RUNTIME-001`; summon visual/runtime rows |
| Find Steed | `token-or-object` plus command/initiative behavior | Mount token communicates ownership, control, initiative/turn behavior, and dismissal. | Equivalent 3D mount representation and ownership/control cue. | `pending-rendered-proof`; command economy runtime enforcement remains open. | `SSO-SUMMONING-FORM-SELECTION-001`; `SSO-SUMMONING-COMMAND-ECONOMY-001`; `SSO-SUMMONING-MAP-VISUALS-001` |
| Summon Beast | `token-or-object` plus form choice | Chosen beast form is recognizable and not silently defaulted. | Equivalent 3D representation or label for the chosen form. | `pending-rendered-proof`; form choice is schema/data-backed but runtime/UI defaults remain. | `SSO-SUMMONING-FORM-SELECTION-001`; `SSO-SUMMONING-MAP-VISUALS-001` |
| Summon Lesser/Greater Demon | `token-or-object` plus hostile/uncontrolled AI policy | Demon actor communicates hostile/uncontrolled status and target-selection behavior. | Equivalent 3D hostile/uncontrolled ownership/readability cue. | `pending-rendered-proof`; hostile/uncontrolled behavior mostly lives in prose, not runtime. | `SSO-SUMMONING-COMMAND-ECONOMY-001`; `SSO-SUMMONING-MAP-VISUALS-001` |
| Shield | `targeting-preview` or interrupt prompt plus temporary defensive marker | Reaction offer and resulting defensive state are visible at the attack-hit timing point. | Equivalent 3D prompt/marker if map context is active. | `pending-runtime-and-rendered-proof`; generic reaction prompt exists but Shield wiring remains open. | `SSO-AC-REACTION-WIREUP-001` |
| Identify or ritual/material-only flow | `no-map` unless the resolved effect creates an artifact | No tactical artifact should appear; UI/log explains completion, cost, or ritual flow. | Same no-map contract in 3D mode. | `pending-runtime-proof`; ritual/material runtime rows remain open. | `SSO-LEVEL1-RITUAL-RUNTIME-001`; material-cost rows |

Future agents should add rows here when they investigate a new spell family. Do not remove category rows just because a specific spell is resolved; category rows preserve the visual contract for later spell audits.

### 2026-06-01 update - familiar touch-delivery targeting

- Touch-range spells can now be considered targetable through an on-map familiar when the familiar is within telepathy range of the caster and adjacent to the target.
- This should eventually become visible in both 2D and 3D as a delivery-origin/path cue, not just a broader target highlight.
- Proof remains pending: the targeting hook was not tested, the familiar reaction is not consumed, and no rendered 2D/3D delivery review has been run.

### 2026-06-01 update - familiar touch-delivery reaction spend

- Delivered touch spells now spend the familiar's reaction when the delivery path is used, and delivery is not target-valid if that reaction is unavailable.
- The map still does not explicitly show the delivery origin or reaction spend in either 2D or 3D; rendered feedback remains a separate visual proof gap.

### 2026-06-01 update - familiar touch-delivery 2D/3D cue

- Familiar-delivered touch spells now emit a short-lived delivery visual.
- 2D renders a cyan dotted line and `FAMILIAR TOUCH` label from familiar to target.
- 3D renders the same delivery cue through `VFXSystem`.
- Proof remains pending: no rendered inspection or focused test was run, so the cue is implemented but not verified legible.

### 2026-06-01 update - summon 0-HP cleanup

- `Find Familiar` and generic command-created summons now have an implemented-but-unverified 0-HP disappearance path in `DamageCommand`.
- The visual proof remains pending: future rendered checks still need to show the 2D token and 3D actor/marker disappear when the summon reaches 0 HP.

### 2026-06-01 update - summon identity metadata

- Command-created summons now preserve `entityType`, `formName`, and `sourceName` in `summonMetadata`.
- This supports future 2D/3D map labels and lifecycle rules, but does not itself prove rendered summon readability or solve form selection.

### 2026-06-01 update - useSummons identity parity

- The `useSummons` hook path now preserves `entityType`, `formName`, and `sourceName` like command-created summons.
- This reduces metadata drift for future 2D/3D summon labels, but does not prove that `useSummons` is the authoritative runtime or that summon visuals are rendered correctly.

### 2026-06-01 update - useSummons runtime boundary

- `useSummons` is now explicitly documented as a parallel UI/helper path rather than the authoritative production summon runtime.
- Future 2D/3D summon visual proof should use the command-created summon path unless a later ownership decision wires `useSummons` into production casting.

### 2026-06-01 update - summon 0-HP identity log

- Summon 0-HP cleanup now records `entityType`, `formName`, and `sourceName` in log data when the command path removes the summon.
- Rendered 2D/3D proof is still pending; this only improves the state/log evidence available to future visual surfaces.

### 2026-06-01 update - familiar pocket-state runtime foothold

- Familiar dismissal/reappearance now has a runtime state model through `CombatState.pocketedSummons` and `FamiliarPocketCommands.ts`.
- Visual proof remains pending: future 2D/3D checks must show the familiar leaving the map into pocket state and returning without being treated as destroyed.

### 2026-06-01 update - familiar pocket action factory foothold

- Familiar dismissal/recall can now be represented as `familiar_pocket` ability effects that create pocket commands through `AbilityCommandFactory`.
- Visual proof remains pending until concrete player-facing actions exist and rendered 2D/3D disappearance/reappearance is inspected.

### 2026-06-01 update - familiar pocket state propagation

- Familiar pocket commands can now publish roster and `pocketedSummons` changes through `useAbilitySystem` into `CombatView` state.
- Visual proof remains pending until concrete player-facing actions exist and rendered 2D/3D disappearance/reappearance is inspected.

### 2026-06-01 update - familiar pocket caster actions

- Find Familiar now grants caster-side `Dismiss Familiar` and `Recall Familiar` utility abilities that route toward the familiar pocket command path.
- Visual proof remains pending until those actions are exercised in rendered 2D/3D combat and disappearance/reappearance is inspected.

### 2026-06-01 update - familiar shared senses and touch delivery split

- Familiar dismiss/recall now has a likely UI path through injected caster abilities and the existing ability palette.
- Shared senses and touch spell delivery remain separate active combat-path gaps and need their own map/visibility proof.

### 2026-06-01 update - familiar shared-senses action foothold

- Find Familiar now preserves shared-senses metadata and grants a `Use Familiar Senses` ability.
- Visual proof remains pending until activation changes observer/visibility behavior and is inspected in 2D/3D.

### 2026-06-01 update - familiar shared-senses execution foothold

- `Use Familiar Senses` can now create a one-round caster active effect that names the familiar as the observer and carries the familiar telepathy range.
- This is only runtime evidence. The 2D and 3D combat maps still need a visual/observer integration slice that consumes the active effect, shows the player whose senses are being used, and captures rendered proof.

### 2026-06-01 update - familiar shared-senses observer integration

- The shared visibility observer policy now delegates the 2D and 3D map observer to the familiar while the caster has the shared-senses active effect.
- Both renderers display a "Viewing through <familiar>" label so the map behavior is not invisible state.
- Proof remains pending: this has not been visually inspected in either renderer, and no focused policy test has been run.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/COMBAT_MAP_PRESENTATION_MATRIX.md","sha256WithoutMarker":"e343d12c8ecdad0bb43bd6db774744564b929f8921c6357053b1009acf54ef3e","markedAtUtc":"2026-06-25T22:29:38.333Z"} -->
