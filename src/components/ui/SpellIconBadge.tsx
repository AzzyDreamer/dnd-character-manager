const SCHOOL_COLORS: Record<string, string> = {
  A: 'border-blue-400/60',       // Abjuration
  C: 'border-yellow-400/60',     // Conjuration
  D: 'border-cyan-400/60',       // Divination
  E: 'border-pink-400/60',       // Enchantment
  V: 'border-red-400/60',        // Evocation
  I: 'border-purple-400/60',     // Illusion
  N: 'border-green-400/60',      // Necromancy
  T: 'border-orange-400/60',     // Transmutation
};

const SCHOOL_BG: Record<string, string> = {
  A: 'bg-blue-900/30',
  C: 'bg-yellow-900/30',
  D: 'bg-cyan-900/30',
  E: 'bg-pink-900/30',
  V: 'bg-red-900/30',
  I: 'bg-purple-900/30',
  N: 'bg-green-900/30',
  T: 'bg-orange-900/30',
};

interface SpellIconBadgeProps {
  name: string;
  school: string;
  level: number;
  imageSrc?: string;
  prepared?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SpellIconBadge({
  name,
  school,
  level,
  imageSrc,
  prepared,
  selected,
  onClick,
  className = '',
}: SpellIconBadgeProps) {
  const borderColor = SCHOOL_COLORS[school] ?? 'border-border-default';
  const bgColor = SCHOOL_BG[school] ?? 'bg-bg-panel';
  const initial = name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      title={name}
      className={`
        relative w-10 h-10 rounded-md border-2 flex items-center justify-center
        overflow-hidden transition-all shrink-0 cursor-pointer
        ${borderColor}
        ${!imageSrc ? bgColor : ''}
        ${selected ? 'ring-2 ring-gold/60 scale-110' : ''}
        ${prepared === false ? 'opacity-40' : ''}
        hover:brightness-125 hover:scale-105
        ${className}
      `}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span className="text-sm font-bold text-text-primary/80">{initial}</span>
      )}
      {level > 0 && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold
          bg-bg-panel-solid border border-border-default rounded-full w-3.5 h-3.5
          flex items-center justify-center text-text-muted leading-none z-10">
          {level}
        </span>
      )}
      {prepared && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-bright z-10" />
      )}
    </button>
  );
}
