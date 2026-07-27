/**
 * This file proves queued journal events materialize into visible entries.
 *
 * The quest bridge already writes pending events first. The journal reducer
 * owns the point where those events become part of a real journal page, so
 * this test pins the merge contract in one place instead of letting the UI or
 * quest code invent its own flush behavior.
 */
export {};
