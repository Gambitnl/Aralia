import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';

import {
  assertLoopbackHost,
  decodeAndVerifyPngBuffer,
  DEFAULT_DATA_URL_CHUNK_CHARS,
  encodeRgbaToPngBuffer,
  ensureLoopbackProofReceiver,
  probeLoopbackProofReceiverOptions,
  reassembleDataUrlChunks,
  splitDataUrlIntoChunks,
} from './nativeProofPreflight.mjs';

test('WF-G355: enforces loopback-only boundary and rejects public or wildcard hosts', async () => {
  assert.equal(assertLoopbackHost('127.0.0.1'), '127.0.0.1');
  assert.equal(assertLoopbackHost('localhost'), 'localhost');
  assert.throws(() => assertLoopbackHost('0.0.0.0'), /Refusing non-loopback proof receiver host/);
  assert.throws(() => assertLoopbackHost('192.168.1.10'), /Refusing non-loopback proof receiver host/);
});

test('WF-G355: detects unreachable/stalled sandbox listener on OPTIONS preflight, preserves failed receipt, and falls back to owned 127.0.0.1 receiver returning 204 + exact localhost:3000 origin', async () => {
  // Simulate a sandbox-started TCP listener that accepts the socket but never
  // responds to HTTP OPTIONS (reproducing the port 61325 ETIMEDOUT failure).
  const silentSockets = new Set();
  const stalledServer = net.createServer((socket) => {
    silentSockets.add(socket);
    socket.on('close', () => silentSockets.delete(socket));
  });
  await new Promise((resolve) => stalledServer.listen(0, '127.0.0.1', resolve));
  const stalledPort = stalledServer.address().port;
  const stalledUrl = `http://127.0.0.1:${stalledPort}/proof`;

  try {
    const result = await ensureLoopbackProofReceiver({
      candidateUrl: stalledUrl,
      expectedOrigin: 'http://localhost:3000',
      timeoutMs: 120,
    });

    try {
      assert.equal(result.owned, true);
      assert.equal(result.failedReceipts.length, 1);
      assert.equal(result.failedReceipts[0].ok, false);
      assert.match(result.failedReceipts[0].cause, /ETIMEDOUT/);

      assert.equal(result.preflight.ok, true);
      assert.equal(result.preflight.status, 204);
      assert.equal(result.preflight.allowOrigin, 'http://localhost:3000');

      // Verify a wrong origin is rejected by the owned receiver's OPTIONS guard.
      const wrongOriginProbe = await probeLoopbackProofReceiverOptions({
        url: result.url,
        expectedOrigin: 'http://evil.example.com',
        timeoutMs: 500,
      });
      assert.equal(wrongOriginProbe.ok, false);
      assert.equal(wrongOriginProbe.status, 403);
    } finally {
      await result.close();
    }
  } finally {
    for (const sock of silentSockets) sock.destroy();
    await new Promise((resolve) => stalledServer.close(() => resolve()));
  }
});

test('WF-G356: chunked 60,000-character data-URL export preserves >225,000-character PNG and matches exact RGBA SHA-256 while rejecting 149,990-byte truncated export', () => {
  // Synthesize a 210x210 RGBA image whose uncompressed PNG base64 data URL
  // exceeds 225,800 characters (matching the V183/V184 225,802-char scale).
  const width = 210;
  const height = 210;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (i * 17) & 0xff;
    rgba[i + 1] = (i * 31) & 0xff;
    rgba[i + 2] = (i * 47) & 0xff;
    rgba[i + 3] = 255;
  }
  const expectedRgbaSha256 = crypto.createHash('sha256').update(rgba).digest('hex');

  const pngBuffer = encodeRgbaToPngBuffer(width, height, rgba);
  const fullDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  assert.ok(
    fullDataUrl.length > 225802,
    `Expected dataUrl length > 225802, got ${fullDataUrl.length}`,
  );

  // 1. Reproduce the WF-G356 direct DOM attribute truncation (~149,990 bytes):
  // the truncated file still starts with the 8-byte PNG signature and IHDR,
  // but decodeAndVerifyPngBuffer rejects it immediately.
  const truncatedBuffer = pngBuffer.subarray(0, 149990);
  assert.deepEqual(truncatedBuffer.subarray(0, 8), pngBuffer.subarray(0, 8));
  assert.throws(
    () => decodeAndVerifyPngBuffer(truncatedBuffer, {
      expectedWidth: width,
      expectedHeight: height,
      expectedRgbaSha256,
    }),
    /Truncated PNG chunk|Missing or trailing bytes after PNG IEND/,
  );

  // 2. Split into bounded 60,000-character chunks, reassemble, and verify
  // independent PNG decode + exact RGBA SHA-256 parity.
  const chunks = splitDataUrlIntoChunks(fullDataUrl, DEFAULT_DATA_URL_CHUNK_CHARS);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every((chunk) => chunk.length <= DEFAULT_DATA_URL_CHUNK_CHARS));

  const reassembled = reassembleDataUrlChunks(chunks);
  assert.equal(reassembled.totalChars, fullDataUrl.length);

  const verified = decodeAndVerifyPngBuffer(reassembled.buffer, {
    expectedWidth: width,
    expectedHeight: height,
    expectedRgbaSha256,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.width, width);
  assert.equal(verified.height, height);
  assert.equal(verified.rgbaSha256, expectedRgbaSha256);
});
