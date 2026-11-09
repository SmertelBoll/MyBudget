import { saveEntities } from "./store";
import type { Collection, EntityMap } from "./types";

type Ordered = { id: string; sortOrder: number };

// Saves a whole new order (drag and drop): items get 0..n-1 by their place in `keys`; only changed ones are saved.
export const applyOrder = <C extends Collection>(collection: C, items: (EntityMap[C] & Ordered)[], keys: string[]) => {
  const place = new Map(keys.map((key, index) => [key, index]));
  const changed = items
    .map((item) => {
      const index = place.get(item.id);
      return index === undefined || index === item.sortOrder ? null : { ...item, sortOrder: index };
    })
    .filter((item): item is EntityMap[C] & Ordered => item !== null);
  return saveEntities(collection, changed);
};
