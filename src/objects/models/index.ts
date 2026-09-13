import type { ObjectCategory, ObjectModel } from "../types";
import { CAR } from "./car";
import { SNEAKER } from "./sneaker";
import { TSHIRT } from "./tshirt";

/**
 * The built-in object catalogue.
 *
 * These are vector models authored in the app bundle: they work offline,
 * recolor exactly, and cost nothing to distribute. They are deliberately
 * stylised rather than photoreal — see `docs/OBJECT_STUDIO.md`.
 *
 * Photographic mockups (§6) plug in through the `objects` table without any
 * change here: `loadObject` prefers a remote model when one exists for the id,
 * which is what makes the two sources interchangeable.
 */
export const BUILTIN_OBJECTS: ObjectModel[] = [TSHIRT, SNEAKER, CAR];

export const BUILTIN_BY_ID: Record<string, ObjectModel> = Object.fromEntries(
  BUILTIN_OBJECTS.map((model) => [model.id, model]),
);

export function builtinObject(id: string): ObjectModel | undefined {
  return BUILTIN_BY_ID[id];
}

export const CATEGORY_LABEL_FR: Record<ObjectCategory, string> = {
  fashion: "Mode",
  shoes: "Chaussures",
  automotive: "Automobile",
  home: "Maison",
  accessories: "Accessoires",
  design: "Design",
};

export const CATEGORY_ICON: Record<ObjectCategory, string> = {
  fashion: "shirt-outline",
  shoes: "footsteps-outline",
  automotive: "car-sport-outline",
  home: "bed-outline",
  accessories: "watch-outline",
  design: "layers-outline",
};

export const ALL_CATEGORIES: ObjectCategory[] = [
  "fashion",
  "shoes",
  "automotive",
  "home",
  "accessories",
  "design",
];

export { CAR, SNEAKER, TSHIRT };
