import {
  MAX_HISTORY,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../undoableHistory";

/**
 * Undo/redo semantics — the transitions that govern every edit in the Studio.
 *
 * These test the functions the hook actually uses, not a copy of them: the
 * transitions live in `undoableHistory.ts` precisely so that the behaviour can
 * be verified without a renderer.
 */

const create = createHistory;
const set = pushHistory;
const undo = undoHistory;
const redo = redoHistory;

describe("undo history", () => {
  it("walks back and forward through edits", () => {
    let history = create("a");
    history = set(history, "b");
    history = set(history, "c");
    expect(history.present).toBe("c");
    history = undo(history);
    expect(history.present).toBe("b");
    history = undo(history);
    expect(history.present).toBe("a");
    history = redo(history);
    expect(history.present).toBe("b");
  });

  it("does nothing at either end instead of throwing", () => {
    const start = create("a");
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it("drops the redo branch when a new edit is made", () => {
    // The classic behaviour, and the only one that cannot present the user
    // with a redo that no longer applies to the state they are looking at.
    let history = set(create("a"), "b");
    history = undo(history);
    history = set(history, "c");
    expect(history.future).toHaveLength(0);
    expect(redo(history).present).toBe("c");
  });

  it("collapses a slider drag into one undo step", () => {
    // Without coalescing, reversing a single drag would take dozens of undos.
    let history = create(0);
    for (let value = 1; value <= 20; value++) history = set(history, value, "gloss");
    expect(history.present).toBe(20);
    expect(history.past).toHaveLength(1);
    expect(undo(history).present).toBe(0);
  });

  it("starts a new step when the control changes", () => {
    let history = create(0);
    history = set(history, 1, "gloss");
    history = set(history, 2, "shadows");
    expect(history.past).toHaveLength(2);
    expect(undo(history).present).toBe(1);
  });

  it("ignores a change that does not change anything", () => {
    // Otherwise re-selecting the color already applied would consume an undo
    // step that appears to do nothing when used.
    const history = set(create("a"), "b");
    expect(set(history, "b")).toBe(history);
  });

  it("caps history rather than growing without bound", () => {
    let history = create(0);
    for (let value = 1; value <= MAX_HISTORY + 15; value++) history = set(history, value);
    expect(history.past).toHaveLength(MAX_HISTORY);
    // The oldest entries are discarded, the most recent kept.
    expect(history.past[history.past.length - 1]).toBe(MAX_HISTORY + 14);
  });

  it("clears the coalesce key after an undo", () => {
    // Otherwise a drag, an undo, then a resumed drag on the same control would
    // silently merge into the entry the undo just stepped away from.
    let history = set(create(0), 1, "gloss");
    history = undo(history);
    history = set(history, 5, "gloss");
    expect(history.past).toHaveLength(1);
  });
});
