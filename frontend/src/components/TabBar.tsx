import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div
      className="flex flex-wrap p-1 gap-1"
      style={{
        backgroundColor: 'var(--surface-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        maxWidth: 'fit-content',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all duration-150"
            style={{
              borderRadius: 'calc(var(--radius-md) - 4px)',
              backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
              color: isActive ? 'var(--accent-primary-fg)' : 'var(--text-secondary)',
              boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
              minHeight: '36px',
            }}
          >
            {tab.icon && (
              <tab.icon
                className={`h-3.5 w-3.5 ${isActive ? 'text-[var(--accent-primary-fg)]' : 'text-[var(--text-tertiary)]'}`}
              />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
