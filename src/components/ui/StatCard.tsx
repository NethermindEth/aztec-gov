interface StatCardProps {
  label: string;
  value: string;
  accentValue?: boolean;
}

export function StatCard({ label, value, accentValue }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-2 md:gap-3 p-3 md:p-5"
      style={{ backgroundColor: "var(--background-subtle)" }}
    >
      <span
        className="text-xs font-medium tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[20px] md:text-[30px] leading-none font-light font-display"
        style={{
          color: accentValue ? "var(--accent-primary)" : "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
