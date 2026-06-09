"use client";

import { useEffect } from "react";
import { runTradingDemoDataMigration } from "@/app/_lib/trading-data-migration";

export function TradingDataMigrationRunner() {
  useEffect(() => {
    runTradingDemoDataMigration();
  }, []);

  return null;
}
