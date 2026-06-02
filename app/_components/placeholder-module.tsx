import { AppShell } from "@/app/_components/app-shell";

export function PlaceholderModule({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <AppShell eyebrow={eyebrow} title={title}>
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-6 shadow-2xl shadow-black/20">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Placeholder
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>
        </div>
      </section>
    </AppShell>
  );
}
