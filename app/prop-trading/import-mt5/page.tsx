import { ImportMt5Module } from "@/app/_components/import-mt5-module";
import { importedMt5Report } from "@/app/_lib/trading-data";

export default function PropImportMt5Page() {
  return (
    <ImportMt5Module
      defaultAccountType="prop-firm"
      eyebrow="FTMO OS"
      initialReport={importedMt5Report}
      lockAccountType
      requirePropMetadata
      title="FTMO Import MT5"
    />
  );
}
