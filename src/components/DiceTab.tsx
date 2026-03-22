import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dices, Send, Trash2, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';
import { rollDice, evalConsoleExpression } from '../utils/diceRoller';
import type { DiceRollResult } from '../utils/diceRoller';
import { useDiceRoll } from './DiceRollProvider';
import type { GUIRollEntry, ConsoleEntry } from './DiceRollProvider';

// ─── GUI Dice Roller ───

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

const DICE_COLORS: Record<number, string> = {
  4:   'from-emerald-700 to-emerald-900 border-emerald-500/40',
  6:   'from-blue-700 to-blue-900 border-blue-500/40',
  8:   'from-violet-700 to-violet-900 border-violet-500/40',
  10:  'from-amber-700 to-amber-900 border-amber-500/40',
  12:  'from-rose-700 to-rose-900 border-rose-500/40',
  20:  'from-gold-dark to-yellow-900 border-gold/40',
  100: 'from-gray-600 to-gray-800 border-gray-500/40',
};

const DiceButton: React.FC<{
  sides: number;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRoll: () => void;
}> = ({ sides, count, onIncrement, onDecrement, onRoll }) => {
  const colors = DICE_COLORS[sides] || 'from-gray-700 to-gray-900 border-gray-500/40';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onIncrement}
        className="w-6 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onRoll}
        disabled={count === 0}
        className={`dice-gui-btn bg-gradient-to-b ${colors} border rounded-lg w-14 h-14 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100`}
      >
        <span className="text-lg font-bold text-white leading-none">d{sides}</span>
        {count > 0 && (
          <span className="text-[10px] text-white/70 font-medium">{count}d{sides}</span>
        )}
      </button>
      <button
        onClick={onDecrement}
        disabled={count === 0}
        className="w-6 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
};

const GUIRoller: React.FC = () => {
  const { guiHistory, setGuiHistory } = useDiceRoll();
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(DICE_TYPES.map(d => [d, 0]))
  );
  const [modifier, setModifier] = useState(0);
  const nextId = useRef(guiHistory.length > 0 ? Math.max(...guiHistory.map(e => e.id)) + 1 : 0);

  const addEntry = useCallback((entry: GUIRollEntry) => {
    setGuiHistory(prev => [entry, ...prev].slice(0, 50));
  }, [setGuiHistory]);

  const setCount = (sides: number, delta: number) => {
    setCounts(prev => ({ ...prev, [sides]: Math.max(0, (prev[sides] || 0) + delta) }));
  };

  const rollAll = () => {
    const parts: string[] = [];
    const allRolls: number[] = [];

    for (const sides of DICE_TYPES) {
      const c = counts[sides] || 0;
      if (c > 0) {
        parts.push(`${c}d${sides}`);
        for (let i = 0; i < c; i++) {
          allRolls.push(Math.floor(Math.random() * sides) + 1);
        }
      }
    }

    if (parts.length === 0) return;

    const expr = modifier !== 0
      ? `${parts.join(' + ')}${modifier > 0 ? ' + ' + modifier : ' - ' + Math.abs(modifier)}`
      : parts.join(' + ');

    const diceSum = allRolls.reduce((a, b) => a + b, 0);
    const total = diceSum + modifier;

    addEntry({
      id: nextId.current++,
      expression: expr,
      result: { expression: expr, rolls: allRolls, modifier, total },
      timestamp: Date.now(),
    });
  };

  const rollSingle = (sides: number) => {
    const c = counts[sides] || 1;
    const expr = modifier !== 0
      ? `${c}d${sides}${modifier > 0 ? '+' + modifier : modifier}`
      : `${c}d${sides}`;
    const result = rollDice(`${c}d${sides}`, modifier);
    addEntry({
      id: nextId.current++,
      expression: expr,
      result,
      timestamp: Date.now(),
    });
  };

  const clearCounts = () => {
    setCounts(Object.fromEntries(DICE_TYPES.map(d => [d, 0])));
    setModifier(0);
  };

  const hasAny = DICE_TYPES.some(d => (counts[d] || 0) > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Dice buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {DICE_TYPES.map(sides => (
          <DiceButton
            key={sides}
            sides={sides}
            count={counts[sides] || 0}
            onIncrement={() => setCount(sides, 1)}
            onDecrement={() => setCount(sides, -1)}
            onRoll={() => rollSingle(sides)}
          />
        ))}
      </div>

      {/* Modifier + Roll All */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Бонус:</span>
          <button
            onClick={() => setModifier(m => m - 1)}
            className="w-6 h-6 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
          >
            <ChevronDown size={12} />
          </button>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
            className={`w-10 h-6 text-center text-xs font-bold rounded bg-bg-secondary border border-border-default outline-none focus:border-gold/50 ${modifier > 0 ? 'text-green-400' : modifier < 0 ? 'text-red-400' : 'text-text-secondary'}`}
          />
          <button
            onClick={() => setModifier(m => m + 1)}
            className="w-6 h-6 rounded bg-bg-secondary border border-border-default text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center justify-center"
          >
            <ChevronUp size={12} />
          </button>
        </div>
        <button
          onClick={rollAll}
          disabled={!hasAny}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gold/20 text-gold border border-gold/40 font-medium text-sm hover:bg-gold/30 transition-all gold-glow disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Dices size={14} />
          Бросить все
        </button>
        <button
          onClick={clearCounts}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="Сбросить счётчики"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* History header */}
      {guiHistory.length > 0 && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">История бросков</span>
          <button
            onClick={() => setGuiHistory([])}
            className="text-[10px] text-text-muted hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Trash2 size={10} />
            Очистить
          </button>
        </div>
      )}

      {/* History */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {guiHistory.length === 0 && (
          <div className="text-center text-text-muted text-sm py-8">
            Нажмите на кубик для броска
          </div>
        )}
        {guiHistory.map(entry => (
          <div key={entry.id} className="dice-history-entry">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">{entry.expression}</span>
              <span className="text-lg font-bold text-gold font-medieval">{entry.result.total}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {entry.result.rolls.map((r, i) => (
                <span key={i} className="dice-chip dice-chip-sm">{r}</span>
              ))}
              {entry.result.modifier !== 0 && (
                <span className="text-xs text-text-muted font-medium">
                  {entry.result.modifier > 0 ? `+${entry.result.modifier}` : entry.result.modifier}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Console Roller ───

const HELP_TEXT = `**Синтаксис бросков:**
• Базовый: 1d20, 2d6+3, 1d8-1
• Оставить лучшие (keep highest): 4d6kh3
• Отбросить худшие (drop lowest): 4d6dl1
• Отбросить лучшие (drop highest): 3d4dh1
• Оставить худшие (keep lowest): 3d4kl1
• Перебросить (reroll): 2d4r1, 2d4r<2, 2d4r<=2
• Взрыв (explode): 2d4x4, 2d4x>2
• Подсчёт успехов (count successes): 2d4cs=4, 2d4cs>2
• Запас успеха (margin of success): 2d4ms=4
• Пулы кубиков (dice pools): {2d8, 1d6}kh1
• Округление (rounding): floor(1.5), ceil(1.5), round(1.5)
• Среднее (average): avg(8d6)
• Макс/Мин (max/min): dmax(8d6), dmin(8d6)
• Функции (functions): sign(1d6-3), abs(1d6-3)

**Метки:** Fireball: 8d6
**Стрелки ↑↓** — история ввода
**/clear** — очистить консоль`;

const ConsoleRoller: React.FC = () => {
  const { consoleEntries, setConsoleEntries, consoleInputHistory, setConsoleInputHistory } = useDiceRoll();
  const [input, setInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(consoleEntries.length > 0 ? Math.max(...consoleEntries.map(e => e.id)) + 1 : 0);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [consoleEntries, scrollToBottom]);

  const addEntry = useCallback((entry: Omit<ConsoleEntry, 'id'>) => {
    setConsoleEntries(prev => [...prev, { ...entry, id: nextId.current++ }]);
  }, [setConsoleEntries]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add to input history
    setConsoleInputHistory(prev => {
      const filtered = prev.filter(h => h !== trimmed);
      return [trimmed, ...filtered].slice(0, 100);
    });
    setHistoryIdx(-1);

    // Commands
    if (trimmed === '/clear') {
      setConsoleEntries([]);
      setInput('');
      return;
    }

    if (trimmed === '/help' || trimmed === '?') {
      addEntry({ type: 'help', text: HELP_TEXT });
      setInput('');
      return;
    }

    // Add input echo
    addEntry({ type: 'input', text: trimmed });

    // Evaluate
    const result = evalConsoleExpression(trimmed);
    if (result.isError) {
      addEntry({ type: 'error', text: result.breakdown || 'Ошибка разбора выражения' });
    } else {
      addEntry({
        type: 'result',
        text: '',
        label: result.label,
        breakdown: result.breakdown,
        total: result.total,
      });
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (consoleInputHistory.length > 0) {
        const newIdx = Math.min(historyIdx + 1, consoleInputHistory.length - 1);
        setHistoryIdx(newIdx);
        setInput(consoleInputHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(consoleInputHistory[newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full dice-console">
      {/* Output area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 font-mono text-sm">
        {consoleEntries.length === 0 && (
          <div className="text-text-muted text-xs py-4 text-center">
            Введите выражение (например, 2d6+3) или /help для справки
          </div>
        )}
        {consoleEntries.map(entry => (
          <ConsoleEntryLine key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border-default flex items-center gap-1 p-1.5">
        <span className="text-gold font-mono text-sm font-bold select-none">&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHistoryIdx(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="2d6+3, 4d6kh3, /help..."
          className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-text-primary placeholder:text-text-muted/50"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="text-text-muted hover:text-gold transition-colors disabled:opacity-30"
        >
          <Send size={14} />
        </button>
        <button
          onClick={() => addEntry({ type: 'help', text: HELP_TEXT })}
          className="text-text-muted hover:text-gold transition-colors"
          title="Справка"
        >
          <HelpCircle size={14} />
        </button>
        <button
          onClick={() => setConsoleEntries([])}
          disabled={consoleEntries.length === 0}
          className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-30"
          title="Очистить консоль"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const ConsoleEntryLine: React.FC<{ entry: ConsoleEntry }> = ({ entry }) => {
  switch (entry.type) {
    case 'input':
      return (
        <div className="text-text-muted">
          <span className="text-gold/60 select-none">&gt; </span>
          {entry.text}
        </div>
      );
    case 'result':
      return (
        <div className="dice-console-result">
          {entry.label && (
            <span className="text-purple-400 font-semibold">{entry.label}: </span>
          )}
          <span className="text-text-secondary">{entry.breakdown}</span>
          <span className="text-gold font-bold"> = {entry.total}</span>
        </div>
      );
    case 'error':
      return <div className="text-red-400">{entry.text}</div>;
    case 'help':
      return (
        <div className="dice-console-help text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
          {entry.text.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <div key={i} className="text-gold font-semibold mt-1">{line.replace(/\*\*/g, '')}</div>;
            }
            if (line.startsWith('**') && line.includes('**')) {
              const parts = line.split('**');
              return (
                <div key={i} className="mt-1">
                  <span className="text-gold font-semibold">{parts[1]}</span>
                  <span>{parts[2]}</span>
                </div>
              );
            }
            return <div key={i}>{line}</div>;
          })}
        </div>
      );
    default:
      return null;
  }
};

// ─── Main DiceTab ───

type DiceView = 'gui' | 'console';

export const DiceTab: React.FC = () => {
  const [view, setView] = useState<DiceView>('gui');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 mb-3 p-1 bg-bg-secondary/50 rounded-lg self-start">
        <button
          onClick={() => setView('gui')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            view === 'gui'
              ? 'bg-gold/20 text-gold border border-gold/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Dices size={12} />
            Кубики
          </span>
        </button>
        <button
          onClick={() => setView('console')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            view === 'console'
              ? 'bg-gold/20 text-gold border border-gold/30'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Send size={12} />
            Консоль
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === 'gui' ? <GUIRoller /> : <ConsoleRoller />}
      </div>
    </div>
  );
};
