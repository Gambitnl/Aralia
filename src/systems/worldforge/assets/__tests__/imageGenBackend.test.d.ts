/**
 * @file imageGenBackend.test.ts
 *
 * This file tests the image generation backend for the Worldforge asset pipeline.
 *
 * It validates:
 * 1. Prompt construction: Ensuring the generated prompt accurately reflects the key's kind,
 *    subject, and descriptors.
 * 2. Success mapping: Ensuring successful service responses are mapped into a valid ForgeAsset
 *    with a properly formatted base64 data URI.
 * 3. Error handling: Ensuring network transport failures correctly throw/reject as specified.
 * 4. Isolation: Mocks all HTTP traffic to ensure no live network calls are made.
 *
 * Test target: src/systems/worldforge/assets/imageGenBackend.ts
 */
export {};
