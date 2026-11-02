/** Re-export shim (GG-587, rule C11). The module moved to src/systems/world3d/groundSurfaceYM.ts
 * so systems/ code can use it. Existing component imports keep working. A test
 * that stubs terrain height must mock the new path, which the solver imports. */
export * from '../../../systems/world3d/groundSurfaceYM';
