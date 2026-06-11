/**
 * @file utils/flatqueue.ts — FlatQueue, vendored by FMG as
 * `public/libs/flatqueue.js` and exposed as the global `window.FlatQueue`.
 * Un-minified verbatim port (same algorithm, same heap layout) of
 * https://github.com/mourner/flatqueue (ISC, Vladimir Agafonkin).
 *
 * Faithfulness: the binary-heap sift order is part of FMG's deterministic
 * output — Cultures.expand / States.expandStates / Religions.expandReligions /
 * Provinces.generate / findPath all pop ties in heap order. Do not replace
 * with another priority-queue implementation.
 */
export class FlatQueue<T> {
  private ids: T[] = [];
  private values: number[] = [];
  length = 0;

  clear(): void {
    this.length = 0;
  }

  push(id: T, value: number): void {
    let pos = this.length++;
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      const parentValue = this.values[parent];
      if (value >= parentValue) break;
      this.ids[pos] = this.ids[parent];
      this.values[pos] = parentValue;
      pos = parent;
    }
    this.ids[pos] = id;
    this.values[pos] = value;
  }

  pop(): T | undefined {
    if (this.length === 0) return undefined;
    const top = this.ids[0];
    this.length--;
    if (this.length > 0) {
      const id = (this.ids[0] = this.ids[this.length]);
      const value = (this.values[0] = this.values[this.length]);
      const halfLength = this.length >> 1;
      let pos = 0;
      while (pos < halfLength) {
        let left = (pos << 1) + 1;
        const right = left + 1;
        let bestIndex = this.ids[left];
        let bestValue = this.values[left];
        const rightValue = this.values[right];
        if (right < this.length && rightValue < bestValue) {
          left = right;
          bestIndex = this.ids[right];
          bestValue = rightValue;
        }
        if (bestValue >= value) break;
        this.ids[pos] = bestIndex;
        this.values[pos] = bestValue;
        pos = left;
      }
      this.ids[pos] = id;
      this.values[pos] = value;
    }
    return top;
  }

  peek(): T | undefined {
    if (this.length !== 0) return this.ids[0];
    return undefined;
  }

  peekValue(): number | undefined {
    if (this.length !== 0) return this.values[0];
    return undefined;
  }

  shrink(): void {
    this.ids.length = this.values.length = this.length;
  }
}
