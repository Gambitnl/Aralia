/** Re-export shim (GG-587, rule C11). The module moved to src/systems/world3d/groundBuildingMotion.ts
 * so systems/ code can use it. Existing component imports and test mocks of
 * this path keep working. */
export * from '../../systems/world3d/groundBuildingMotion';
