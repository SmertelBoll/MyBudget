import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { EntryType } from "@/api/types";

// Where a home-screen widget's tap lands (mybudget://from-widget?type=…): whatever screen the app was left on is
// closed, Home comes back, and the new-entry form opens on top of it, so "back" from the form always means Home.
export default function FromWidget() {
  const { type } = useLocalSearchParams<{ type?: EntryType }>();

  useEffect(() => {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
    router.push({ pathname: "/transaction/[id]", params: { id: "new", ...(type === "expense" || type === "income" ? { type } : {}) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on landing
  }, []);

  return null;
}
