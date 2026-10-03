/**
 * This worker runs canonical atlas generation and pure SVG model construction
 * outside the browser interaction thread.
 *
 * It calls the same getBridgeAtlas and buildAtlasSvgModel functions used before
 * GG-41. No geography, politics, exact-cell data, labels, settlements, or user
 * preferences are reimplemented here. The main thread receives their existing
 * outputs through the shared protocol.
 */
/// <reference lib="webworker" />

import { prepareResponsiveAtlasNow } from './responsiveAtlasCore';
import type {
  ResponsiveAtlasRequest,
  ResponsiveAtlasResponse,
} from './responsiveAtlasProtocol';

// ============================================================================
// Worker message boundary
// ============================================================================
// One request produces one deterministic response. MapPane creates a bounded
// worker per uncached input and terminates it after this reply.
// ============================================================================

function collectTransferableBuffers(value: unknown): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const visited = new WeakSet<object>();

  // Walk the generated graph once. Typed-array buffers move to the main thread
  // without copying; ordinary objects and SVG strings keep structured-clone
  // semantics. The worker terminates after replying, so detaching them here is
  // safe and removes the largest avoidable delivery cost.
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    if (candidate instanceof ArrayBuffer) {
      buffers.add(candidate);
      return;
    }
    if (ArrayBuffer.isView(candidate)) {
      buffers.add(candidate.buffer as ArrayBuffer);
      return;
    }
    if (visited.has(candidate)) return;
    visited.add(candidate);
    for (const child of Object.values(candidate)) visit(child);
  };

  visit(value);
  return [...buffers];
}

self.onmessage = (event: MessageEvent<ResponsiveAtlasRequest>) => {
  try {
    const prepared = prepareResponsiveAtlasNow(event.data);
    const atlasResponse: ResponsiveAtlasResponse = {
      type: 'atlas',
      atlas: prepared.atlas,
      transferProperties: prepared.transferProperties,
    };
    self.postMessage(atlasResponse, collectTransferableBuffers(atlasResponse));

    // The large atlas object and large SVG-string model arrive as separate
    // browser tasks. Yield once between them so delivery cannot recreate the
    // monolithic structured-clone stall that GG-41 removes.
    setTimeout(() => {
      const modelResponse: ResponsiveAtlasResponse = {
        type: 'model',
        model: prepared.model,
      };
      self.postMessage(modelResponse);
    }, 0);
  } catch (error) {
    const response: ResponsiveAtlasResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
