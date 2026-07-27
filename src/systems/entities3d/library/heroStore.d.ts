/** Everything the pipeline knows about one creature entry. */
export interface HeroRecord {
    entryId: string;
    prompt?: string;
    stages: Partial<Record<'reference' | 'master' | 'hero', {
        at: string;
        note?: string;
    }>>;
    triangles?: {
        master: number;
        hero: number;
    };
    status: 'generated' | 'approved';
}
/** The folder that holds one entry's hero.json and stage artifacts. */
export declare function heroDir(baseDir: string, entryId: string): string;
/** Read the entry's hero.json. Returns null when the file does not exist. */
export declare function readHero(baseDir: string, entryId: string): HeroRecord | null;
/** Write the entry's hero.json, creating its folder first when needed. */
export declare function writeHero(baseDir: string, record: HeroRecord): void;
/** The file each gated stage must leave behind in the entry's folder. */
export declare const STAGE_ARTIFACTS: Record<'reference' | 'master', string>;
/**
 * Gate for pipeline stages. A later stage calls this before it starts, naming
 * the earlier stage it depends on. The earlier stage counts as finished only
 * when the hero.json record lists it AND its artifact file exists on disk.
 * Anything less throws, so a stage can never run on half-finished input.
 */
export declare function assertStage(baseDir: string, entryId: string, needs: 'reference' | 'master'): void;
