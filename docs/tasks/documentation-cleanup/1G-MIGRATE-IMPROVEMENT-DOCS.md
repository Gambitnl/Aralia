# Path 1.G: Improvement Docs Migration Campaign

## MISSION
Migrate valuable architectural knowledge from `docs/improvements/@*.md` into component-specific `README.md` files and retire the original improvement documents.

## RATIONALE
"Improvement Plans" are valuable historical records, but the architectural decisions they contain (the "Why" and "How") belong closer to the code. By moving this information to component READMEs, we ensure that developers working on the component have immediate access to its design history and performance considerations.

## CAMPAIGN STATUS

| ID | Task File | Source File | Status |
|----|-----------|-------------|--------|
| **1G.1** | [1G.1-COMMON-COMPONENTS.md](./1G.1-COMMON-COMPONENTS.md) | `@01_consolidate_repetitive_components.md` | Pending |
| **1G.2** | [1G.2-CONFIG-DECOUPLING.md](./1G.2-CONFIG-DECOUPLING.md) | `@02_decouple_configuration.md` | Pending |
| **1G.3** | [1G.3-PLAYER-TYPES.md](./1G.3-PLAYER-TYPES.md) | `@03_refactor_player_character_type.md` | Pending |
| **1G.4** | [1G.4-EXTERNALIZE-CSS.md](./1G.4-EXTERNALIZE-CSS.md) | `@04_externalize_css.md` | Pending |
| **1G.5** | [1G.5-API-ERROR-HANDLING.md](./1G.5-API-ERROR-HANDLING.md) | `@05_standardize_api_error_handling.md` | Pending |
| **1G.6** | [1G.6-SUBMAP-RENDERING.md](./1G.6-SUBMAP-RENDERING.md) | `@06_optimize_submap_rendering.md` | Pending |
| **1G.7** | [1G.7-REDUCER-LOGIC.md](./1G.7-REDUCER-LOGIC.md) | `@07_invert_reducer_action_logic.md` | Pending |
| **1G.8** | [1G.8-POINT-BUY-UI.md](./1G.8-POINT-BUY-UI.md) | `@08_improve_point_buy_ui.md` | Pending |
| **1G.9** | [1G.9-LOADING-TRANSITION.md](./1G.9-LOADING-TRANSITION.md) | `@10_enhance_loading_transition.md` | Pending |
| **1G.10** | [1G.10-SUBMAP-GENERATION.md](./1G.10-SUBMAP-GENERATION.md) | `11_submap_generation_deep_dive/` | Pending |

## STANDARD MIGRATION WORKFLOW

Every sub-task file (`1G.X-TASK-NAME.md`) follows this strict workflow. The final step is a mandatory **Completion Checkbox** that must be marked.

1.  **Extract**: Read the source improvement doc and identify the "Why" (Context) and "How" (Architecture).
2.  **Synthesize**: Write a new `Architecture & Design History` section in the target component's `README.md`.
3.  **Verify**: Ensure the new documentation accurately reflects the code's current state.
4.  **Archive**: Move the source file to `docs/archive/improvements/` and remove the `@` prefix.
5.  **Mark Complete**:
    *   [ ] **CHECKBOX**: Navigate to the sub-task file (e.g., `1G.6-SUBMAP-RENDERING.md`) and mark the "Archival" checkbox as `[x]`.
    *   [ ] **CAMPAIGN**: Update the status table in this file (`1G-MIGRATE-IMPROVEMENT-DOCS.md`) to `Completed`.

## DELIVERABLE
A completely migrated set of architectural docs, with a clean `docs/improvements/` folder (empty except for active work) and a populated `docs/archive/improvements/`.
