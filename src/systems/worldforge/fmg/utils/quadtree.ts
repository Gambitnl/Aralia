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

interface InternalNode<T> extends Array<QuadNode<T> | undefined> {
  length: 4;
}
interface LeafNode<T> {
  data: T;
  next?: LeafNode<T>;
  length?: undefined;
}
type QuadNode<T> = InternalNode<T> | LeafNode<T>;

// d3-quadtree default accessors (point is [x, y, ...])
function defaultX(d: unknown): number {
  return (d as number[])[0];
}
function defaultY(d: unknown): number {
  return (d as number[])[1];
}

class Quad<T> {
  constructor(
    public node: QuadNode<T> | undefined,
    public x0: number,
    public y0: number,
    public x1: number,
    public y1: number,
  ) {}
}

export class Quadtree<T> {
  private _x: XAccessor<T>;
  private _y: XAccessor<T>;
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _root: QuadNode<T> | undefined = undefined;

  constructor(x: XAccessor<T> = defaultX as XAccessor<T>, y: XAccessor<T> = defaultY as XAccessor<T>) {
    this._x = x;
    this._y = y;
  }

  // d3-quadtree cover.js — verbatim port (doubling expansion)
  cover(x: number, y: number): this {
    if (isNaN((x = +x)) || isNaN((y = +y))) return this; // ignore invalid points

    let x0 = this._x0;
    let y0 = this._y0;
    let x1 = this._x1;
    let y1 = this._y1;

    // If the quadtree has no extent, initialize them.
    // Integer extent are necessary so that if we later double the extent,
    // the existing quadrant boundaries don't change due to floating point error!
    if (isNaN(x0)) {
      x1 = (x0 = Math.floor(x)) + 1;
      y1 = (y0 = Math.floor(y)) + 1;
    }

    // Otherwise, double repeatedly to cover.
    else {
      let z = x1 - x0 || 1;
      let node = this._root;
      let parent: InternalNode<T>;
      let i: number;

      while (x0 > x || x >= x1 || y0 > y || y >= y1) {
        i = +(y < y0) << 1 | +(x < x0);
        parent = new Array(4) as unknown as InternalNode<T>;
        parent[i] = node;
        node = parent;
        z *= 2;
        switch (i) {
          case 0:
            x1 = x0 + z;
            y1 = y0 + z;
            break;
          case 1:
            x0 = x1 - z;
            y1 = y0 + z;
            break;
          case 2:
            x1 = x0 + z;
            y0 = y1 - z;
            break;
          case 3:
            x0 = x1 - z;
            y0 = y1 - z;
            break;
        }
      }

      if (this._root && (this._root as InternalNode<T>).length) this._root = node;
    }

    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    return this;
  }

  // d3-quadtree add.js — verbatim port
  add(d: T): Quadtree<T> {
    const x = +this._x.call(null, d);
    const y = +this._y.call(null, d);
    return addPoint(this.cover(x, y), x, y, d);
  }

  // d3-quadtree add.js addAll — verbatim port
  addAll(data: T[]): Quadtree<T> {
    let d: T;
    let x: number;
    let y: number;
    const n = data.length;
    const xz = new Float64Array(n);
    const yz = new Float64Array(n);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;

    // Compute the points and their extent.
    for (let i = 0; i < n; ++i) {
      if (isNaN((x = +this._x.call(null, (d = data[i])))) || isNaN((y = +this._y.call(null, d)))) continue;
      xz[i] = x;
      yz[i] = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }

    // If there were no (valid) points, abort.
    if (x0 > x1 || y0 > y1) return this;

    // Expand the tree to cover the new points.
    this.cover(x0, y0).cover(x1, y1);

    // Add the new points.
    for (let i = 0; i < n; ++i) {
      addPoint(this, xz[i], yz[i], data[i]);
    }

    return this;
  }

  // d3-quadtree remove.js — verbatim port (Military regiment merging walks
  // the tree destructively: every processed platoon is removed before its
  // neighborhood is searched).
  remove(d: T): this {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let x: number;
    let y: number;
    if (isNaN((x = +this._x.call(null, d))) || isNaN((y = +this._y.call(null, d)))) return this; // ignore invalid points

    let parent: InternalNode<T> | undefined;
    let node: QuadNode<T> | undefined = this._root;
    let retainer: InternalNode<T> | undefined;
    let previous: LeafNode<T> | undefined;
    let next: LeafNode<T> | undefined;
    let x0 = this._x0;
    let y0 = this._y0;
    let x1 = this._x1;
    let y1 = this._y1;
    let xm: number;
    let ym: number;
    let right: number | boolean;
    let bottom: number | boolean;
    let i = 0;
    let j = 0;

    // If the tree is empty, initialize the root as a leaf.
    if (!node) return this;

    // Find the leaf node for the point.
    // While descending, also retain the deepest parent with a non-removed sibling.
    if ((node as InternalNode<T>).length)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if ((right = x >= (xm = (x0 + x1) / 2))) x0 = xm;
        else x1 = xm;
        if ((bottom = y >= (ym = (y0 + y1) / 2))) y0 = ym;
        else y1 = ym;
        parent = node as InternalNode<T>;
        i = ((+bottom) << 1) | +right;
        node = parent[i];
        if (!node) return this;
        if (!(node as InternalNode<T>).length) break;
        if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) {
          retainer = parent;
          j = i;
        }
      }

    // Find the point to remove.
    while ((node as LeafNode<T>).data !== d) {
      previous = node as LeafNode<T>;
      node = (node as LeafNode<T>).next;
      if (!node) return this;
    }
    if ((next = (node as LeafNode<T>).next)) delete (node as LeafNode<T>).next;

    // If there are multiple coincident points, remove just the point.
    if (previous) {
      if (next) previous.next = next;
      else delete previous.next;
      return this;
    }

    // If this is the root point, remove it.
    if (!parent) {
      this._root = next;
      return this;
    }

    // Remove this leaf.
    if (next) parent[i] = next;
    else delete parent[i];

    // If the parent now contains exactly one leaf, collapse superfluous parents.
    if (
      (node = parent[0] || parent[1] || parent[2] || parent[3]) &&
      node === (parent[3] || parent[2] || parent[1] || parent[0]) &&
      !(node as InternalNode<T>).length
    ) {
      if (retainer) retainer[j] = node;
      else this._root = node;
    }

    return this;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  // d3-quadtree find.js — verbatim port
  find(x: number, y: number, radius?: number): T | undefined {
    let data: T | undefined;
    let x0 = this._x0;
    let y0 = this._y0;
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    let x3 = this._x1;
    let y3 = this._y1;
    const quads: Quad<T>[] = [];
    let node = this._root;
    let q: Quad<T> | undefined;
    let i: number;

    if (node) quads.push(new Quad(node, x0, y0, x3, y3));
    if (radius == null) radius = Infinity;
    else {
      x0 = x - radius;
      y0 = y - radius;
      x3 = x + radius;
      y3 = y + radius;
      radius *= radius;
    }

    while ((q = quads.pop())) {
      // Stop searching if this quadrant can't contain a closer node.
      if (
        !(node = q.node) ||
        (x1 = q.x0) > x3 ||
        (y1 = q.y0) > y3 ||
        (x2 = q.x1) < x0 ||
        (y2 = q.y1) < y0
      )
        continue;

      // Bisect the current quadrant.
      if ((node as InternalNode<T>).length) {
        const xm = (x1 + x2) / 2;
        const ym = (y1 + y2) / 2;
        const internal = node as InternalNode<T>;

        quads.push(
          new Quad(internal[3], xm, ym, x2, y2),
          new Quad(internal[2], x1, ym, xm, y2),
          new Quad(internal[1], xm, y1, x2, ym),
          new Quad(internal[0], x1, y1, xm, ym),
        );

        // Visit the closest quadrant first.
        if ((i = (+(y >= ym) << 1) | +(x >= xm))) {
          q = quads[quads.length - 1];
          quads[quads.length - 1] = quads[quads.length - 1 - i];
          quads[quads.length - 1 - i] = q;
        }
      }

      // Visit this point. (Visiting coincident points isn't necessary!)
      else {
        const leaf = node as LeafNode<T>;
        const dx = x - +this._x.call(null, leaf.data);
        const dy = y - +this._y.call(null, leaf.data);
        const d2 = dx * dx + dy * dy;
        if (d2 < radius) {
          const d = Math.sqrt((radius = d2));
          x0 = x - d;
          y0 = y - d;
          x3 = x + d;
          y3 = y + d;
          data = leaf.data;
        }
      }
    }

    return data;
  }
}

// d3-quadtree add.js `add(tree, x, y, d)` — verbatim port
function addPoint<T>(tree: Quadtree<T>, x: number, y: number, d: T): Quadtree<T> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const t = tree as any;
  if (isNaN(x) || isNaN(y)) return tree; // ignore invalid points

  let parent: InternalNode<T> | undefined;
  let node: QuadNode<T> | undefined = t._root;
  const leaf: LeafNode<T> = { data: d };
  let x0 = t._x0;
  let y0 = t._y0;
  let x1 = t._x1;
  let y1 = t._y1;
  let xm: number;
  let ym: number;
  let right: number | boolean;
  let bottom: number | boolean;
  let i = 0;
  let j = 0;

  // If the tree is empty, initialize the root as a leaf.
  if (!node) {
    t._root = leaf;
    return tree;
  }

  // Find the existing leaf for the new point, or add it.
  while ((node as InternalNode<T>).length) {
    if ((right = x >= (xm = (x0 + x1) / 2))) x0 = xm;
    else x1 = xm;
    if ((bottom = y >= (ym = (y0 + y1) / 2))) y0 = ym;
    else y1 = ym;
    parent = node as InternalNode<T>;
    i = ((+bottom) << 1) | +right;
    node = parent[i];
    if (!node) {
      parent[i] = leaf;
      return tree;
    }
  }

  // Is the new point is exactly coincident with the existing point?
  const xp = +t._x.call(null, (node as LeafNode<T>).data);
  const yp = +t._y.call(null, (node as LeafNode<T>).data);
  if (x === xp && y === yp) {
    leaf.next = node as LeafNode<T>;
    if (parent) parent[i] = leaf;
    else t._root = leaf;
    return tree;
  }

  // Otherwise, split the leaf node until the old and new point are separated.
  do {
    if (parent) {
      parent = parent[i] = new Array(4) as unknown as InternalNode<T>;
    } else {
      parent = t._root = new Array(4) as unknown as InternalNode<T>;
    }
    if ((right = x >= (xm = (x0 + x1) / 2))) x0 = xm;
    else x1 = xm;
    if ((bottom = y >= (ym = (y0 + y1) / 2))) y0 = ym;
    else y1 = ym;
  } while ((i = ((+bottom) << 1) | +right) === (j = ((+(yp >= ym)) << 1) | +(xp >= xm)));
  parent[j] = node;
  parent[i] = leaf;
  return tree;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * d3.quadtree(nodes?, x?, y?) — default accessors d[0]/d[1]; custom x/y
 * accessors supported since the Military port (upstream calls
 * `d3.quadtree(nodes, d => d.x, d => d.y)` for platoon merging).
 */
export function quadtree<T = number[]>(
  nodes?: T[],
  x?: XAccessor<T>,
  y?: XAccessor<T>,
): Quadtree<T> {
  const tree = new Quadtree<T>(x, y);
  if (nodes != null) tree.addAll(nodes);
  return tree;
}
