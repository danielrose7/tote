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

  function setViewMode(m: ViewMode) {
    setViewModeState(m);
    AsyncStorage.setItem(KEY, m);
  }

  return { viewMode, setViewMode };
}
