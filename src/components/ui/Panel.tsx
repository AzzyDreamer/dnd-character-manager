import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'ornate' | 'inset';
  title?: string;
  titleIcon?: ReactNode;
}

export function Panel({
  children,
  className = '',
  variant = 'default',
  title,
  titleIcon,
}: PanelProps) {
  const variantClasses = {
    default: 'glass-panel',
    ornate: 'glass-panel ornate-border',
    inset: 'bg-bg-primary/60 border border-border-default rounded-lg',
  };

  return (
    <div className={`${variantClasses[variant]} p-4 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-default">
          {titleIcon}
          <h3 className="font-medieval text-gold text-sm">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}
