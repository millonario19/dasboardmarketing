export function KpiCard({
  label,
  value,
  suffix,
  sublabel,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sublabel?: string;
}) {
  return (
    <div className="bg-surface border border-gridline rounded-lg p-5 flex-1 min-w-[160px]">
      <p className="text-sm text-ink-secondary mb-1">{label}</p>
      <p className="text-3xl font-semibold tabular-nums text-ink-primary">
        {value}
        {suffix && <span className="text-lg text-ink-secondary ml-1">{suffix}</span>}
      </p>
      {sublabel && <p className="text-xs text-ink-muted mt-1">{sublabel}</p>}
    </div>
  );
}
