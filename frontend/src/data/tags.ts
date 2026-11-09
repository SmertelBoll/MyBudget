import { useMemo } from "react";
import { QUICK_COLORS } from "@/constants/appearance";
import { newId } from "./accounts";
import { useCollection } from "./hooks";
import { getSnapshot, removeEntity, saveEntities, saveEntity } from "./store";
import type { Tag } from "./types";

export const TAG_MAX_LENGTH = 20;

// Tag names are unique regardless of case (spec 5.1); the server checks it too.
export const findTagByName = (name: string, exceptId?: string) => {
  const needle = name.trim().toLowerCase();
  return getSnapshot("tags").find((tag) => tag.id !== exceptId && tag.name.toLowerCase() === needle);
};

export const sortTags = (tags: Tag[], lang?: string) => [...tags].sort((a, b) => a.name.localeCompare(b.name, lang));

// A tag with no color of its own: a steady one picked from its id (so tags made before colors existed differ too).
const colorFromId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return QUICK_COLORS[Math.abs(hash) % QUICK_COLORS.length];
};

// Subtags go one level deep: a subtag belongs to a top-level tag. A parent that is gone or is itself a subtag
// (possible after edits on two devices) is ignored, and the tag counts as top-level.
export type TagTree = {
  byId: Map<string, Tag>;
  parentOf: (id: string) => string | null;
  // A known tag's top-level tag (itself when it has none); null for a tag that is gone.
  rootOf: (id: string) => string | null;
  // Top-level tag -> its subtags, by name.
  children: Map<string, Tag[]>;
  // Its own color, else its parent's, else one from its id.
  colorOf: (id: string) => string;
  // Top-level tags by name, each followed by its subtags: [tag, depth].
  ordered: { tag: Tag; depth: 0 | 1 }[];
};

export const buildTagTree = (tags: Tag[], lang?: string): TagTree => {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const parentOf = (id: string) => {
    const parentId = byId.get(id)?.parentId;
    if (!parentId || parentId === id) return null;
    const parent = byId.get(parentId);
    return parent && !(parent.parentId && byId.has(parent.parentId) && parent.parentId !== parent.id) ? parentId : null;
  };
  const rootOf = (id: string) => (byId.has(id) ? (parentOf(id) ?? id) : null);
  const children = new Map<string, Tag[]>();
  const sorted = sortTags(tags, lang);
  for (const tag of sorted) {
    const parent = parentOf(tag.id);
    if (!parent) continue;
    const list = children.get(parent);
    if (list) list.push(tag);
    else children.set(parent, [tag]);
  }
  const colorOf = (id: string): string => {
    const tag = byId.get(id);
    if (tag?.color) return tag.color;
    const parent = parentOf(id);
    return parent ? colorOf(parent) : colorFromId(id);
  };
  const ordered: TagTree["ordered"] = [];
  for (const tag of sorted) {
    if (parentOf(tag.id)) continue;
    ordered.push({ tag, depth: 0 });
    for (const child of children.get(tag.id) ?? []) ordered.push({ tag: child, depth: 1 });
  }
  return { byId, parentOf, rootOf, children, colorOf, ordered };
};

export const useTagTree = () => {
  const tags = useCollection("tags");
  return useMemo(() => buildTagTree(tags), [tags]);
};

// The tags an entry counts in when tags are grouped: each of its top-level tags once.
export const rootsOf = (tagIds: string[], tree: TagTree) => {
  const roots: string[] = [];
  for (const id of tagIds) {
    const root = tree.rootOf(id);
    if (root && !roots.includes(root)) roots.push(root);
  }
  return roots;
};

// A new top-level tag gets the first quick color no other top-level tag has yet.
export const nextTagColor = (tree: TagTree) => {
  const used = new Set(tree.ordered.filter((item) => item.depth === 0).map((item) => tree.colorOf(item.tag.id).toLowerCase()));
  return QUICK_COLORS.find((color) => !used.has(color.toLowerCase())) ?? QUICK_COLORS[tree.byId.size % QUICK_COLORS.length];
};

export const createTag = async (name: string, fields: { color?: string | null; parentId?: string | null } = {}) => {
  const tag: Tag = { id: newId(), name: name.trim(), color: fields.color ?? null, parentId: fields.parentId ?? null };
  await saveEntity("tags", tag);
  return tag;
};

export const updateTag = (tag: Tag, fields: { name: string; color: string | null; parentId: string | null }) =>
  saveEntity("tags", { ...tag, ...fields, name: fields.name.trim() });

// Spec 7.4: deleting a tag takes it off every transaction and regular payment; its subtags become top-level tags.
export const deleteTag = async (tag: Tag) => {
  const strip = <T extends { tagIds: string[] }>(items: T[]) =>
    items.filter((item) => item.tagIds.includes(tag.id)).map((item) => ({ ...item, tagIds: item.tagIds.filter((id) => id !== tag.id) }));
  await saveEntities("transactions", strip(getSnapshot("transactions")));
  await saveEntities("recurring", strip(getSnapshot("recurring")));
  await saveEntities(
    "tags",
    getSnapshot("tags")
      .filter((child) => child.parentId === tag.id)
      .map((child) => ({ ...child, parentId: null }))
  );
  await removeEntity("tags", tag.id);
};

export const countTagUses = (tagId: string) =>
  getSnapshot("transactions").filter((tx) => tx.tagIds.includes(tagId)).length;
