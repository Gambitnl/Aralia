/**
 * @file utils/stringUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/stringUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Only `capitalize` is ported (Names.getState needs it). The rest of the
 * upstream module (round/splitInTwo/parseTransform/sanitizeId/JSON helpers)
 * is SVG/UI plumbing — stripped, see the ATTRIBUTION strip inventory.
 */

/**
 * Capitalize the first letter of a string
 * @param {string} inputString - The input string
 * @returns {string} - The capitalized string
 */
export const capitalize = (inputString: string) => {
  return inputString.charAt(0).toUpperCase() + inputString.slice(1);
};
