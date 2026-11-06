import { saveEntities } from "./store";
import type { Collection, EntityMap } from "./types";

type Ordered = { id: string; sortOrder: number };

// Moves one item to another item's place (spec 5.1, 7.1: rearranging by long press). Every item gets a fresh
// 0..n-1 order, and only the ones whose number changed are saved and synced.
export const moveItem = <C extends Collection>(collection: C, items: (EntityMap[C] & Ordered)[], fromId: string, toId: string) => {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return Promise.resolve();

  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  const changed = reordered
    .map((item, index) => (item.sortOrder === index ? null : { ...item, sortOrder: index }))
    .filter((item): item is EntityMap[C] & Ordered => item !== null);
  return saveEntities(collection, changed);
};
