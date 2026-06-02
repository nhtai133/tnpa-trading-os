import type { WealthAsset } from "@/app/_lib/wealth-types";

export type WealthSummaryTotals = {
  totalNetWorth: number;
  cash: number;
  savings: number;
  stocks: number;
  crypto: number;
  realEstate: number;
  brokerCash: number;
  other: number;
  assetCount: number;
};

function sumByClass(assets: WealthAsset[], classes: WealthAsset["assetClass"][]) {
  return assets
    .filter((asset) => classes.includes(asset.assetClass))
    .reduce((sum, asset) => sum + asset.currentValue, 0);
}

export function buildWealthSummary(assets: WealthAsset[]) {
  const cash = sumByClass(assets, ["Cash", "USDC"]);
  const savings = sumByClass(assets, ["Bank Savings"]);
  const brokerCash = sumByClass(assets, ["Broker Cash"]);
  const stocks = sumByClass(assets, ["Stocks"]);
  const crypto = sumByClass(assets, ["Crypto"]);
  const realEstate = sumByClass(assets, ["Real Estate"]);
  const other = sumByClass(assets, ["Other"]);
  const totalNetWorth = assets.reduce((sum, asset) => sum + asset.currentValue, 0);

  return {
    assetCount: assets.length,
    brokerCash,
    cash,
    crypto,
    other,
    realEstate,
    savings,
    stocks,
    totalNetWorth,
  } satisfies WealthSummaryTotals;
}
