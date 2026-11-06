import { router } from "expo-router";
import type { EntryType } from "@/api/types";

// Opens the add-entry screen (screen 4); Home's "+" and other screens use it.
export const openNewTransaction = (type?: EntryType) =>
  router.push({ pathname: "/transaction/[id]", params: { id: "new", ...(type && { type }) } });

export const openTransaction = (id: string) => router.push({ pathname: "/transaction/[id]", params: { id } });
