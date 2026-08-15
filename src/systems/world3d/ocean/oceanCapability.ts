/**
 * @file oceanCapability.ts — the WebGPU gate, and the reason it throws.
 *
 * ARALIA HAS A NO-FALLBACK RULE. One real path, honest failure.
 *
 * That rule matters more here than almost anywhere else in the project. A
 * sine-wave stand-in looks like an ocean. It moves, it catches light, it
 * passes a glance. It is also wrong in every way that matters: the wrong
 * crest statistics, the wrong dispersion, no fetch, no swell, and a period
 * you can see. A ship whose heave came from that stand-in would be
 * reproducibly wrong, and nobody would notice until the numbers were used for
 * something.
 *
 * So: no stand-in. If WebGPU is not there, this module throws, loudly, with a
 * message that says what is missing and what to do about it.
 */

/** What the ocean needs from the platform, and whether it is there. */
export interface OceanCapability {
  readonly ok: boolean;
  readonly reason: string;
}

/**
 * Check for WebGPU. Returns a verdict; it does not throw.
 *
 * Use this when a caller wants to show a message. Use `assertOceanCapable`
 * when a caller is about to build the pipeline.
 */
export async function checkOceanCapability(): Promise<OceanCapability> {
  const nav = globalThis.navigator as Navigator & { gpu?: unknown };
  if (!nav || typeof nav !== 'object') {
    return { ok: false, reason: 'No navigator: this is not a browser context.' };
  }
  if (!nav.gpu) {
    return {
      ok: false,
      reason:
        'navigator.gpu is missing. The open-ocean surface is a WebGPU compute '
        + 'pipeline and has no WebGL path. Enable WebGPU, or use a browser that '
        + 'ships it.',
    };
  }
  try {
    const gpu = nav.gpu as { requestAdapter(): Promise<unknown> };
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        ok: false,
        reason:
          'navigator.gpu exists but requestAdapter() returned null. The GPU is '
          + 'blocklisted or no adapter is available.',
      };
    }
  } catch (e) {
    return { ok: false, reason: `requestAdapter() threw: ${String(e)}` };
  }
  return { ok: true, reason: 'WebGPU adapter available.' };
}

/**
 * Throw unless the platform can run the ocean.
 *
 * This is the no-fallback rule, spelled out in code. There is deliberately no
 * `if (!ok) useSineWaves()` branch anywhere in this module, and adding one
 * would be a regression, not a feature.
 */
export async function assertOceanCapable(): Promise<void> {
  const c = await checkOceanCapability();
  if (!c.ok) {
    throw new Error(
      `[ocean] Cannot build the open-ocean surface. ${c.reason} `
      + 'Aralia does not substitute a fake ocean: a plausible-looking stand-in '
      + 'would hide the failure and would give wrong ship motion.',
    );
  }
}
