import { COLOR_DATABASE, type ReferenceColor } from "../color-engine/classification/colorDatabase";

/**
 * Color of the Day (spec §33).
 *
 * Derived deterministically from the date, not randomly: everyone opening the
 * app on the same day must see the same color, and it must not change when the
 * screen re-renders. It also needs no network and no server, which keeps the
 * feature working offline.
 */

/** Stable 32-bit hash of a string (FNV-1a). */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Local calendar date as YYYY-MM-DD, the key the selection is derived from. */
export function dateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Picks the reference color for a given day.
 *
 * @param date Defaults to today. Uses the *local* date, so the color changes at
 * the user's midnight rather than UTC's.
 * @returns A reference entry from the color database.
 *
 * Limits: with a database of ~37 entries the cycle repeats often. Expanding the
 * reference set is the fix; deriving a random color instead would mean showing
 * colors with no name and no provenance, which is worse.
 */
export function colorOfTheDay(date: Date = new Date()): ReferenceColor {
  const index = hashString(dateKey(date)) % COLOR_DATABASE.length;
  return COLOR_DATABASE[index];
}

/** Greeting appropriate to the time of day (spec §3). */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 6) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}
