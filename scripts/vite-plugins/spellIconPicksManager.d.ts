export declare const spellIconPicksManager: () => {
    name: string;
    configureServer(server: {
        middlewares: {
            use: (h: (req: any, res: any, next: any) => void) => void;
        };
    }): void;
};
