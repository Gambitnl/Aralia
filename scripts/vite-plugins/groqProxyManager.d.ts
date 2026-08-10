export interface GroqKeyLoaderOptions {
    /** How long a null or empty read suppresses another credential process. */
    missingKeyRetryDelayMs?: number;
    /** Injectable clock used by focused tests; production uses the system clock. */
    now?: () => number;
}
/**
 * Build the lazy key loader. The key is read on first use and the SUCCESSFUL
 * result is cached so a heavy credential read runs once per session.
 *
 * The important subtlety — and the reason this is its own testable unit — is how
 * a FAILED read is handled. A `null`/empty result means the read did not produce
 * a key (for example the Credential Manager call timed out while the dev server
 * was busy warming up the first build). Such a result must NOT be cached for the
 * whole session: that would leave the proxy permanently keyless and every request
 * would 500 until the dev server restarted. That is exactly the "proxy came up
 * but never loaded the key" auto-start failure this manager is meant to avoid.
 *
 * So we share the in-flight promise between concurrent callers, keep a real key
 * for the session, and remember a missing result only for a short cooldown. That
 * cooldown prevents sequential requests from each paying the external-process
 * cost, but its expiry still lets the proxy recover when a key is added later.
 *
 * `readKey` is injected so tests can drive the retry/cache behavior without
 * touching Windows Credential Manager.
 */
export declare function createGroqKeyLoader(readKey: () => Promise<string | null>, { missingKeyRetryDelayMs, now, }?: GroqKeyLoaderOptions): () => Promise<string | null>;
/** Starts the bundled standalone proxy on one validated loopback port. */
export type StartGroqProxy = (port: number) => Promise<void>;
export declare const groqProxyManager: (loadKey?: () => Promise<string | null>, startProxy?: StartGroqProxy) => {
    name: string;
    configureServer(server: {
        middlewares: {
            use: (h: (req: any, res: any, next: any) => void) => void;
        };
    }): void;
};
