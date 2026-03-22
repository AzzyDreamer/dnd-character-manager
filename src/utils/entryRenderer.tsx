import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lookupByTag, getTagDisplayName as registryGetTagDisplayName } from '../data/registry';
import type { RegistryEntry } from '../data/registry';

export type { RegistryEntry };

// Для обратной совместимости с Glossary (больше не нужна, но оставляем no-op)
export function registerLoadedData(_type: string, _items: any[]): void {
  // no-op: данные теперь берутся из registry
}

// Получить отображаемое имя из тега
function getTagDisplayName(tagType: string, content: string): string {
  return registryGetTagDisplayName(tagType, content);
}

// ─── Список неработающих ссылок (собирается при рендеринге) ───
const brokenLinks: { tag: string; content: string; context: string }[] = [];

export function getBrokenLinks() {
  return [...brokenLinks];
}

// ─── Типы тегов ───
// Теги, которые генерируют ссылки/тултипы
const LINK_TAGS = new Set([
  'spell', 'item', 'condition', 'disease', 'skill', 'sense', 'status',
  'variantrule', 'optfeature', 'feat', 'action', 'background',
  'race', 'species', 'creature', 'hazard', 'quickref', 'itemProperty',
  'card', 'class', 'charoption', 'subclass',
]);

// Теги, которые просто отображают текст
const TEXT_TAGS = new Set([
  'damage', 'dice', 'dc', 'scaledamage', 'hit', 'chance',
  'recharge', 'coinflip', 'scaledice',
]);

// Теги книг — удаляем
const BOOK_TAGS = new Set(['book', 'adventure']);

// ─── Парсер тегов ───
const TAG_REGEX = /\{@(\w+)\s+([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

function parseTagContent(tagType: string, content: string): string {
  const parts = content.split('|');

  // Для @book — просто возвращаем название книги (или пустую строку)
  if (BOOK_TAGS.has(tagType)) {
    return ''; // Убираем ссылки на книги
  }

  // Для @link — возвращаем текст ссылки
  if (tagType === 'link') {
    return parts[0].trim();
  }

  // Для @filter — возвращаем описание
  if (tagType === 'filter') {
    return parts[0].trim();
  }

  // Для @note — возвращаем текст
  if (tagType === 'note') {
    return content;
  }

  // Для @dc — возвращаем "СЛ X"
  if (tagType === 'dc') {
    return `СЛ ${parts[0].trim()}`;
  }

  // Для @damage, @dice, @scaledamage, @hit — возвращаем бросок
  if (TEXT_TAGS.has(tagType)) {
    return parts[0].trim();
  }

  return getTagDisplayName(tagType, content);
}

// ─── Компонент тултипа ───
const TagTooltip: React.FC<{
  entry: RegistryEntry;
  children: React.ReactNode;
  onNavigate?: (entry: RegistryEntry) => void;
}> = ({ entry, children, onNavigate }) => {
  const [show, setShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;

      // Clamp after tooltip renders
      requestAnimationFrame(() => {
        if (!tooltipRef.current) return;
        const tt = tooltipRef.current.getBoundingClientRect();
        const pad = 8;

        // Horizontal: keep tooltip within viewport
        if (x - tt.width / 2 < pad) x = tt.width / 2 + pad;
        else if (x + tt.width / 2 > window.innerWidth - pad) x = window.innerWidth - tt.width / 2 - pad;

        // Vertical: if not enough space above, show below
        if (y - tt.height - pad < 0) y = rect.bottom + tt.height + pad;

        setPos({ x, y });
      });

      setPos({ x, y });
    }
  }, [show]);

  // Формируем краткое описание для тултипа
  const getTooltipContent = () => {
    const data = entry.data;
    const lines: string[] = [];

    // Заголовок
    lines.push(entry.name);

    // Источник
    if (entry.source) {
      lines.push(`Источник: ${entry.source}`);
    }

    // Тип записи
    const typeLabels: Record<string, string> = {
      spell: 'Заклинание',
      feat: 'Черта',
      condition: 'Состояние',
      disease: 'Болезнь',
      skill: 'Навык',
      sense: 'Чувство',
      variantrule: 'Правило',
      optfeature: 'Способность',
      item: 'Предмет',
      background: 'Предыстория',
      species: 'Вид',
      action: 'Действие',
    };
    if (typeLabels[entry.type]) {
      lines.push(`Тип: ${typeLabels[entry.type]}`);
    }

    // Для заклинаний — уровень и школа
    if (entry.type === 'spell' && data.level !== undefined) {
      const schoolNames: Record<string, string> = {
        A: 'Ограждение', C: 'Вызов', D: 'Прорицание', E: 'Очарование',
        V: 'Воплощение', I: 'Иллюзия', N: 'Некромантия', T: 'Преобразование',
      };
      const levelStr = data.level === 0 ? 'Заговор' : `${data.level} уровень`;
      lines.push(`${levelStr}, ${schoolNames[data.school] || data.school}`);
    }

    // Для навыков — характеристика
    if (entry.type === 'skill' && data.ability) {
      const abilityNames: Record<string, string> = {
        str: 'Сила', dex: 'Ловкость', con: 'Телосложение',
        int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма',
      };
      lines.push(`Характеристика: ${abilityNames[data.ability] || data.ability}`);
    }

    // Первая строка описания
    if (entry.entries && entry.entries.length > 0) {
      const firstEntry = entry.entries[0];
      if (typeof firstEntry === 'string') {
        // Убираем @теги для тултипа
        const clean = firstEntry.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1');
        lines.push(clean.length > 200 ? clean.substring(0, 200) + '...' : clean);
      }
    }

    return lines;
  };

  return (
    <span
      ref={ref}
      className="tag-link cursor-pointer"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onNavigate) {
          onNavigate(entry);
        } else {
          setModalOpen(true);
          setShow(false);
        }
      }}
    >
      {children}
      {show && !modalOpen && (
        <div
          ref={tooltipRef}
          className="tag-tooltip"
          style={{
            position: 'fixed',
            left: `${pos.x}px`,
            top: `${pos.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
        >
          {getTooltipContent().map((line, i) => (
            <div key={i} className={i === 0 ? 'tag-tooltip-title' : 'tag-tooltip-line'}>
              {line}
            </div>
          ))}
        </div>
      )}
      {modalOpen && createPortal(
        <TagDetailModal entry={entry} onClose={() => setModalOpen(false)} />,
        document.body
      )}
    </span>
  );
};

// ─── Модальное окно подробного описания записи ───
const TagDetailModal: React.FC<{
  entry: RegistryEntry;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const d = entry.data;

  // Получаем entries
  let entries: any[] = [];
  if (d.entries) entries = d.entries;
  else if (d.raw?.entries) entries = d.raw.entries;
  else if (entry.entries) entries = entry.entries;

  const typeLabels: Record<string, string> = {
    spell: 'Заклинание', feat: 'Черта', condition: 'Состояние',
    disease: 'Болезнь', skill: 'Навык', sense: 'Чувство',
    variantrule: 'Правило', optfeature: 'Способность',
    item: 'Предмет', background: 'Предыстория', species: 'Вид', action: 'Действие',
  };

  const schoolNames: Record<string, string> = {
    A: 'Ограждение', C: 'Вызов', D: 'Прорицание', E: 'Очарование',
    V: 'Воплощение', I: 'Иллюзия', N: 'Некромантия', T: 'Преобразование',
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl border-2 border-gold max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="sticky top-0 bg-gray-900 border-b border-border-default p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-medieval text-gold">{entry.name || d.name || 'Запись'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Мета-теги */}
          <div className="flex flex-wrap gap-2">
            {(entry.source || d.source) && (
              <span className="px-2 py-1 bg-bg-panel-solid text-text-primary rounded text-xs">{entry.source || d.source}</span>
            )}
            {typeLabels[entry.type] && (
              <span className="px-2 py-1 bg-indigo-900/40 text-indigo-300 rounded text-xs">{typeLabels[entry.type]}</span>
            )}
            {entry.type === 'spell' && d.level !== undefined && (
              <span className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs">
                {d.level === 0 ? 'Заговор' : `${d.level} уровень`}
              </span>
            )}
            {d.school && (
              <span className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">
                {schoolNames[d.school] || d.school}
              </span>
            )}
          </div>

          {/* Полное описание через EntryRenderer */}
          {entries.length > 0 && (
            <div className="prose prose-invert prose-sm max-w-none">
              <EntryRenderer entries={entries} context={entry.name || d.name || ''} />
            </div>
          )}

          {/* Fallback: если entries пустой, но есть description */}
          {entries.length === 0 && d.description && (
            <div className="prose prose-invert prose-sm max-w-none">
              <p>{d.description}</p>
            </div>
          )}

          {/* Higher level entries для заклинаний */}
          {d.entriesHigherLevel?.length > 0 && (
            <div className="pt-4 border-t border-border-default">
              <h4 className="text-sm font-medium text-text-primary mb-2">На более высоких уровнях</h4>
              <EntryRenderer entries={d.entriesHigherLevel} context={entry.name || d.name || ''} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Рендеринг строки с @тегами ───
export function renderTaggedString(
  text: string,
  context: string = '',
  onNavigate?: (entry: RegistryEntry) => void,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);

  while ((match = regex.exec(text)) !== null) {
    // Текст перед тегом
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const tagType = match[1];
    const tagContent = match[2];
    const key = `tag-${match.index}`;

    if (BOOK_TAGS.has(tagType)) {
      // Убираем ссылки на книги — не выводим ничего
      // (закомментировано, но не удалено из JSON)
    } else if (tagType === 'link') {
      // Рабочая ссылка
      const parts = tagContent.split('|');
      const linkText = parts[0].trim();
      const linkUrl = parts[1]?.trim();
      if (linkUrl) {
        result.push(
          <a key={key} href={linkUrl} target="_blank" rel="noopener noreferrer" className="tag-external-link">
            {linkText}
          </a>
        );
      } else {
        result.push(<span key={key}>{linkText}</span>);
      }
    } else if (tagType === 'filter') {
      const displayText = tagContent.split('|')[0].trim();
      result.push(<span key={key} className="tag-filter">{displayText}</span>);
    } else if (tagType === 'note') {
      // Рекурсивно рендерим содержимое @note
      result.push(<span key={key} className="tag-note">{renderTaggedString(tagContent, context, onNavigate)}</span>);
    } else if (TEXT_TAGS.has(tagType)) {
      const displayText = parseTagContent(tagType, tagContent);
      result.push(<span key={key} className={`tag-${tagType}`}>{displayText}</span>);
    } else if (LINK_TAGS.has(tagType)) {
      const displayText = parseTagContent(tagType, tagContent);
      const entry = lookupByTag(tagType, tagContent);

      if (entry) {
        result.push(
          <TagTooltip key={key} entry={entry} onNavigate={onNavigate}>
            {displayText}
          </TagTooltip>
        );
      } else {
        // Нет данных — отображаем как обычный текст
        result.push(<span key={key} className="tag-text-only">{displayText}</span>);
      }
    } else {
      // Неизвестный тег — просто текст
      const displayText = parseTagContent(tagType, tagContent);
      result.push(<span key={key}>{displayText}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Текст после последнего тега
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

// ─── Рендеринг 5etools entries ───
export interface EntryRendererProps {
  entries: any[];
  context?: string;
  onNavigate?: (entry: RegistryEntry) => void;
  className?: string;
}

export const EntryRenderer: React.FC<EntryRendererProps> = ({
  entries,
  context = '',
  onNavigate,
  className = '',
}) => {
  return (
    <div className={`entry-renderer ${className}`}>
      {entries.map((entry, index) => (
        <EntryNode key={index} entry={entry} context={context} onNavigate={onNavigate} />
      ))}
    </div>
  );
};

const EntryNode: React.FC<{
  entry: any;
  context: string;
  onNavigate?: (entry: RegistryEntry) => void;
}> = ({ entry, context, onNavigate }) => {
  if (typeof entry === 'string') {
    return <p className="entry-text">{renderTaggedString(entry, context, onNavigate)}</p>;
  }

  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  // Массив
  if (Array.isArray(entry)) {
    return (
      <>
        {entry.map((e, i) => (
          <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
        ))}
      </>
    );
  }

  const { type, name, entries: subEntries, items, entry: singleEntry } = entry;

  switch (type) {
    case 'entries':
      return (
        <div className="entry-section">
          {name && <h4 className="entry-section-title">{renderTaggedString(name, context, onNavigate)}</h4>}
          {subEntries && subEntries.map((e: any, i: number) => (
            <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
          ))}
        </div>
      );

    case 'list':
      return (
        <ul className={`entry-list ${entry.style === 'list-hang-notitle' ? 'list-hang' : ''}`}>
          {items && items.map((item: any, i: number) => (
            <li key={i} className="entry-list-item">
              <EntryNode entry={item} context={context} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      );

    case 'item':
      return (
        <div className="entry-item">
          {name && <span className="entry-item-name">{renderTaggedString(name, context, onNavigate)}</span>}
          {singleEntry && (
            <span className="entry-item-text">
              {typeof singleEntry === 'string'
                ? renderTaggedString(singleEntry, context, onNavigate)
                : <EntryNode entry={singleEntry} context={context} onNavigate={onNavigate} />}
            </span>
          )}
          {subEntries && subEntries.map((e: any, i: number) => (
            <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
          ))}
        </div>
      );

    case 'table':
      return (
        <div className="entry-table-wrapper">
          {entry.caption && <div className="entry-table-caption">{entry.caption}</div>}
          <table className="entry-table">
            {entry.colLabels && (
              <thead>
                <tr>
                  {entry.colLabels.map((label: string, i: number) => (
                    <th key={i}>{renderTaggedString(label, context, onNavigate)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {entry.rows && entry.rows.map((row: any[], ri: number) => (
                <tr key={ri}>
                  {row.map((cell: any, ci: number) => (
                    <td key={ci}>
                      {typeof cell === 'string'
                        ? renderTaggedString(cell, context, onNavigate)
                        : typeof cell === 'object' && cell?.type === 'cell'
                          ? <EntryNode entry={cell.entry || cell.roll || cell} context={context} onNavigate={onNavigate} />
                          : String(cell ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'image':
      // Обработка изображений — используем локальные пути
      return <EntryImage entry={entry} />;

    case 'inset':
    case 'insetReadaloud':
      return (
        <div className={`entry-inset ${type === 'insetReadaloud' ? 'entry-inset-readaloud' : ''}`}>
          {name && <div className="entry-inset-title">{name}</div>}
          {subEntries && subEntries.map((e: any, i: number) => (
            <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
          ))}
        </div>
      );

    case 'quote':
      return (
        <blockquote className="entry-quote">
          {subEntries && subEntries.map((e: any, i: number) => (
            <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
          ))}
          {entry.by && <div className="entry-quote-by">— {entry.by}</div>}
        </blockquote>
      );

    case 'cell':
      if (entry.roll) {
        if (entry.roll.exact !== undefined) return <span>{entry.roll.exact}</span>;
        if (entry.roll.min !== undefined && entry.roll.max !== undefined) {
          return <span>{entry.roll.min}-{entry.roll.max}</span>;
        }
      }
      if (entry.entry) return <EntryNode entry={entry.entry} context={context} onNavigate={onNavigate} />;
      return null;

    default:
      // Для неизвестных типов пытаемся отрендерить вложенные entries
      if (subEntries) {
        return (
          <div>
            {name && <strong>{name}</strong>}
            {subEntries.map((e: any, i: number) => (
              <EntryNode key={i} entry={e} context={context} onNavigate={onNavigate} />
            ))}
          </div>
        );
      }
      if (typeof entry === 'object' && entry.name && entry.entry) {
        return (
          <div className="entry-item">
            <span className="entry-item-name">{entry.name}</span>
            <span className="entry-item-text">
              {typeof entry.entry === 'string'
                ? renderTaggedString(entry.entry, context, onNavigate)
                : <EntryNode entry={entry.entry} context={context} onNavigate={onNavigate} />}
            </span>
          </div>
        );
      }
      return null;
  }
};

// ─── Компонент изображения с PLACEHOLDER fallback ───
const EntryImage: React.FC<{ entry: any }> = ({ entry }) => {
  const [failed, setFailed] = useState(false);
  const placeholderSrc = '/images/PLACEHOLDER.webp';

  // Определяем путь к изображению
  let src = placeholderSrc;
  if (entry.href) {
    if (entry.href.type === 'internal' && entry.href.path) {
      src = entry.href.path;
    } else if (entry.href.type === 'external' && entry.href.url) {
      // Внешние URL заменяем на placeholder
      // (внешние изображения убираем по требованию)
      src = placeholderSrc;
    }
  }

  if (failed) {
    src = placeholderSrc;
  }

  return (
    <div className="entry-image">
      <img
        src={src}
        alt={entry.title || 'Изображение'}
        onError={() => setFailed(true)}
        className="entry-image-img"
        style={{ maxWidth: entry.maxWidth || '100%' }}
      />
      {entry.title && <div className="entry-image-caption">{entry.title}</div>}
      {entry.credit && <div className="entry-image-credit">{entry.credit}</div>}
    </div>
  );
};

export { EntryNode, TagTooltip };
