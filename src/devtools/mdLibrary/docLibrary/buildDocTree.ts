export interface TreeNode {
  name: string; path: string; isDir: boolean; children: TreeNode[]; docCount: number;
}

export function buildDocTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [], docCount: 0 };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isDir = i < parts.length - 1;
      let child = node.children.find(c => c.name === part && c.isDir === isDir);
      if (!child) { child = { name: part, path: acc, isDir, children: [], docCount: 0 }; node.children.push(child); }
      node = child;
    });
  }
  const count = (n: TreeNode): number => {
    if (!n.isDir) { n.docCount = 1; return 1; }
    n.docCount = n.children.reduce((s, c) => s + count(c), 0);
    n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return n.docCount;
  };
  count(root);
  return root;
}
