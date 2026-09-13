import { useCallback, useMemo, useState } from "react";

import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from "./undoableHistory";

/**
 * State with undo and redo — ColorLens page 11 ("Annuler / Rétablir").
 *
 * Holds whole snapshots rather than diffs. A Studio project is a small object
 * (a handful of zones and a dozen numbers), so storing 40 copies costs less
 * memory than a command pattern costs in complexity, and it cannot drift out
 * of sync the way a badly-written inverse operation can.
 *
 * The transitions live in `undoableHistory.ts` as pure functions so they can
 * be tested directly; this hook only holds them in React state.
 */
export function useUndoable<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>(() => createHistory(initial));

  const set = useCallback((next: T | ((current: T) => T), coalesce?: string) => {
    setHistory((current) =>
      pushHistory(
        current,
        typeof next === "function" ? (next as (c: T) => T)(current.present) : next,
        coalesce,
      ),
    );
  }, []);

  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);

  /** Replaces the state and clears history — for loading a saved creation. */
  const reset = useCallback((value: T) => setHistory(createHistory(value)), []);

  return useMemo(
    () => ({
      state: history.present,
      set,
      undo,
      redo,
      reset,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history, set, undo, redo, reset],
  );
}
