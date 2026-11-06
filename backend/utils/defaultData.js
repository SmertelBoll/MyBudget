import crypto from "crypto";
import CategoryModel from "../models/category.js";
import { reserveSeq } from "./syncEngine.js";

// Spec part 8. Names are dictionary keys ("category.food"); icons are MaterialCommunityIcons names.
export const DEFAULT_CATEGORIES = {
  expense: [
    { key: "food", icon: "food", color: "#ff7043" },
    { key: "transport", icon: "bus", color: "#42a5f5" },
    { key: "housing", icon: "home", color: "#8d6e63" },
    { key: "health", icon: "medical-bag", color: "#ef5350" },
    { key: "entertainment", icon: "gamepad-variant", color: "#ab47bc" },
    { key: "shopping", icon: "shopping", color: "#ec407a" },
    { key: "other", icon: "dots-horizontal", color: "#9e9e9e" },
  ],
  income: [
    { key: "salary", icon: "cash", color: "#66bb6a" },
    { key: "freelance", icon: "laptop", color: "#26a69a" },
    { key: "gifts", icon: "gift", color: "#ffa726" },
    { key: "investments", icon: "chart-line", color: "#5c6bc0" },
    { key: "refunds", icon: "cash-refund", color: "#29b6f6" },
    { key: "cashback", icon: "percent", color: "#d4e157" },
    { key: "other", icon: "dots-horizontal", color: "#9e9e9e" },
  ],
};

// Call inside withUserLock (or before the user can sync at all, as in registration).
export const createDefaultCategories = async (userId) => {
  const templates = Object.entries(DEFAULT_CATEGORIES).flatMap(([type, list]) =>
    list.map((category, index) => ({ ...category, type, sortOrder: index }))
  );
  let seq = await reserveSeq(userId, templates.length);

  await CategoryModel.insertMany(
    templates.map(({ key, icon, color, type, sortOrder }) => ({
      _id: crypto.randomUUID(),
      userId,
      seq: ++seq,
      nameKey: `category.${key}`,
      type,
      icon,
      color,
      sortOrder,
      isSystemOther: key === "other",
    }))
  );
};
