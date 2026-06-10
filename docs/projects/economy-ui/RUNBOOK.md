# Economy UI Runbook

Status: active
Last updated: 2026-06-09

## Open the Investment Board

1. Open the Dev Menu.
2. Click `Investment Board`.
3. The Dev Menu closes and the board appears as a modal.

## Use the Board

1. Click an `Invest` button to dispatch `INVEST_IN_CARAVAN`.
2. Click `Negotiate` on a loan offer to dispatch `TAKE_LOAN`.
3. Close the board with the close button or `Escape`.

## Maintenance Rule

- If the board moves again, keep the visibility toggle in `uiReducer`, mount it in `GameModals`, and add one focused regression test that clicks the live buttons.
- Keep the visibility ownership contract stable: `uiReducer` owns the route dashboard and investment board visibility flags, while `economyReducer` owns the ledger and courier visibility flags.
- If a future owner wants to normalize that split, treat it as an explicit reducer migration review rather than a local docs edit.
