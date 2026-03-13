interface StatBadgeProps {
  label: string;
  value: number;
  modifier?: number;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
  variant?: 'rect' | 'circle';
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function StatBadge({
  label,
  value,
  modifier,
  size = 'md',
  highlight = false,
  variant = 'rect',
}: StatBadgeProps) {
  if (variant === 'circle') {
    const circleSizes = {
      sm: 'w-12 h-12',
      md: 'w-16 h-16',
      lg: 'w-20 h-20',
    };
    const circleValueSizes = {
      sm: 'text-sm',
      md: 'text-lg',
      lg: 'text-2xl',
    };

    return (
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`
            ${circleSizes[size]} rounded-full border-2 flex flex-col items-center justify-center
            transition-all
            ${highlight
              ? 'border-gold/60 bg-gold-muted gold-glow'
              : 'border-gold/30 bg-bg-panel-solid hover:border-gold/50'
            }
          `}
        >
          <span className={`${circleValueSizes[size]} font-bold text-text-primary leading-none`}>
            {value}
          </span>
          {modifier !== undefined && (
            <span className={`text-[10px] leading-none mt-0.5 ${modifier >= 0 ? 'text-gold' : 'text-red-bright'}`}>
              {formatModifier(modifier)}
            </span>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
          {label}
        </span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'w-14 h-16',
    md: 'w-18 h-20',
    lg: 'w-22 h-24',
  };

  const valueSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]} flex flex-col items-center justify-center
        rounded-lg border transition-all
        ${highlight
          ? 'border-gold/60 bg-gold-muted gold-glow'
          : 'border-border-default bg-bg-panel hover:border-border-hover'
        }
      `}
    >
      <span className="text-[9px] uppercase tracking-wider text-text-muted font-medium leading-none mb-1">
        {label}
      </span>
      <span className={`${valueSizes[size]} font-bold text-text-primary leading-none`}>
        {value}
      </span>
      {modifier !== undefined && (
        <span className={`text-xs leading-none mt-0.5 ${modifier >= 0 ? 'text-gold' : 'text-red-bright'}`}>
          {formatModifier(modifier)}
        </span>
      )}
    </div>
  );
}
