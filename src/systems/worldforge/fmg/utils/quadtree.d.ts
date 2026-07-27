/**
 * @file utils/quadtree.ts — minimal d3-quadtree port for the FMG civilization
 * stages. Upstream FMG (TS branch) imports `quadtree` from "d3" (d3-quadtree
 * 3.x, ISC, Mike Bostock); this is a verbatim re-implementation of the subset
 * the generation path uses: `quadtree()`, `quadtree(data)`, `.add`, `.addAll`,
 * `.cover` and `.find`.
 *
 * Faithfulness: `find(x, y, radius)` quadrant visit order and the `add` leaf
 * splitting/linking order are exactly d3's — they decide WHICH point is
 * returned on radius ties, which feeds culture/burg/religion placement.
 * Do not replace with another spatial index.
 *
 * Consumers: Cultures.generate (culture centers), Burgs.generate (burg
 * spacing), Religions.generate (religion cores), reGraph's `pack.cells.q`
 * (built in generateWorld.ts) for findClosestCell, Military.generate
 * (regiment merge tree — needs `.remove` and custom accessors, added for
 * that port; both are verbatim d3-quadtree 3.x).
 */
type XAccessor<T> = (d: T) => number;
export declare class Quadtree<T> {
    private _x;
    private _y;
    private _x0;
    private _y0;
    private _x1;
    private _y1;
    private _root;
    constructor(x?: XAccessor<T>, y?: XAccessor<T>);
    cover(x: number, y: number): this;
    add(d: T): Quadtree<T>;
    addAll(data: T[]): Quadtree<T>;
    remove(d: T): this;
    find(x: number, y: number, radius?: number): T | undefined;
}
/**
 * d3.quadtree(nodes?, x?, y?) — default accessors d[0]/d[1]; custom x/y
 * accessors supported since the Military port (upstream calls
 * `d3.quadtree(nodes, d => d.x, d => d.y)` for platoon merging).
 */
export declare function quadtree<T = number[]>(nodes?: T[], x?: XAccessor<T>, y?: XAccessor<T>): Quadtree<T>;
export {};
