export interface TreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children: TreeNode[];
    docCount: number;
}
export declare function buildDocTree(paths: string[]): TreeNode;
