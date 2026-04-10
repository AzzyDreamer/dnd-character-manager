import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Dices, ChevronUp, ChevronDown, X } from 'lucide-react';
import { rollDice, rollWithAdvantage, parseDiceExpression } from '../utils/diceRoller';
import type { DiceRollResult, AdvantageRollResult } from '../utils/diceRoller';

// ─── Context ───

export interface GUIRollEntry {
  id: number;
  expression: string;
  result: DiceRollResult;
  timestamp: number;
}

export interface ConsoleEntry {
  id: number;
  type: 'input' | 'result' | 'error' | 'help';
  text: string;
  label?: string;
  breakdown?: string;
  total?: number | string;
}

interface DiceRollContextType {
  /** Quick roll (left-click) — pass event to get origin for animation, returns result */
  roll: (expression: string, originEvent?: React.MouseEvent) => DiceRollResult | undefined;
  /** Open config menu (right-click), optional onResult callback for getting the rolled value */
  openConfig: (expression: string, anchorRect: DOMRect, onResult?: (total: number) => void) => void;
  /** Persistent GUI history */
  guiHistory: GUIRollEntry[];
  setGuiHistory: React.Dispatch<React.SetStateAction<GUIRollEntry[]>>;
  /** Persistent console entries */
  consoleEntries: ConsoleEntry[];
  setConsoleEntries: React.Dispatch<React.SetStateAction<ConsoleEntry[]>>;
  /** Persistent console input history */
  consoleInputHistory: string[];
  setConsoleInputHistory: React.Dispatch<React.SetStateAction<string[]>>;
}

const DiceRollContext = createContext<DiceRollContextType>({
  roll: () => undefined,
  openConfig: () => {},
  guiHistory: [],
  setGuiHistory: () => {},
  consoleEntries: [],
  setConsoleEntries: () => {},
  consoleInputHistory: [],
  setConsoleInputHistory: () => {},
});

export const useDiceRoll = () => useContext(DiceRollContext);
export { DiceRollContext };

// ─── Roll result types for toast ───

type ToastData =
  | { type: 'simple'; result: DiceRollResult }
  | { type: 'advantage'; result: AdvantageRollResult };

// ─── Provider ───

export const DiceRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [hiding, setHiding] = useState(false);
  const [rolling, setRolling] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideAnimTimer = useRef<ReturnType<typeof setTimeout>>();

  // Config menu state
  const [configExpr, setConfigExpr] = useState<string | null>(null);
  const [configAnchor, setConfigAnchor] = useState<DOMRect | null>(null);
  const configOnResultRef = useRef<((total: number) => void) | null>(null);

  // Persistent dice tab state (survives tab switches)
  const [guiHistory, setGuiHistory] = useState<GUIRollEntry[]>([]);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [consoleInputHistory, setConsoleInputHistory] = useState<string[]>([]);

  const showToast = useCallback((data: ToastData) => {
    clearTimeout(hideTimer.current);
    clearTimeout(hideAnimTimer.current);
    setHiding(false);
    setRolling(true);
    setToast(data);

    // Rolling phase: 1600ms, then reveal result
    setTimeout(() => {
      setRolling(false);
      // Auto-hide after 3s from reveal
      hideTimer.current = setTimeout(() => {
        setHiding(true);
        hideAnimTimer.current = setTimeout(() => {
          setToast(null);
          setHiding(false);
        }, 200);
      }, 3000);
    }, 800);
  }, []);

  const roll = useCallback((expression: string, _originEvent?: React.MouseEvent): DiceRollResult | undefined => {
    const result = rollDice(expression);
    if (result.rolls.length === 0) return undefined;
    showToast({ type: 'simple', result });
    return result;
  }, [showToast]);

  const openConfig = useCallback((expression: string, anchorRect: DOMRect, onResult?: (total: number) => void) => {
    setConfigExpr(expression);
    setConfigAnchor(anchorRect);
    configOnResultRef.current = onResult ?? null;
  }, []);

  const closeConfig = useCallback(() => {
    setConfigExpr(null);
    setConfigAnchor(null);
    configOnResultRef.current = null;
  }, []);

  const handleConfigRoll = useCallback((data: ToastData) => {
    showToast(data);
    const total = data.type === 'simple' ? data.result.total : data.result.chosen.total;
    configOnResultRef.current?.(total);
    closeConfig();
  }, [showToast, closeConfig]);

  return (
    <DiceRollContext.Provider value={{ roll, openConfig, guiHistory, setGuiHistory, consoleEntries, setConsoleEntries, consoleInputHistory, setConsoleInputHistory }}>
      {children}
      {toast && createPortal(
        <DiceRollToast data={toast} hiding={hiding} rolling={rolling} />,
        document.body
      )}
      {configExpr && configAnchor && createPortal(
        <DiceConfigMenu
          expression={configExpr}
          anchor={configAnchor}
          onRoll={handleConfigRoll}
          onClose={closeConfig}
        />,
        document.body
      )}
    </DiceRollContext.Provider>
  );
};

// ─── Dice face SVG shapes ───

const DICE_SHAPES: Record<number, React.FC<{ className?: string }>> = {
  // d4 — equilateral triangle
  4: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12,1 23,22 1,22" />
    </svg>
  ),
  // d6 — square
  6: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="1.5" />
    </svg>
  ),
  // d8 — tall diamond (rhombus)
  8: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12,1 23,12 12,23 1,12" />
    </svg>
  ),
  // d10 — kite, pointed top, wide middle, flat bottom
  10: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12,1 22,9 19,21 5,21 2,9" />
    </svg>
  ),
  // d12 — regular pentagon
  12: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12,1 23,9 19,23 5,23 1,9" />
    </svg>
  ),
  // d20 — hexagon
  20: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12,1 22.5,6.5 22.5,17.5 12,23 1.5,17.5 1.5,6.5" />
    </svg>
  ),
  // d100 — two d10 kites side by side
  100: ({ className }) => (
    <svg viewBox="0 0 32 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="8,1 15,9 13,20 3,20 1,9" />
      <polygon points="24,1 31,9 29,20 19,20 17,9" />
    </svg>
  ),
};

function getDiceShape(sides: number) {
  return DICE_SHAPES[sides] || DICE_SHAPES[6];
}

// ─── Spinning dice chip (shows random numbers then settles) ───

const SpinningDiceChip: React.FC<{ finalValue: number; sides: number; delay: number }> = ({ finalValue, sides, delay }) => {
  const [display, setDisplay] = useState(Math.floor(Math.random() * sides) + 1);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Schedule ticks with increasing intervals (slowing down effect)
    const intervals = [80, 80, 90, 100, 110, 130, 150, 170, 200, 230, 260, 300];
    let elapsed = delay;

    for (let i = 0; i < intervals.length; i++) {
      elapsed += intervals[i];
      const t = setTimeout(() => {
        if (!cancelled) setDisplay(Math.floor(Math.random() * sides) + 1);
      }, elapsed);
      timeouts.push(t);
    }

    // Final settle
    const settleTimeout = setTimeout(() => {
      if (!cancelled) {
        setDisplay(finalValue);
        setSettled(true);
      }
    }, elapsed + 150);
    timeouts.push(settleTimeout);

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [finalValue, sides, delay]);

  const Shape = getDiceShape(sides);

  return (
    <div className={`dice-spin-chip ${settled ? 'settled' : 'spinning'}`}>
      <Shape className="dice-spin-shape" />
      <span className="dice-spin-value">{display}</span>
    </div>
  );
};

// ─── Toast Component ───

const DiceRollToast: React.FC<{ data: ToastData; hiding: boolean; rolling: boolean }> = ({ data, hiding, rolling }) => {
  const { t } = useTranslation('combat');
  // Detect sides from expression
  const getSides = (expr: string) => {
    const m = expr.match(/d(\d+)/);
    return m ? parseInt(m[1], 10) : 6;
  };

  if (data.type === 'simple') {
    const { result } = data;
    const sides = getSides(result.expression);

    return (
      <div className={`dice-toast ${hiding ? 'hiding' : ''}`}>
        <div className="text-xs text-text-muted mb-1.5 font-medium">{result.expression}</div>
        <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
          {result.rolls.map((r, i) => (
            rolling
              ? <SpinningDiceChip key={i} finalValue={r} sides={sides} delay={i * 80} />
              : <span key={i} className="dice-chip">{r}</span>
          ))}
          {!rolling && result.modifier !== 0 && (
            <span className="text-sm font-semibold text-text-secondary">
              {result.modifier > 0 ? `+${result.modifier}` : result.modifier}
            </span>
          )}
        </div>
        {!rolling ? (
          <div className="text-2xl font-bold text-gold font-medieval dice-total-reveal">{result.total}</div>
        ) : (
          <div className="text-lg text-text-muted/50 font-medieval">...</div>
        )}
      </div>
    );
  }

  // Advantage/disadvantage
  const { result } = data;
  const isAdv = result.mode === 'advantage';
  const label = isAdv ? t('diceRoll.advantage') : t('diceRoll.disadvantage');
  const labelColor = isAdv ? 'text-green-400' : 'text-red-400';
  const sides = getSides(result.chosen.expression);

  return (
    <div className={`dice-toast ${hiding ? 'hiding' : ''}`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
        <span className="text-xs text-text-muted">{result.chosen.expression}</span>
      </div>
      {rolling ? (
        <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
          {result.chosen.rolls.map((r, i) => (
            <SpinningDiceChip key={i} finalValue={r} sides={sides} delay={i * 80} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-3 justify-center mb-1.5">
            <RollColumn result={result.roll1} isChosen={result.chosen === result.roll1} />
            <div className="w-px bg-border-default self-stretch" />
            <RollColumn result={result.roll2} isChosen={result.chosen === result.roll2} />
          </div>
          <div className="text-2xl font-bold text-gold font-medieval dice-total-reveal">{result.chosen.total}</div>
        </>
      )}
      {rolling && <div className="text-lg text-text-muted/50 font-medieval">...</div>}
    </div>
  );
};

const RollColumn: React.FC<{ result: DiceRollResult; isChosen: boolean }> = ({ result, isChosen }) => (
  <div className={`flex flex-col items-center gap-0.5 ${isChosen ? 'opacity-100' : 'opacity-35'}`}>
    <div className="flex items-center gap-0.5 flex-wrap justify-center">
      {result.rolls.map((r, i) => (
        <span key={i} className="dice-chip dice-chip-sm">{r}</span>
      ))}
    </div>
    {result.modifier !== 0 && (
      <span className="text-[10px] text-text-muted">
        {result.modifier > 0 ? `+${result.modifier}` : result.modifier}
      </span>
    )}
    <span className={`text-sm font-bold ${isChosen ? 'text-gold' : 'text-text-muted'}`}>
      {result.total}
    </span>
  </div>
);

// ─── Config Menu (Right-click) ───

const DiceConfigMenu: React.FC<{
  expression: string;
  anchor: DOMRect;
  onRoll: (data: ToastData) => void;
  onClose: () => void;
}> = ({ expression, anchor, onRoll, onClose }) => {
  const { t } = useTranslation('combat');
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [bonus, setBonus] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position: start offscreen, measure, then place correctly
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Wait for menu to render so we can measure it
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const pad = 12;
      const menuW = rect.width;
      const menuH = rect.height;

      // Horizontal: center on anchor, clamp to viewport
      let nx = anchor.left + anchor.width / 2 - menuW / 2;
      if (nx < pad) nx = pad;
      if (nx + menuW > window.innerWidth - pad) nx = window.innerWidth - menuW - pad;

      // Vertical: prefer above anchor, fall back to below, clamp to viewport
      let ny = anchor.top - menuH - 8;
      if (ny < pad) {
        ny = anchor.bottom + 8;
      }
      if (ny + menuH > window.innerHeight - pad) {
        ny = window.innerHeight - menuH - pad;
      }

      setPos({ x: nx, y: ny });
    });
  }, [anchor]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
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

  const parsed = parseDiceExpression(expression);

  const doRoll = () => {
    if (!parsed) return;

    if (mode === 'normal') {
      const result = rollDice(expression, bonus, multiplier);
      onRoll({ type: 'simple', result });
    } else {
      const result = rollWithAdvantage(expression, mode, bonus);
      onRoll({ type: 'advantage', result });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998]"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={menuRef}
        className="dice-config-menu"
        style={pos
          ? { left: pos.x, top: pos.y }
          : { left: -9999, top: -9999, visibility: 'hidden' as const }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Dices size={16} className="text-gold" />
            <span className="text-sm font-medieval text-gold">{expression}</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Mode */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{t('diceRoll.modeLabel')}</div>
          <div className="grid grid-cols-3 gap-1">
            {([
              ['normal', t('diceRoll.modeNormal'), ''],
              ['advantage', t('diceRoll.modeAdvantage'), 'green'],
              ['disadvantage', t('diceRoll.modeDisadvantage'), 'red'],
            ] as const).map(([m, label, color]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-1 py-1.5 rounded text-xs font-medium transition-all ${
                  mode === m
                    ? color === 'green' ? 'bg-green-900/50 text-green-400 border border-green-500/40'
                    : color === 'red' ? 'bg-red-900/50 text-red-400 border border-red-500/40'
                    : 'bg-gold/20 text-gold border border-gold/40'
                    : 'bg-bg-secondary text-text-muted border border-border-default hover:bg-bg-tertiary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bonus & Multiplier row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{t('diceRoll.bonusLabel')}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBonus(b => b - 1)}
                className="w-7 h-7 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
              >
                <ChevronDown size={14} />
              </button>
              <input
                type="number"
                value={bonus}
                onChange={(e) => setBonus(parseInt(e.target.value) || 0)}
                className={`w-10 h-7 text-center text-sm font-bold rounded bg-bg-secondary border border-border-default outline-none focus:border-gold/50 ${bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-text-secondary'}`}
              />
              <button
                onClick={() => setBonus(b => b + 1)}
                className="w-7 h-7 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{t('diceRoll.multiplierLabel')}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMultiplier(m => Math.max(1, m - 1))}
                className="w-7 h-7 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
              >
                <ChevronDown size={14} />
              </button>
              <input
                type="number"
                value={multiplier}
                min={1}
                onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-10 h-7 text-center text-sm font-bold rounded bg-bg-secondary border border-border-default text-gold outline-none focus:border-gold/50"
              />
              <button
                onClick={() => setMultiplier(m => m + 1)}
                className="w-7 h-7 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {parsed && (
          <div className="text-xs text-text-muted text-center mb-2">
            {parsed.count * multiplier}d{parsed.sides}
            {(parsed.modifier + bonus) !== 0 && (
              <>{(parsed.modifier + bonus) > 0 ? '+' : ''}{parsed.modifier + bonus}</>
            )}
            {mode !== 'normal' && (
              <span className={mode === 'advantage' ? 'text-green-400' : 'text-red-400'}>
                {' '}({mode === 'advantage' ? t('diceRoll.advantageShort') : t('diceRoll.disadvantageShort')})
              </span>
            )}
          </div>
        )}

        {/* Roll button */}
        <button
          onClick={doRoll}
          disabled={!parsed}
          className="w-full py-2 rounded-lg bg-gold/20 text-gold border border-gold/40 font-medium text-sm hover:bg-gold/30 transition-all gold-glow disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Dices size={16} />
          {t('diceRoll.rollButton')}
        </button>
      </div>
    </div>
  );
};

// ─── Reusable clickable attack bonus component (rolls 1d20+bonus) ───

export const ClickableAttackBonus: React.FC<{
  bonus: number;
  className?: string;
}> = ({ bonus, className = 'text-green-400 font-bold' }) => {
  const { roll, openConfig } = useDiceRoll();
  const expression = `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
  const label = bonus >= 0 ? `+${bonus}` : `${bonus}`;

  return (
    <span
      className={`${className} tag-rollable tag-rollable-attack`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        roll(expression, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        openConfig(expression, rect);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          roll(expression);
        }
      }}
    >
      <Dices size={12} className="inline-block mr-1 opacity-40 group-hover:opacity-70" />
      {label}
    </span>
  );
};

// ─── Reusable clickable damage component for weapon attacks ───

export const ClickableDamage: React.FC<{
  damage: string;
  className?: string;
}> = ({ damage, className = 'text-text-secondary' }) => {
  const { roll, openConfig } = useDiceRoll();
  const hasDice = /\d+d\d+/.test(damage);

  if (!hasDice) {
    return <span className={className}>{damage}</span>;
  }

  return (
    <span
      className={`${className} tag-rollable tag-rollable-weapon`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        roll(damage, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        openConfig(damage, rect);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          roll(damage);
        }
      }}
    >
      <Dices size={12} className="inline-block mr-1 opacity-40 group-hover:opacity-70" />
      {damage}
    </span>
  );
};
