import { ImportMt5Module } from "@/app/_components/import-mt5-module";
import { importedMt5Report } from "@/app/_lib/trading-data";

export default function ImportMt5Page() {
  return <ImportMt5Module initialReport={importedMt5Report} />;
}
