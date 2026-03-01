import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CycleSelectorProps {
  items: { id: string; name: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function CycleSelector({
  items,
  selectedIndex,
  onSelect,
  className = '',
}: CycleSelectorProps) {
  if (items.length === 0) return null;

  const current = items[selectedIndex] ?? items[0];

  const goPrev = () => {
    const next = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
    onSelect(next);
  };

  const goNext = () => {
    const next = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
    onSelect(next);
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 border border-gold/40 bg-bg-primary/60
        rounded-lg px-2 py-2.5 ${className}`}
    >
      <button
        onClick={goPrev}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded
          text-gold/70 hover:text-gold hover:bg-gold/10 transition-colors"
      >
        <ChevronLeft size={20} />
      </button>

      <span className="flex-1 text-center font-medieval text-gold text-lg truncate">
        {current.name}
      </span>

      <button
        onClick={goNext}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded
          text-gold/70 hover:text-gold hover:bg-gold/10 transition-colors"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
