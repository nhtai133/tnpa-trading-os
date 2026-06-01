import type { Mt5AccountReport, Trade } from "@/app/_lib/trading-types";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const normalized = decodeHtml(value)
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "");

  return normalized ? Number(normalized) : 0;
}

function sectionBetween(html: string, startLabel: string, endLabel: string) {
  const start = html.indexOf(`<b>${startLabel}</b>`);
  const end = html.indexOf(`<b>${endLabel}</b>`, start);

  if (start === -1 || end === -1) {
    return "";
  }

  return html.slice(start, end);
}

function extractField(html: string, label: string) {
  const pattern = new RegExp(
    `${label}:<\\/t[dh]>\\s*<t[dh][^>]*>\\s*<b>(.*?)<\\/b>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]) : "";
}

function extractResult(html: string, label: string) {
  const pattern = new RegExp(`${label}:<\\/td>\\s*<td[^>]*>\\s*<b>(.*?)<\\/b>`, "i");
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]) : "";
}

function extractCells(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi))
    .filter((match) => !/class="hidden"/i.test(match[1]))
    .map((match) => decodeHtml(match[2]));
}

function inferSession(dateTime: string): Trade["session"] {
  const hour = Number(dateTime.slice(11, 13));

  if (hour >= 0 && hour < 8) {
    return "Asia";
  }

  if (hour >= 8 && hour < 14) {
    return "London";
  }

  return "New York";
}

function formatMt5Date(dateTime: string) {
  const [datePart, timePart] = dateTime.split(" ");
  const [year, month, day] = datePart.split(".").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return timePart ? `${formatted} ${timePart}` : formatted;
}

function toTrade(cells: string[]): Trade | null {
  if (cells.length < 13 || !/^\d{4}\.\d{2}\.\d{2}/.test(cells[0])) {
    return null;
  }

  const pnl = parseNumber(cells[12]);
  const commission = parseNumber(cells[10]);
  const riskBasis = Math.max(Math.abs(commission) * 100, Math.abs(pnl) || 1);
  const rr = pnl >= 0 ? Math.max(0.1, Math.abs(pnl) / riskBasis) : -1;

  return {
    id: `MT5-${cells[1]}`,
    symbol: cells[2],
    setup: "MT5 imported",
    setupTag: "Other",
    side: cells[3].toLowerCase() === "buy" ? "Long" : "Short",
    date: formatMt5Date(cells[8]),
    session: inferSession(cells[8]),
    entry: parseNumber(cells[5]),
    exit: parseNumber(cells[9]),
    rr: Number(rr.toFixed(2)),
    pnl,
    result: pnl >= 0 ? "Win" : "Loss",
  };
}

function parseClosedPositions(html: string) {
  const positionsHtml = sectionBetween(html, "Positions", "Orders");
  const rowMatches = Array.from(positionsHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));

  return rowMatches
    .map((match) => toTrade(extractCells(match[1])))
    .filter((trade): trade is Trade => Boolean(trade))
    .reverse();
}

export function parseMt5ReportHtml(
  html: string,
  sourceFile = "browser-upload.html",
): Mt5AccountReport {
  const trades = parseClosedPositions(html);

  if (trades.length === 0) {
    throw new Error("No closed MT5 positions were found in this HTML report.");
  }

  return {
    sourceFile,
    name: extractField(html, "Name"),
    account: extractField(html, "Account"),
    company: extractField(html, "Company"),
    generatedAt: extractField(html, "Date"),
    balance: parseNumber(extractResult(html, "Balance")),
    equity: parseNumber(extractResult(html, "Equity")),
    totalNetProfit: parseNumber(extractResult(html, "Total Net Profit")),
    grossProfit: parseNumber(extractResult(html, "Gross Profit")),
    grossLoss: parseNumber(extractResult(html, "Gross Loss")),
    profitFactor: parseNumber(extractResult(html, "Profit Factor")),
    expectedPayoff: parseNumber(extractResult(html, "Expected Payoff")),
    totalTrades: parseNumber(extractResult(html, "Total Trades")),
    shortTrades: extractResult(html, "Short Trades \\(won %\\)"),
    longTrades: extractResult(html, "Long Trades \\(won %\\)"),
    maxDrawdown: extractResult(html, "Balance Drawdown Maximal"),
    trades,
  };
}
