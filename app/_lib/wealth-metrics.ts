import type { WealthAccount, WealthAsset } from "@/app/_lib/wealth-types";

export type WealthSummaryTotals = {
  totalNetWorth: number;
  bankCash: number;
  cash: number;
  savings: number;
  stocks: number;
  crypto: number;
  realEstate: number;
  brokerCash: number;
  other: number;
  assetCount: number;
};

function sumBankBalances(accounts: WealthAccount[]) {
  return accounts
    .filter((account) => account.status !== "Archived")
    .reduce((sum, account) => sum + account.balance, 0);
}

function sumByClass(assets: WealthAsset[], classes: WealthAsset["assetClass"][]) {
  return assets
    .filter((asset) => asset.status !== "Archived")
    .filter((asset) => classes.includes(asset.assetClass))
    .reduce((sum, asset) => sum + asset.currentValue, 0);
}

export function buildWealthSummary(assets: WealthAsset[]) {
  return buildWealthSummaryWithAccounts(assets, []);
}

export function buildWealthSummaryWithAccounts(
  assets: WealthAsset[],
  bankAccounts: WealthAccount[],
) {
  const activeAssets = assets.filter((asset) => asset.status !== "Archived");
  const cash = sumByClass(activeAssets, ["Cash", "USDC"]);
  const savings = sumByClass(activeAssets, ["Bank Savings"]);
  const brokerCash = sumByClass(activeAssets, ["Broker Cash"]);
  const stocks = sumByClass(activeAssets, ["Stocks"]);
  const crypto = sumByClass(activeAssets, ["Crypto"]);
  const realEstate = sumByClass(activeAssets, ["Real Estate"]);
  const other = sumByClass(activeAssets, ["Other"]);
  const bankCash = sumBankBalances(bankAccounts);
  const totalNetWorth =
    activeAssets.reduce((sum, asset) => sum + asset.currentValue, 0) + bankCash;

  return {
    assetCount: assets.length,
    brokerCash,
    bankCash,
    cash,
    crypto,
    other,
    realEstate,
    savings,
    stocks,
    totalNetWorth,
  } satisfies WealthSummaryTotals;
}
