export declare const TARGET_DIRECTORIES: string[];
export declare const MOJIBAKE_MARKERS: {
    pattern: RegExp;
    name: string;
}[];
export declare const FORBIDDEN_CHARS: {
    pattern: RegExp;
    name: string;
    replacement: string;
}[];
export declare const NORMALIZATIONS: {
    pattern: RegExp;
    replacement: string;
    name: string;
}[];
export interface Issue {
    line: number;
    column: number;
    char: string;
    codePoint: string;
    type: string;
    suggested?: string;
    /** 'strict' issues (JSON/data files) fail the build; 'soft' issues (docs) are warnings only */
    severity: 'strict' | 'soft';
}
export declare function checkFile(filePath: string): Issue[];
