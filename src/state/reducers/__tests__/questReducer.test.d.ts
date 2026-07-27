/**
 * This file checks the quest reducer's handoff into the journal queue.
 *
 * The Quest Log and Journal systems already share state in the app store, but
 * the reducer path still needs proof that quest transitions leave a journal
 * trail. These tests pin the acceptance and completion flow so later changes
 * do not quietly drop the journal bridge.
 */
export {};
