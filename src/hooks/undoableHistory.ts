/**
 * The undo/redo transitions behind `useUndoable`, as pure functions.
 *
 * Extracted from the hook so the semantics that govern every edit in the
 * Studio can be tested without a renderer — the same logic/component split the
 * rest of this project uses. The hook is a `useState` wrapper around these.
 */

export const MAX_HISTORY = 40;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /**
   * The coalesce key of the last change. Part of the state rather than a ref
   * because it is read while deciding the next state, and a ref read during
   * render is unsafe under concurrent rendering.
   */
  lastKey: string | null;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null };
}

/**
 * Records a new value.
 *
 * @param coalesce Groups consecutive changes from the same control into one
 * undo step. A slider drag fires dozens of changes; without this, reversing a
 * single drag would take dozens of undos.
 */
export function pushHistory<T>(current: History<T>, value: T, coalesce?: string): History<T> {
  // An edit that changes nothing must not consume an undo step, or the user
  // gets a step that appears to do nothing when they use it.
  if (Object.is(value, current.present)) return current;

  const shouldCoalesce = coalesce !== undefined && coalesce === current.lastKey;
  return {
    past: shouldCoalesce ? current.past : [...current.past, current.present].slice(-MAX_HISTORY),
    present: value,
    // Any new edit invalidates the redo branch — the classic behaviour, and
    // the only one that cannot offer a redo that no longer applies.
    future: [],
    lastKey: coalesce ?? null,
  };
}

export function undoHistory<T>(current: History<T>): History<T> {
  const previous = current.past[current.past.length - 1];
  if (previous === undefined) return current;
  return {
    past: current.past.slice(0, -1),
    present: previous,
    future: [current.present, ...current.future],
    // Cleared so a drag, an undo, then a resumed drag on the same control does
    // not silently merge into the entry the undo just stepped away from.
    lastKey: null,
  };
}

export function redoHistory<T>(current: History<T>): History<T> {
  const next = current.future[0];
  if (next === undefined) return current;
  return {
    past: [...current.past, current.present],
    present: next,
    future: current.future.slice(1),
    lastKey: null,
  };
}
