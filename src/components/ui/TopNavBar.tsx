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
        <div className="flex items-center gap-8 h-14 px-4 sm:px-6">
          {/* Logo */}
          <button
            onClick={() => onLogoClick ? onLogoClick() : onTabChange(tabs[0]?.key ?? '')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          >
            <BookOpen className="text-gold" size={26} />
            <span className="font-medieval text-gold text-lg hidden sm:block">
              D&D 5e
            </span>
          </button>

          {/* Main tabs */}
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm font-medium
                    transition-colors duration-200 whitespace-nowrap cursor-pointer
                    ${isActive
                      ? 'text-gold'
                      : 'text-text-secondary hover:text-text-primary'
                    }
                  `}
                >
                  {Icon && <Icon size={16} />}
                  <span>{tab.label}</span>
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
          <div className="flex items-center h-10 px-4 sm:px-6 gap-2 overflow-x-auto">
            {subTabs.map((tab) => {
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onSubTabChange?.(tab.key)}
                  className={`
                    px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer
                    ${isActive
                      ? 'text-gold'
                      : 'text-text-muted hover:text-text-primary'
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
