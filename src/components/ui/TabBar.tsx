import type { FC } from 'react';

export interface Tab {
  key: string;
  label: string;
  icon?: FC<{ size?: number; className?: string }>;
  disabled?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
  size = 'md',
}: TabBarProps) {
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2',
  };

  return (
    <div className="flex items-center gap-0.5 border-b border-border-default overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && onTabChange(tab.key)}
            disabled={tab.disabled}
            className={`
              relative flex items-center ${sizeClasses[size]} font-medium
              transition-all duration-200 whitespace-nowrap border-b-2 -mb-px
              ${isActive
                ? 'text-gold border-gold'
                : tab.disabled
                  ? 'text-text-muted border-transparent cursor-not-allowed opacity-50'
                  : 'text-text-secondary hover:text-text-primary border-transparent hover:border-gold/30'
              }
            `}
          >
            {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
