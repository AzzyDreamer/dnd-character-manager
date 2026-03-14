import type { ReactNode, FC } from 'react';
import { BookOpen } from 'lucide-react';

export interface NavTab {
  key: string;
  label: string;
  icon?: FC<{ size?: number; className?: string }>;
}

interface TopNavBarProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onLogoClick?: () => void;
  subTabs?: NavTab[];
  activeSubTab?: string;
  onSubTabChange?: (key: string) => void;
  rightContent?: ReactNode;
}

export function TopNavBar({
  tabs,
  activeTab,
  onTabChange,
  onLogoClick,
  subTabs,
  activeSubTab,
  onSubTabChange,
  rightContent,
}: TopNavBarProps) {
  return (
    <nav className="shrink-0 select-none">
      {/* Main navigation bar */}
      <div className="bg-gradient-to-b from-[#1a1a24] to-[#0f0f16] border-b border-border-default">
        <div className="flex items-center h-14 px-4 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => onLogoClick ? onLogoClick() : onTabChange(tabs[0]?.key ?? '')}
            className="flex items-center gap-2.5 mr-8 shrink-0"
          >
            <BookOpen className="text-gold" size={26} />
            <span className="font-medieval text-gold text-lg hidden sm:block">
              D&D 5e
            </span>
          </button>

          {/* Main tabs */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                    transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? 'text-gold bg-gold-muted'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                    }
                  `}
                >
                  {Icon && <Icon size={16} />}
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gold rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right content */}
          {rightContent && (
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {rightContent}
            </div>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      {subTabs && subTabs.length > 0 && (
        <div className="bg-[#0f0f16]/80 border-b border-border-default">
          <div className="flex items-center h-10 px-4 sm:px-6 gap-1 overflow-x-auto">
            {subTabs.map((tab) => {
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onSubTabChange?.(tab.key)}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded transition-all whitespace-nowrap
                    ${isActive
                      ? 'text-gold-light bg-gold-muted'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
