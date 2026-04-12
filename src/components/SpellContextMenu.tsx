import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Wand2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SpellContextMenuProps {
  x: number;
  y: number;
  spellName: string;
  canPrepare: boolean;
  isPrepared: boolean;
  onViewInfo: () => void;
  onCast: () => void;
  onTogglePrepare?: () => void;
  onClose: () => void;
}

export const SpellContextMenu: React.FC<SpellContextMenuProps> = ({
  x, y, spellName, canPrepare, isPrepared, onViewInfo, onCast, onTogglePrepare, onClose,
}) => {
  const { t } = useTranslation('spells');
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  // Position: measure menu, clamp to viewport
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const pad = 8;
      let nx = x;
      let ny = y;
      if (nx + rect.width > window.innerWidth - pad) nx = window.innerWidth - rect.width - pad;
      if (ny + rect.height > window.innerHeight - pad) ny = window.innerHeight - rect.height - pad;
      if (nx < pad) nx = pad;
      if (ny < pad) ny = pad;
      setPos({ x: nx, y: ny });
    });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const itemClass = 'flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer w-full text-left';

  return createPortal(
    <div
      className="fixed inset-0 z-[9998]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={menuRef}
        className="fixed bg-bg-panel-solid border border-border-default rounded-lg shadow-xl overflow-hidden min-w-[180px]"
        style={pos
          ? { left: pos.x, top: pos.y }
          : { left: -9999, top: -9999, visibility: 'hidden' as const }
        }
      >
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-border-default">
          <span className="text-xs font-medieval text-gold truncate block">{spellName}</span>
        </div>

        <button className={itemClass} onClick={() => { onViewInfo(); onClose(); }}>
          <BookOpen size={14} className="text-blue-400 flex-shrink-0" />
          {t('contextMenu.info')}
        </button>

        <button className={itemClass} onClick={() => { onCast(); onClose(); }}>
          <Wand2 size={14} className="text-amber-400 flex-shrink-0" />
          {t('contextMenu.cast')}
        </button>

        {canPrepare && onTogglePrepare && (
          <>
            <div className="border-t border-border-default" />
            <button className={itemClass} onClick={() => { onTogglePrepare(); onClose(); }}>
              {isPrepared
                ? <X size={14} className="text-red-400 flex-shrink-0" />
                : <Check size={14} className="text-green-400 flex-shrink-0" />
              }
              {isPrepared ? t('contextMenu.unprepare') : t('contextMenu.prepare')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
