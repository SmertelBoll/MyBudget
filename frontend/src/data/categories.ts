import type { EntryType } from "@/api/types";
import { newId } from "./accounts";
import { getSnapshot, removeEntity, saveEntities, saveEntity } from "./store";
import type { Category } from "./types";

// A default category shows its dictionary name until the user renames it (spec 2.4).
export const categoryName = (category: Pick<Category, "name" | "nameKey">, t: (key: string) => string) =>
  category.name ?? (category.nameKey ? t(category.nameKey) : "");

export const sortCategories = (categories: Category[]) =>
  [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

export const categoriesOfType = (categories: Category[], type: EntryType) =>
  sortCategories(categories.filter((category) => category.type === type));

export type CategoryFields = Pick<Category, "type" | "icon" | "color" | "plannedMonthly"> & { name: string };

// Screen 7.2. Renaming a default category to its current translation keeps it translated in other languages.
export const saveCategory = async (fields: CategoryFields, translatedName: string | null, existing?: Category) => {
  const keepKey = existing?.nameKey && fields.name === translatedName;
  const name = keepKey ? null : fields.name;

  if (!existing) {
    const sameType = getSnapshot("categories").filter((category) => category.type === fields.type);
    const category: Category = {
      id: newId(),
      name,
      nameKey: null,
      type: fields.type,
      icon: fields.icon,
      color: fields.color,
      plannedMonthly: fields.plannedMonthly,
      sortOrder: Math.max(-1, ...sameType.map((category) => category.sortOrder)) + 1,
    };
    await saveEntity("categories", category);
    return category;
  }

  const category: Category = {
    ...existing,
    name,
    // The type is fixed after creation (spec 7.2).
    type: existing.type,
    icon: fields.icon,
    color: fields.color,
    plannedMonthly: fields.plannedMonthly,
  };
  await saveEntity("categories", category);
  return category;
};

// Spec 7.3: the category's transactions and regular payments move to "Other" of the same type, then it goes.
export const deleteCategory = async (category: Category) => {
  if (category.isSystemOther) return;
  const other = getSnapshot("categories").find((item) => item.isSystemOther && item.type === category.type);
  if (other) {
    await saveEntities(
      "transactions",
      getSnapshot("transactions")
        .filter((tx) => tx.categoryId === category.id)
        .map((tx) => ({ ...tx, categoryId: other.id }))
    );
    await saveEntities(
      "recurring",
      getSnapshot("recurring")
        .filter((payment) => payment.categoryId === category.id)
        .map((payment) => ({ ...payment, categoryId: other.id }))
    );
  }
  await removeEntity("categories", category.id);
};

export const countCategoryEntries = (categoryId: string) =>
  getSnapshot("transactions").filter((tx) => tx.categoryId === categoryId).length;
