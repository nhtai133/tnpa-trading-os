"use client";

import { useSyncExternalStore } from "react";
import {
  readRiskSettings,
  subscribeToRiskSettings,
} from "@/app/_lib/risk-settings-storage";

export function useRiskSettings() {
  return useSyncExternalStore(
    subscribeToRiskSettings,
    readRiskSettings,
    readRiskSettings,
  );
}
