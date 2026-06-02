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
  "Vietcombank",
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

export const archiveReasons = [
  "Closed Account",
  "Failed Challenge",
  "Merged Portfolio",
  "No Longer Used",
  "Other",
] as const;

export type ArchiveReason = (typeof archiveReasons)[number];

export type WealthStatus = "Active" | "Archived";

export const brokerInstitutions = [
  "VCBS",
  "ACBS",
  "TCBS",
  "SSI",
  "VPS",
  "MBS",
  "VNDIRECT",
  "Other",
] as const;

export type BrokerInstitution = (typeof brokerInstitutions)[number];

export const portfolioTypes = [
  "Long-Term Stock Portfolio",
  "Stock Swing Portfolio",
  "Retirement Stock Portfolio 5%",
  "3-5Y Stocks + Bitcoin + Real Estate Portfolio",
  "Other",
] as const;

export type PortfolioType = (typeof portfolioTypes)[number];

export type WealthAccount = {
  id: string;
  name: string;
  institution: Institution;
  currency: Currency;
  balance: number;
  status: WealthStatus;
  archiveReason?: ArchiveReason;
  archivedAt?: string;
  accountType?: "Bank" | "Broker" | "Savings";
  notes?: string;
};

export type WealthAsset = {
  id: string;
  name: string;
  assetClass: AssetClass;
  institution: Institution;
  currency: Currency;
  currentValue: number;
  status: WealthStatus;
  archiveReason?: ArchiveReason;
  archivedAt?: string;
  costBasis?: number;
  accountId?: string;
  notes?: string;
};

export type WealthBrokerAccount = {
  id: string;
  broker: BrokerInstitution;
  name: string;
  currency: Currency;
  cashBalance: number;
  stockMarketValue: number;
  fundEtfValue: number;
  totalEquity: number;
  portfolioType: PortfolioType;
  status: WealthStatus;
  archiveReason?: ArchiveReason;
  archivedAt?: string;
  notes?: string;
};
