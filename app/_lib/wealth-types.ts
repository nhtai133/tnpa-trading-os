export const assetClasses = [
  "Cash",
  "Bank Savings",
  "Broker Cash",
  "Stocks",
  "Crypto",
  "Real Estate",
  "USDC",
  "Other",
] as const;

export type AssetClass = (typeof assetClasses)[number];

export const institutions = [
  "Techcombank",
  "TPBank",
  "VPBank",
  "MB Bank",
  "BIDV",
  "VCBS",
  "ACBS",
  "TCBS",
  "SSI",
  "Binance",
  "Bybit",
  "Ledger",
  "Other",
] as const;

export type Institution = (typeof institutions)[number];

export const currencies = ["USD", "VND", "USDC", "Other"] as const;

export type Currency = (typeof currencies)[number];

export type WealthAccount = {
  id: string;
  name: string;
  institution: Institution;
  currency: Currency;
  balance: number;
  notes?: string;
};

export type WealthAsset = {
  id: string;
  name: string;
  assetClass: AssetClass;
  institution: Institution;
  currency: Currency;
  currentValue: number;
  costBasis?: number;
  accountId?: string;
  notes?: string;
};
