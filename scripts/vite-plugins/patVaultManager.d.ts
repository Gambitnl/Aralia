interface CredDef {
    id: string;
    label: string;
    account: string;
    kind: 'PAT' | 'API key' | 'OAuth' | 'subscription';
    envVar?: string;
    file?: string;
    purpose: string;
    scopes?: string;
    docsUrl?: string;
    credentialManager?: boolean;
    /** baseline status when there's nothing to presence-check (OAuth/subscription) */
    staticStatus?: 'active' | 'pending' | 'missing' | 'n/a';
}
export declare function credentialManagerTarget(id: string): string;
export declare function credentialManagerEntryExists(id: string): Promise<boolean>;
export declare function statusOf(c: Pick<CredDef, 'staticStatus'>, envSet: boolean, fileExists: boolean, credentialManagerSet: boolean): string;
export declare const patVaultManager: () => {
    name: string;
    configureServer(server: {
        middlewares: {
            use: (h: (req: any, res: any, next: any) => void) => void;
        };
    }): void;
};
export {};
