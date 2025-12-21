# Planeshifter's Journal

## 2024-05-23 - Initial Planar Survey

**Learning:** The planar system currently consists of isolated mechanic classes (`FeywildMechanics`, `ShadowfellMechanics`, `InfernalMechanics`) and a `PortalSystem`. There is no centralized `Plane` interface or registry to define plane-specific properties like time flow, magic alterations, or emotional valence in a data-driven way.

**Action:** I need to formalize the `Plane` interface and create a registry of planes to support the "make planes distinct" directive. This will allow the `PortalSystem` and other systems to query plane properties dynamically rather than hardcoding checks.
