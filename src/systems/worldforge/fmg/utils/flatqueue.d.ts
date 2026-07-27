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
export declare class FlatQueue<T> {
    private ids;
    private values;
    length: number;
    clear(): void;
    push(id: T, value: number): void;
    pop(): T | undefined;
    peek(): T | undefined;
    peekValue(): number | undefined;
    shrink(): void;
}
