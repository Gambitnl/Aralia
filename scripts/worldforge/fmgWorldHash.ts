/**
 * Byte-identity check for FMG world generation (GG-556).
 *
 * The FMG port is a frozen persistence contract: a seed must always give the
 * same world. A speed change to the generator must not change one value. This
 * script generates the full world (`generateFmgWorld`, the game's default
 * options) for a fixed seed list and hashes EVERYTHING in the result: every
 * object key in insertion order, every number exactly (including -0 and NaN),
 * every typed array by type and bytes, Maps, Sets, shared references and
 * cycles. Only function bodies are skipped; a function contributes its name.
 *
 * It also prints the generation time per seed, so a speed change can report
 * before and after numbers from the same run.
 *
 * Usage:
 *   npx tsx scripts/worldforge/fmgWorldHash.ts --write   record the baseline
 *   npx tsx scripts/worldforge/fmgWorldHash.ts           check against it (exit 1 on a mismatch)
 *
 * The baseline lives beside this file in fmgWorldHashes.json. Rewrite it only
 * with an owner-approved world-break decision (see fmgWorld.test.ts header).
 */

import { createHash, type Hash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateFmgWorld } from "../../src/systems/worldforge/fmg/generateWorld";
import { DEFAULT_WORLD_GEN_OPTIONS } from "../../src/systems/worldforge/adapter/worldGenOptions";

const SEEDS = ["903674813", "42", "1", "aralia-fmg-golden-1", "world-42"];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, "fmgWorldHashes.json");

// The same option mapping as createWorld.ts toFmgWorldOptions: null fields go
// to FMG as undefined.
const OPTIONS = {
  ...DEFAULT_WORLD_GEN_OPTIONS,
  mapSize: DEFAULT_WORLD_GEN_OPTIONS.mapSize ?? undefined,
  latitude: DEFAULT_WORLD_GEN_OPTIONS.latitude ?? undefined,
  longitude: DEFAULT_WORLD_GEN_OPTIONS.longitude ?? undefined,
};

/** Streams a canonical text form of a value into a hash, in small batches. */
class Canon {
  private parts: string[] = [];
  private size = 0;
  private seen = new Map<object, number>();
  constructor(private hash: Hash) {}

  private put(s: string): void {
    this.parts.push(s);
    this.size += s.length;
    if (this.size > 1 << 16) this.flush();
  }

  flush(): void {
    if (this.parts.length) this.hash.update(this.parts.join(""));
    this.parts = [];
    this.size = 0;
  }

  value(v: unknown): void {
    switch (typeof v) {
      case "number":
        this.put(Object.is(v, -0) ? "n-0;" : `n${v};`);
        return;
      case "string":
        this.put(`s${v.length}:${v}`);
        return;
      case "boolean":
        this.put(v ? "T" : "F");
        return;
      case "undefined":
        this.put("U");
        return;
      case "bigint":
        this.put(`b${v};`);
        return;
      case "symbol":
        this.put(`y${String(v)};`);
        return;
      case "function":
        this.put(`f${(v as { name?: string }).name ?? ""};`);
        return;
    }
    if (v === null) {
      this.put("N");
      return;
    }
    const obj = v as object;
    const ref = this.seen.get(obj);
    if (ref !== undefined) {
      this.put(`r${ref};`);
      return;
    }
    this.seen.set(obj, this.seen.size);

    if (ArrayBuffer.isView(obj)) {
      const view = obj as ArrayBufferView;
      this.put(`t${obj.constructor.name}:${view.byteLength}:`);
      this.flush();
      this.hash.update(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      return;
    }
    if (Array.isArray(obj)) {
      // Holes and undefined are different: a hole writes "h".
      this.put(`a${obj.length}[`);
      for (let i = 0; i < obj.length; i++) {
        if (i in obj) this.value(obj[i]);
        else this.put("h");
      }
      this.put("]");
      return;
    }
    if (obj instanceof Map) {
      this.put(`m${obj.size}{`);
      for (const [k, val] of obj) {
        this.value(k);
        this.value(val);
      }
      this.put("}");
      return;
    }
    if (obj instanceof Set) {
      this.put(`e${obj.size}{`);
      for (const k of obj) this.value(k);
      this.put("}");
      return;
    }
    const keys = Object.keys(obj);
    this.put(`o${obj.constructor?.name ?? ""}:${keys.length}{`);
    for (const k of keys) {
      this.put(`k${k.length}:${k}`);
      this.value((obj as Record<string, unknown>)[k]);
    }
    this.put("}");
  }
}

function hashWorld(seed: string): { hash: string; ms: number } {
  const start = performance.now();
  const world = generateFmgWorld(seed, OPTIONS);
  const ms = performance.now() - start;
  const hash = createHash("sha256");
  const canon = new Canon(hash);
  canon.value(world);
  canon.flush();
  return { hash: hash.digest("hex"), ms };
}

const write = process.argv.includes("--write");
const results: Record<string, string> = {};
let total = 0;
for (const seed of SEEDS) {
  const { hash, ms } = hashWorld(seed);
  results[seed] = hash;
  total += ms;
  console.log(`${seed.padEnd(22)} ${ms.toFixed(0).padStart(6)} ms  ${hash}`);
}
console.log(`total generation ${total.toFixed(0)} ms for ${SEEDS.length} seeds`);

if (write) {
  fs.writeFileSync(BASELINE, `${JSON.stringify({ options: "DEFAULT_WORLD_GEN_OPTIONS", hashes: results }, null, 2)}\n`);
  console.log(`baseline written: ${BASELINE}`);
} else {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")).hashes as Record<string, string>;
  const bad = SEEDS.filter((s) => baseline[s] !== results[s]);
  if (bad.length) {
    console.error(`MISMATCH for ${bad.length} seed(s): ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log(`all ${SEEDS.length} hashes match the baseline`);
}
