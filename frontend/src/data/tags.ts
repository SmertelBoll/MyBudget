import { newId } from "./accounts";
import { getSnapshot, removeEntity, saveEntities, saveEntity } from "./store";
import type { Tag } from "./types";

export const TAG_MAX_LENGTH = 20;

// Tag names are unique regardless of case (spec 5.1); the server checks it too.
export const findTagByName = (name: string, exceptId?: string) => {
  const needle = name.trim().toLowerCase();
  return getSnapshot("tags").find((tag) => tag.id !== exceptId && tag.name.toLowerCase() === needle);
};

export const sortTags = (tags: Tag[], lang: string) => [...tags].sort((a, b) => a.name.localeCompare(b.name, lang));

export const createTag = async (name: string) => {
  const tag: Tag = { id: newId(), name: name.trim() };
  await saveEntity("tags", tag);
  return tag;
};

export const renameTag = (tag: Tag, name: string) => saveEntity("tags", { ...tag, name: name.trim() });

// Spec 7.4: deleting a tag takes it off every transaction and regular payment.
export const deleteTag = async (tag: Tag) => {
  const strip = <T extends { tagIds: string[] }>(items: T[]) =>
    items.filter((item) => item.tagIds.includes(tag.id)).map((item) => ({ ...item, tagIds: item.tagIds.filter((id) => id !== tag.id) }));
  await saveEntities("transactions", strip(getSnapshot("transactions")));
  await saveEntities("recurring", strip(getSnapshot("recurring")));
  await removeEntity("tags", tag.id);
};

export const countTagUses = (tagId: string) =>
  getSnapshot("transactions").filter((tx) => tx.tagIds.includes(tagId)).length;
