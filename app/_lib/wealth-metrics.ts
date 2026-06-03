import type {
  WealthAccount,
  WealthAsset,
  WealthBrokerAccount,
} from "@/app/_lib/wealth-types";

export type WealthSummaryTotals = {
  totalNetWorth: number;
  bankCash: number;
  brokerCash: number;
  brokerEquity: number;
  cash: number;
  savings: number;
  stocks: number;
  crypto: number;
  realEstate: number;
  other: number;
  assetCount: number;
  brokerAccountCount: number;
};

function sumBankBalances(accounts: WealthAccount[]) {
  return accounts
    .filter((account) => account.status !== "Archived")
    .reduce((sum, account) => sum + account.balance, 0);
}

function sumBrokerBalances(accounts: WealthBrokerAccount[]) {
  return accounts.filter((account) => account.status !== "Archived");
}

function sumByClass(assets: WealthAsset[], classes: WealthAsset["assetClass"][]) {
  return assets
    .filter((asset) => asset.status !== "Archived")
    .filter((asset) => classes.includes(asset.assetClass))
    .reduce((sum, asset) => sum + asset.currentValue, 0);
}

export function buildWealthSummary(assets: WealthAsset[]) {
  return buildWealthSummaryWithAccounts(assets, [], []);
}

export function buildWealthSummaryWithAccounts(
  assets: WealthAsset[],
  bankAccounts: WealthAccount[],
  brokerAccounts: WealthBrokerAccount[] = [],
) {
  const activeAssets = assets.filter((asset) => asset.status !== "Archived");
  const activeBrokerAccounts = sumBrokerBalances(brokerAccounts);
  const cash = sumByClass(activeAssets, ["Cash", "USDC"]);
  const savings = sumByClass(activeAssets, ["Bank Savings"]);
  const brokerCash = sumByClass(activeAssets, ["Broker Cash"]);
  const stocks =
    sumByClass(activeAssets, ["Stocks", "ETF", "Mutual Fund"]) +
    activeBrokerAccounts.reduce(
      (sum, account) => sum + account.stockMarketValue + account.fundEtfValue,
      0,
    );
  const crypto = sumByClass(activeAssets, ["Crypto"]);
  const realEstate = sumByClass(activeAssets, ["Real Estate"]);
  const other = sumByClass(activeAssets, ["Loan", "Vehicle", "Other"]);
  const bankCash = sumBankBalances(bankAccounts);
  const brokerEquity = activeBrokerAccounts.reduce(
    (sum, account) => sum + account.totalEquity,
    0,
  );
  const totalNetWorth =
    activeAssets.reduce((sum, asset) => sum + asset.currentValue, 0) +
    bankCash +
    brokerEquity;

  return {
    assetCount: activeAssets.length,
    brokerCash,
    brokerAccountCount: activeBrokerAccounts.length,
    brokerEquity,
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
