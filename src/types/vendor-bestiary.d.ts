// Type declarations for 5eTools bestiary vendor JSON files.
// These files are only consumed by useBestiary.ts via dynamic import;
// we declare a minimal shape to satisfy TypeScript without pulling
// the full schema into the compilation.

declare module '*bestiary-xmm.json' {
  interface RawBestiaryEntry {
    name: string;
    source: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  const value: { monster: RawBestiaryEntry[] };
  export default value;
}

declare module '*/bestiary-mm.json' {
  interface RawBestiaryEntry {
    name: string;
    source: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  const value: { monster: RawBestiaryEntry[] };
  export default value;
}
