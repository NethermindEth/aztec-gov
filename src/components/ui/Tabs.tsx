"use client";

interface Tab {
  label: string;
  count: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tab: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = tab.label === activeTab;
        return (
          <button
            key={tab.label}
            onClick={() => onChange(tab.label)}
            className="text-[14px] font-medium tracking-[0.56px] uppercase transition-colors whitespace-nowrap cursor-pointer border"
            style={{
              padding: "10px 16px",
              color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
              borderColor: isActive
                ? "var(--accent-primary)"
                : "var(--border-default)",
              backgroundColor: "var(--background-primary)",
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
