import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface SpellTooltipProps {
  name: string;
  level: number;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description?: string;
  children: ReactNode;
}

export function SpellTooltip({
  name,
  level,
  school,
  castingTime,
  range,
  components,
  duration,
  description,
  children,
}: SpellTooltipProps) {
  const { t } = useTranslation('spells');
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !triggerRef.current || !tooltipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    let x = rect.left + rect.width / 2 - tip.width / 2;
    let y = rect.top - tip.height - 8;
    if (y < 8) y = rect.bottom + 8;
    if (x < 8) x = 8;
    if (x + tip.width > window.innerWidth - 8) x = window.innerWidth - tip.width - 8;
    setPos({ x, y });
  }, [show]);

  const schoolName = school ? t(`tooltip.schoolNames.${school}`, school) : '';
  const levelText = level === 0 ? t('common.cantrip') : t('common.level', { level });

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      className="inline-block"
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          style={{ left: pos.x, top: pos.y }}
          className="fixed z-[100] min-w-[220px] max-w-[320px] rounded-lg border border-gold/40
            bg-bg-panel-solid shadow-2xl shadow-black/60 p-3 pointer-events-none"
        >
          <div className="font-semibold text-gold text-sm">{name}</div>
          <div className="text-xs text-text-muted mt-0.5">
            {levelText}{schoolName && ` \u2022 ${schoolName}`}
          </div>

          {(castingTime || range || components || duration) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs border-t border-border-default pt-2">
              {castingTime && (
                <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{castingTime}</span></div>
              )}
              {range && (
                <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{range}</span></div>
              )}
              {components && (
                <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{components}</span></div>
              )}
              {duration && (
                <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{duration}</span></div>
              )}
            </div>
          )}

          {description && (
            <div className="mt-2 pt-2 border-t border-border-default text-xs text-text-secondary leading-relaxed line-clamp-4">
              {description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
