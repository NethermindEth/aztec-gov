export function BetaBanner() {
  return (
    <div
      style={{
        backgroundColor: "var(--accent-primary)",
        color: "var(--background-primary)",
      }}
      className="text-center text-xs font-medium tracking-widest uppercase py-1.5"
    >
      This dashboard is in beta
    </div>
  );
}
