import { AppShell } from "@/app/_components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell eyebrow="Workspace Controls" title="Settings">
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-lg font-semibold text-white">Journal Settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Manage account defaults, risk rules, broker connections, and reporting
          preferences for TNPA Trading OS.
        </p>
      </section>
    </AppShell>
  );
}
