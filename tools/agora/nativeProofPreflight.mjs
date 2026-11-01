/**
 * @file tools/agora/nativeProofPreflight.mjs
 * Shared verification safeguards for local native proof receivers (WF-G355)
 * and chunked browser component PNG exports (WF-G356).
 *
 * What this file does:
 * 1. Enforces a mandatory loopback-only host-origin HTTP `OPTIONS` preflight
 *    (`probeLoopbackProofReceiverOptions` and `ensureLoopbackProofReceiver`)
 *    that requires HTTP `204` and an exact `Access-Control-Allow-Origin`
 *    match before any expensive native preview scene construction runs. When a
 *    sandbox-started listener is unreachable or times out (`ETIMEDOUT`), the
 *    failed preflight receipt is preserved and an owned `127.0.0.1` fallback
 *    receiver is started and preflight-verified (WF-G355).
 * 2. Splits large `data:image/png;base64,...` strings into bounded 60,000-char
 *    chunks (`splitDataUrlIntoChunks`, `reassembleDataUrlChunks`) and
 *    independently decodes the resulting PNG (`decodeAndVerifyPngBuffer`) —
 *    checking chunk CRCs, `IHDR`, `IDAT` zlib stream inflation, PNG scanline
 *    unfiltering, `IEND` termination, and raw RGBA SHA-256 hash — so a
 *    truncated DOM attribute export with a valid 8-byte PNG header can never
 *    pass visual verification (WF-G356).
 */

import crypto from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';

// ============================================================================
// SECTION 1: Loopback Boundary & Native Proof Receiver Preflight (WF-G355)
// ============================================================================

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Enforce the no-public-listener boundary: native proof receivers and probes
 * must bind and connect exclusively to loopback addresses.
 */
export function assertLoopbackHost(host) {
  const normalized = String(host ?? '').trim().toLowerCase();
  if (!LOOPBACK_HOSTS.has(normalized)) {
    throw new Error(
      `Refusing non-loopback proof receiver host "${host}"; only 127.0.0.1, localhost, or ::1 are permitted (WF-G355).`,
    );
  }
  return normalized;
}

/**
 * Perform an HTTP `OPTIONS` preflight against a loopback proof receiver URL.
 * Requires HTTP 204 and an exact `Access-Control-Allow-Origin` header matching
 * `expectedOrigin` (default `http://localhost:3000`).
 */
export async function probeLoopbackProofReceiverOptions({
  url,
  expectedOrigin = 'http://localhost:3000',
  timeoutMs = 2000,
} = {}) {
  const parsed = new URL(url);
  assertLoopbackHost(parsed.hostname);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'OPTIONS',
        headers: {
          Origin: expectedOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
      (res) => {
        res.resume();
        const allowOrigin = res.headers['access-control-allow-origin'] ?? null;
        const status = res.statusCode ?? 0;
        const ok = status === 204 && allowOrigin === expectedOrigin;
        resolve({
          ok,
          url: parsed.toString(),
          status,
          allowOrigin,
          expectedOrigin,
          cause: ok
            ? null
            : `Expected HTTP 204 with Access-Control-Allow-Origin "${expectedOrigin}", got status ${status} and origin "${allowOrigin ?? 'missing'}"`,
          durationMs: Date.now() - startedAt,
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      const timeoutError = Object.assign(new Error(`OPTIONS preflight timed out after ${timeoutMs}ms`), {
        code: 'ETIMEDOUT',
      });
      req.destroy(timeoutError);
    });

    req.on('error', (error) => {
      resolve({
        ok: false,
        url: parsed.toString(),
        status: null,
        allowOrigin: null,
        expectedOrigin,
        cause: error?.code ? `${error.code}: ${error.message}` : String(error?.message || error),
        durationMs: Date.now() - startedAt,
      });
    });

    req.end();
  });
}

/**
 * Start a loopback-only (`127.0.0.1`) proof receiver that answers `OPTIONS`
 * with `204` + exact `expectedOrigin` CORS headers and collects `POST` proof
 * payloads, or reuse `candidateUrl` when its host-side `OPTIONS` preflight
 * succeeds (WF-G355).
 *
 * Any failed candidate probe is preserved in `failedReceipts` for auditability.
 */
export async function ensureLoopbackProofReceiver({
  candidateUrl = null,
  expectedOrigin = 'http://localhost:3000',
  timeoutMs = 2000,
  host = '127.0.0.1',
  onPayload = null,
} = {}) {
  assertLoopbackHost(host);
  const failedReceipts = [];

  if (candidateUrl) {
    const candidateReceipt = await probeLoopbackProofReceiverOptions({
      url: candidateUrl,
      expectedOrigin,
      timeoutMs,
    });
    if (candidateReceipt.ok) {
      return {
        url: candidateReceipt.url,
        port: Number(new URL(candidateReceipt.url).port),
        owned: false,
        preflight: candidateReceipt,
        failedReceipts,
        receivedPayloads: [],
        close: async () => {},
      };
    }
    failedReceipts.push(candidateReceipt);
  }

  const receivedPayloads = [];
  const server = http.createServer((req, res) => {
    const reqOrigin = req.headers.origin;
    if (reqOrigin === expectedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', expectedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');

    if (req.method === 'OPTIONS') {
      if (reqOrigin !== expectedOrigin) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden origin');
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let parsedBody = rawBuffer;
        try {
          parsedBody = JSON.parse(rawBuffer.toString('utf8'));
        } catch {
          // Keep raw buffer when payload is binary.
        }
        receivedPayloads.push(parsedBody);
        if (typeof onPayload === 'function') {
          onPayload(parsedBody);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, count: receivedPayloads.length }));
      });
      return;
    }

    res.writeHead(405);
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const fallbackUrl = `http://${host}:${port}/proof`;
  const preflight = await probeLoopbackProofReceiverOptions({
    url: fallbackUrl,
    expectedOrigin,
    timeoutMs,
  });

  if (!preflight.ok) {
    await new Promise((resolve) => server.close(() => resolve()));
    throw new Error(`Owned loopback proof receiver failed OPTIONS preflight: ${preflight.cause}`);
  }

  return {
    url: fallbackUrl,
    port,
    owned: true,
    preflight,
    failedReceipts,
    receivedPayloads,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// ============================================================================
// SECTION 2: Chunked PNG Data-URL Export & Independent Decode Check (WF-G356)
// ============================================================================

export const DEFAULT_DATA_URL_CHUNK_CHARS = 60000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL_PNG_PREFIX = 'data:image/png;base64,';

/**
 * Split a `data:image/png;base64,...` string into bounded chunks (default
 * 60,000 characters) so browser DOM attributes never truncate large captures
 * at ~150 KB (WF-G356).
 */
export function splitDataUrlIntoChunks(
  dataUrl,
  maxChunkChars = DEFAULT_DATA_URL_CHUNK_CHARS,
) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(DATA_URL_PNG_PREFIX)) {
    throw new Error('Expected a data:image/png;base64,... string');
  }
  if (!Number.isInteger(maxChunkChars) || maxChunkChars < 64) {
    throw new RangeError('maxChunkChars must be an integer >= 64');
  }
  const chunks = [];
  for (let offset = 0; offset < dataUrl.length; offset += maxChunkChars) {
    chunks.push(dataUrl.slice(offset, offset + maxChunkChars));
  }
  return chunks;
}

/**
 * Reassemble bounded data-URL chunks back into both the complete data URL and
 * its decoded PNG `Buffer`.
 */
export function reassembleDataUrlChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('chunks must be a non-empty array of strings');
  }
  const dataUrl = chunks.join('');
  if (!dataUrl.startsWith(DATA_URL_PNG_PREFIX)) {
    throw new Error('Reassembled data URL is missing data:image/png;base64, prefix');
  }
  const base64Body = dataUrl.slice(DATA_URL_PNG_PREFIX.length);
  return {
    dataUrl,
    totalChars: dataUrl.length,
    chunkCount: chunks.length,
    buffer: Buffer.from(base64Body, 'base64'),
  };
}

// Precompute IEEE 802.3 CRC-32 table for PNG chunk integrity verification.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(typeBytes, dataBytes) {
  let c = 0xffffffff;
  for (let i = 0; i < typeBytes.length; i++) {
    c = CRC32_TABLE[(c ^ typeBytes[i]) & 0xff] ^ (c >>> 8);
  }
  for (let i = 0; i < dataBytes.length; i++) {
    c = CRC32_TABLE[(c ^ dataBytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Unfilter inflated PNG scanlines for 8-bit RGBA (colorType 6) or RGB (colorType 2)
 * into a canonical 4-bytes-per-pixel RGBA buffer so its SHA-256 can be compared
 * directly against the browser's `getImageData()` RGBA hash.
 */
function unfilterScanlinesToRgba(inflated, width, height, colorType) {
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bytesPerPixel === 0) {
    throw new Error(`Unsupported PNG colorType ${colorType}; expected 6 (RGBA) or 2 (RGB)`);
  }
  const stride = width * bytesPerPixel;
  const expectedLength = height * (1 + stride);
  if (inflated.length !== expectedLength) {
    throw new Error(`Inflated IDAT length ${inflated.length} does not match expected ${expectedLength}`);
  }

  const rawScanlines = Buffer.alloc(height * stride);
  const rgba = Buffer.alloc(width * height * 4);

  for (let row = 0; row < height; row++) {
    const filterType = inflated[row * (1 + stride)];
    const srcOffset = row * (1 + stride) + 1;
    const dstOffset = row * stride;
    const prevOffset = (row - 1) * stride;

    for (let i = 0; i < stride; i++) {
      const rawByte = inflated[srcOffset + i];
      const left = i >= bytesPerPixel ? rawScanlines[dstOffset + i - bytesPerPixel] : 0;
      const up = row > 0 ? rawScanlines[prevOffset + i] : 0;
      const upLeft = (row > 0 && i >= bytesPerPixel) ? rawScanlines[prevOffset + i - bytesPerPixel] : 0;

      let recon;
      switch (filterType) {
        case 0:
          recon = rawByte;
          break;
        case 1:
          recon = (rawByte + left) & 0xff;
          break;
        case 2:
          recon = (rawByte + up) & 0xff;
          break;
        case 3:
          recon = (rawByte + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          recon = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Invalid PNG scanline filter type ${filterType} at row ${row}`);
      }
      rawScanlines[dstOffset + i] = recon;
    }

    for (let col = 0; col < width; col++) {
      const pxSrc = dstOffset + col * bytesPerPixel;
      const pxDst = (row * width + col) * 4;
      rgba[pxDst] = rawScanlines[pxSrc];
      rgba[pxDst + 1] = rawScanlines[pxSrc + 1];
      rgba[pxDst + 2] = rawScanlines[pxSrc + 2];
      rgba[pxDst + 3] = bytesPerPixel === 4 ? rawScanlines[pxSrc + 3] : 255;
    }
  }

  return rgba;
}

/**
 * Independently decode a PNG buffer, validating every chunk's length and CRC32,
 * requiring `IHDR`, inflating `IDAT`, reconstructing RGBA pixels, requiring an
 * exact `IEND` trailer, and optionally asserting `expectedWidth`,
 * `expectedHeight`, and `expectedRgbaSha256` (WF-G356).
 */
export function decodeAndVerifyPngBuffer(
  buffer,
  {
    expectedWidth = null,
    expectedHeight = null,
    expectedRgbaSha256 = null,
  } = {},
) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33) {
    throw new Error('Buffer is too short to be a valid PNG');
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let ihdr = null;
  let sawIend = false;
  const idatParts = [];

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      throw new Error(`Truncated PNG chunk header at byte offset ${offset}`);
    }
    const length = buffer.readUInt32BE(offset);
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;

    if (crcEnd > buffer.length) {
      throw new Error(`Truncated PNG chunk "${type}" at byte offset ${offset}: need ${crcEnd} bytes, buffer has ${buffer.length}`);
    }

    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(typeBytes, data);
    if (actualCrc !== expectedCrc) {
      throw new Error(`PNG chunk "${type}" CRC mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`);
    }

    if (type === 'IHDR') {
      if (ihdr !== null || length !== 13) {
        throw new Error('Invalid or duplicate IHDR chunk');
      }
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      sawIend = true;
      offset = crcEnd;
      break;
    }

    offset = crcEnd;
  }

  if (!ihdr) {
    throw new Error('Missing PNG IHDR chunk');
  }
  if (!sawIend || offset !== buffer.length) {
    throw new Error('Missing or trailing bytes after PNG IEND chunk (truncated PNG export)');
  }
  if (idatParts.length === 0) {
    throw new Error('PNG contains no IDAT image data chunks');
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rgba = unfilterScanlinesToRgba(inflated, ihdr.width, ihdr.height, ihdr.colorType);
  const rgbaSha256 = crypto.createHash('sha256').update(rgba).digest('hex');

  if (expectedWidth !== null && ihdr.width !== expectedWidth) {
    throw new Error(`PNG width ${ihdr.width} does not match expected ${expectedWidth}`);
  }
  if (expectedHeight !== null && ihdr.height !== expectedHeight) {
    throw new Error(`PNG height ${ihdr.height} does not match expected ${expectedHeight}`);
  }
  if (expectedRgbaSha256 !== null && rgbaSha256 !== expectedRgbaSha256) {
    throw new Error(`PNG RGBA SHA-256 ${rgbaSha256} does not match expected ${expectedRgbaSha256}`);
  }

  return {
    ok: true,
    width: ihdr.width,
    height: ihdr.height,
    byteLength: buffer.length,
    rgbaSha256,
  };
}

/**
 * Encode a deterministic 8-bit RGBA buffer into a valid PNG `Buffer` (used by
 * self-tests and verification fixtures to synthesize >225,000-character data URLs).
 */
export function encodeRgbaToPngBuffer(width, height, rgba) {
  if (!Buffer.isBuffer(rgba) || rgba.length !== width * height * 4) {
    throw new Error(`Expected RGBA buffer of length ${width * height * 4}`);
  }
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let row = 0; row < height; row++) {
    raw[row * (1 + stride)] = 0; // filter type 0 (None)
    rgba.copy(raw, row * (1 + stride) + 1, row * stride, (row + 1) * stride);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth 8
  ihdrData[9] = 6; // color type 6 (RGBA)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const idatData = zlib.deflateSync(raw, { level: 0 });
  const makeChunk = (typeAscii, data) => {
    const typeBuf = Buffer.from(typeAscii, 'ascii');
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    typeBuf.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(typeBuf, data), 8 + data.length);
    return out;
  };

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}
