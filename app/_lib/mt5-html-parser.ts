import fs from "node:fs";
import path from "node:path";
import { parseMt5ReportHtml } from "@/app/_lib/mt5-parser-core";

function findReportFile() {
  const sampleDataDir = path.join(process.cwd(), "sample-data");

  if (fs.existsSync(sampleDataDir)) {
    const report = fs
      .readdirSync(sampleDataDir)
      .filter((file) => /^ReportHistory.*\.html$/i.test(file))
      .sort()
      .at(0);

    if (report) {
      return path.join(sampleDataDir, report);
    }
  }

  const discoveredRootReport = path.join(
    process.cwd(),
    "ReportHistory-541223056.html test tnpa dashborad.html",
  );

  if (fs.existsSync(discoveredRootReport)) {
    return discoveredRootReport;
  }

  return null;
}

export function loadMt5Report() {
  const sourceFile = findReportFile();

  if (!sourceFile) {
    return null;
  }

  const fileBuffer = fs.readFileSync(sourceFile);
  const html =
    fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe
      ? fileBuffer.toString("utf16le")
      : fileBuffer.toString("utf8");

  try {
    return parseMt5ReportHtml(html, sourceFile);
  } catch {
    return null;
  }
}
