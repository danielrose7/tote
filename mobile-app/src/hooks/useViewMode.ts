import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ViewMode = "list" | "grid";
const KEY = "tote:viewMode";

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>("list");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((stored) => {
      if (stored === "grid" || stored === "list") setViewModeState(stored);
    });
  }, []);

  function setViewMode(next: ViewMode | ((current: ViewMode) => ViewMode)) {
    setViewModeState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      AsyncStorage.setItem(KEY, resolved);
      return resolved;
    });
  }

  return { viewMode, setViewMode };
}
