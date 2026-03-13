interface GoldDividerProps {
  className?: string;
}

export function GoldDivider({ className = '' }: GoldDividerProps) {
  return (
    <div className={`flex items-center gap-3 my-3 ${className}`}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="w-1.5 h-1.5 rotate-45 bg-gold/40" />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
    </div>
  );
}
