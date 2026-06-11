import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, X } from 'lucide-react';

export interface PickOption {
  value: string;
  label: string;
  iconUrl?: string;
}

interface PickOptionsModalProps {
  title: string;
  subtitle?: string;
  options: PickOption[];
  count: number;
  onConfirm: (values: string[]) => void;
  /** Если не задан — выбор обязателен (крестик и фон не закрывают окно) */
  onCancel?: () => void;
}

/**
 * Универсальный модал «выберите N из списка» — устойчивости от подклассов
 * (Elemental Affinity, Storm Soul…), спасброски/штрафы от даров трансформаций.
 */
export function PickOptionsModal({ title, subtitle, options, count, onConfirm, onCancel }: PickOptionsModalProps) {
  const { t } = useTranslation('character');
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (value: string) => {
    setSelected(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      if (prev.length >= count) return count === 1 ? [value] : prev;
      return [...prev, value];
    });
  };

  const canConfirm = selected.length === count;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gold/30 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medieval text-gold flex items-center gap-2">
              <Sparkles size={18} className="text-gold" />
              {title}
            </h2>
            {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-1.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="p-5 grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
          {options.map(opt => {
            const isSelected = selected.includes(opt.value);
            const isFull = !isSelected && selected.length >= count && count > 1;
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                disabled={isFull}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                  isSelected
                    ? 'border-gold bg-gold/15 text-gold'
                    : isFull
                      ? 'border-border-default/40 text-text-muted/50 cursor-not-allowed'
                      : 'border-border-default text-text-secondary hover:border-gold/50 hover:text-text-primary'
                }`}
              >
                {opt.iconUrl && (
                  <img src={opt.iconUrl} alt="" className="w-6 h-6 object-contain shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && <Check size={14} className="text-gold shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-gold/30 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {selected.length} / {count}
          </span>
          <button
            onClick={() => canConfirm && onConfirm(selected)}
            disabled={!canConfirm}
            className="px-6 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval
              hover:bg-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('pickOptions.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
