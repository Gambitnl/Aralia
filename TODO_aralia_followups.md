# TODOs and Future Improvements

- Automate import map synchronization with `package.json` versions to prevent browser/CDN drift from the bundled output.
- Add hook lifecycle diagrams (initialization, combat, audio) so adjacent components follow the expected sequencing and state ownership.
- Introduce lightweight automated checks (e.g., `tsc --noEmit` plus a smoke test) to guard gameplay hooks and dependency wiring.
- Define a styling source-of-truth policy that clarifies when to use Tailwind utilities versus `src/index.css` and `public/styles.css` overrides.
