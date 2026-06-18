import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, Quest, QuestStatus, QuestLogEntry, QuestSection } from '../types';
import {
  NotebookPen, Plus, X, Trash2, Check, Gem, ChevronDown, ChevronRight, Pencil, FolderPlus,
} from 'lucide-react';

const STATUSES: QuestStatus[] = ['active', 'completed', 'failed'];
const DEFAULT_SECTION_IDS = ['main', 'personal', 'side'] as const;

type TFn = (k: string, o?: Record<string, unknown>) => string;

function genId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

// Разделы по умолчанию (если игрок ещё ничего не настраивал). id стабильны и
// совпадают с legacy Quest.category, поэтому старые задания не теряют раздел.
function defaultSections(t: TFn): QuestSection[] {
  return DEFAULT_SECTION_IDS.map(id => ({ id, title: t(`notes.categories.${id}`) }));
}

// Иконка статуса задания (как в BG3: золотой «!» активно, «✓» выполнено, «✗» провалено).
const StatusGlyph: React.FC<{ status: QuestStatus }> = ({ status }) => (
  <span className="w-4 shrink-0 flex items-center justify-center">
    {status === 'completed' ? (
      <Check size={15} className="text-gold-light" strokeWidth={2.5} />
    ) : status === 'failed' ? (
      <X size={14} className="text-text-muted" strokeWidth={2.5} />
    ) : (
      <span className="font-medieval font-bold text-gold text-[15px] leading-none select-none">!</span>
    )}
  </span>
);

// ─── Свободные заметки (одно поле, click-to-edit) ───

const FreeNotesField: React.FC<{
  value: string;
  placeholder: string;
  editLabel: string;
  cancelLabel: string;
  saveLabel: string;
  title: string;
  readOnly?: boolean;
  onChange: (val: string) => void;
}> = ({ value, placeholder, editLabel, cancelLabel, saveLabel, title, readOnly, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const save = () => { setEditing(false); if (draft !== value) onChange(draft); };

  return (
    <section className="glass-panel ornate-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <NotebookPen size={16} className="text-gold" />
          <h3 className="text-base font-medieval text-gold-light">{title}</h3>
        </div>
        {!readOnly && !editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-gold transition-colors"
          >
            <Pencil size={12} /> {editLabel}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={5}
            className="w-full px-3 py-2 bg-bg-secondary/70 border border-border-default rounded-md text-sm text-dnd-parchment placeholder:text-text-muted/60 focus:outline-none focus:border-gold/50 resize-y transition-colors leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors">{cancelLabel}</button>
            <button onClick={save} className="px-3 py-1 text-xs bg-gold/20 text-gold border border-gold/30 rounded hover:bg-gold/30 transition-colors">{saveLabel}</button>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-dnd-parchment/85 whitespace-pre-wrap leading-relaxed">{value}</p>
      ) : (
        <button
          onClick={readOnly ? undefined : startEdit}
          className={`w-full text-left text-sm text-text-muted/60 italic ${readOnly ? 'cursor-default' : 'hover:text-text-muted'}`}
        >
          {placeholder}
        </button>
      )}
    </section>
  );
};

// ─── Инлайн-редактируемый текст (заголовок / раздел / цель / запись) ───

const InlineEditable: React.FC<{
  value: string;
  placeholder: string;
  multiline?: boolean;
  readOnly?: boolean;
  autoEdit?: boolean;        // открыть сразу в режиме правки (для нового раздела)
  className?: string;        // классы для режима просмотра
  inputClassName?: string;   // классы для поля ввода
  emptyClassName?: string;
  onChange: (val: string) => void;
}> = ({ value, placeholder, multiline, readOnly, autoEdit, className = '', inputClassName = '', emptyClassName = '', onChange }) => {
  const [editing, setEditing] = useState(!!autoEdit && !readOnly);
  const [draft, setDraft] = useState(value);

  const start = () => { if (readOnly) return; setDraft(value); setEditing(true); };
  const commit = () => { setEditing(false); if (draft !== value) onChange(draft); };

  if (editing && !readOnly) {
    if (multiline) {
      return (
        <textarea
          value={draft}
          autoFocus
          rows={2}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className={`w-full px-2 py-1 bg-bg-secondary/70 border border-gold/40 rounded text-dnd-parchment focus:outline-none resize-y leading-relaxed ${inputClassName}`}
        />
      );
    }
    return (
      <input
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setEditing(false); }}
        placeholder={placeholder}
        className={`w-full px-2 py-1 bg-bg-secondary/70 border border-gold/40 rounded focus:outline-none ${inputClassName}`}
      />
    );
  }

  return (
    <button
      onClick={start}
      className={`text-left max-w-full ${readOnly ? 'cursor-default' : 'hover:bg-gold/[0.06] rounded'} transition-colors ${value ? className : `italic ${emptyClassName}`}`}
    >
      {value || placeholder}
    </button>
  );
};

// ─── Заголовок раздела / подзаголовок (переименование + действия) ───

const SectionHeader: React.FC<{
  section: QuestSection;
  isSub: boolean;
  collapsed: boolean;
  readOnly?: boolean;
  autoEdit?: boolean;
  t: TFn;
  onToggle: () => void;
  onRename: (title: string) => void;
  onAddQuest: () => void;
  onAddSub?: () => void;
  onDelete: () => void;
}> = ({ section, isSub, collapsed, readOnly, autoEdit, t, onToggle, onRename, onAddQuest, onAddSub, onDelete }) => {
  const titleView = isSub
    ? 'font-medieval text-sm text-gold/80 block w-full truncate'
    : 'font-medieval text-[15px] text-gold-light/90 block w-full truncate';
  const titleInput = isSub ? 'font-medieval text-sm text-gold/90' : 'font-medieval text-[15px] text-gold-light';
  const titleEmpty = isSub
    ? 'font-medieval text-sm text-text-muted/50 block w-full'
    : 'font-medieval text-[15px] text-text-muted/50 block w-full';

  return (
    <div className="flex items-center gap-1 group">
      <button onClick={onToggle} className="shrink-0 text-gold/55 hover:text-gold transition-colors">
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <div className="flex-1 min-w-0">
        <InlineEditable
          value={section.title}
          placeholder={t('notes.sectionTitlePlaceholder')}
          readOnly={readOnly}
          autoEdit={autoEdit}
          onChange={onRename}
          className={titleView}
          inputClassName={titleInput}
          emptyClassName={titleEmpty}
        />
      </div>
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          <button onClick={onAddQuest} title={t('notes.addQuest')} className="p-0.5 text-text-muted hover:text-gold transition-colors">
            <Plus size={13} />
          </button>
          {!isSub && onAddSub && (
            <button onClick={onAddSub} title={t('notes.addSubsection')} className="p-0.5 text-text-muted hover:text-gold transition-colors">
              <FolderPlus size={13} />
            </button>
          )}
          <button onClick={onDelete} title={t('notes.deleteSection')} className="p-0.5 text-text-muted hover:text-rose-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Левый столбец: дерево разделов и заданий ───

const QuestList: React.FC<{
  topSections: QuestSection[];
  childrenOf: (id: string) => QuestSection[];
  questsOf: (id: string) => Quest[];
  selectedId: string | null;
  readOnly?: boolean;
  newSectionId: string | null;
  t: TFn;
  onSelect: (id: string) => void;
  onAddQuest: (sectionId: string) => void;
  onAddSection: (parentId?: string) => void;
  onRenameSection: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
}> = ({ topSections, childrenOf, questsOf, selectedId, readOnly, newSectionId, t, onSelect, onAddQuest, onAddSection, onRenameSection, onDeleteSection }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderQuest = (q: Quest) => {
    const active = q.id === selectedId;
    const done = q.status === 'completed';
    return (
      <button
        key={q.id}
        onClick={() => onSelect(q.id)}
        className={`w-full flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded text-left text-sm transition-colors border-l-2 ${
          active
            ? 'bg-gold/10 border-gold text-gold-light'
            : 'border-transparent text-dnd-parchment/80 hover:bg-gold/[0.05] hover:text-dnd-parchment'
        }`}
      >
        <span className={`flex-1 truncate ${done ? 'opacity-50' : ''}`}>{q.title || t('notes.untitledQuest')}</span>
        <StatusGlyph status={q.status} />
      </button>
    );
  };

  const subHasContent = (child: QuestSection) => questsOf(child.id).length > 0;
  const topHasContent = (sec: QuestSection) => questsOf(sec.id).length > 0 || childrenOf(sec.id).some(subHasContent);

  return (
    <div className="space-y-4">
      {topSections.map(sec => {
        if (readOnly && !topHasContent(sec)) return null;
        const subs = childrenOf(sec.id);
        const directQuests = questsOf(sec.id);
        const isCollapsed = collapsed.has(sec.id);
        return (
          <div key={sec.id}>
            <SectionHeader
              section={sec}
              isSub={false}
              collapsed={isCollapsed}
              readOnly={readOnly}
              autoEdit={sec.id === newSectionId}
              t={t}
              onToggle={() => toggle(sec.id)}
              onRename={title => onRenameSection(sec.id, title)}
              onAddQuest={() => { onAddQuest(sec.id); if (isCollapsed) toggle(sec.id); }}
              onAddSub={() => { onAddSection(sec.id); if (isCollapsed) toggle(sec.id); }}
              onDelete={() => onDeleteSection(sec.id)}
            />
            {!isCollapsed && (
              <div className="mt-1.5 space-y-0.5 pl-2.5 border-l border-border-default ml-1.5">
                {directQuests.map(renderQuest)}

                {subs.map(child => {
                  if (readOnly && !subHasContent(child)) return null;
                  const childCollapsed = collapsed.has(child.id);
                  const childQuests = questsOf(child.id);
                  return (
                    <div key={child.id} className="pt-1">
                      <SectionHeader
                        section={child}
                        isSub
                        collapsed={childCollapsed}
                        readOnly={readOnly}
                        autoEdit={child.id === newSectionId}
                        t={t}
                        onToggle={() => toggle(child.id)}
                        onRename={title => onRenameSection(child.id, title)}
                        onAddQuest={() => { onAddQuest(child.id); if (childCollapsed) toggle(child.id); }}
                        onDelete={() => onDeleteSection(child.id)}
                      />
                      {!childCollapsed && (
                        <div className="mt-1 space-y-0.5 pl-2.5 border-l border-border-default ml-1.5">
                          {childQuests.length === 0
                            ? <p className="text-xs text-text-muted/50 italic pl-2 py-1">{t('notes.noQuestsInCategory')}</p>
                            : childQuests.map(renderQuest)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!readOnly && directQuests.length === 0 && subs.length === 0 && (
                  <p className="text-xs text-text-muted/50 italic pl-2 py-1">{t('notes.noQuestsInCategory')}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          onClick={() => onAddSection()}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-gold transition-colors pt-1"
        >
          <Plus size={13} /> {t('notes.addSection')}
        </button>
      )}
    </div>
  );
};

// ─── Правый столбец: детали выбранного задания ───

const QuestDetail: React.FC<{
  quest: Quest;
  sectionId: string;
  sectionOptions: { id: string; label: string }[];
  sectionLabel: string;
  readOnly?: boolean;
  t: TFn;
  onPatch: (patch: Partial<Quest>) => void;
  onDelete: () => void;
}> = ({ quest, sectionId, sectionOptions, sectionLabel, readOnly, t, onPatch, onDelete }) => {
  const setEntries = (entries: QuestLogEntry[]) => onPatch({ entries });
  const addEntry = () => setEntries([...quest.entries, { id: genId('qe'), text: '', done: false }]);
  const patchEntry = (id: string, patch: Partial<QuestLogEntry>) =>
    setEntries(quest.entries.map(e => (e.id === id ? { ...e, ...patch } : e)));
  const removeEntry = (id: string) => setEntries(quest.entries.filter(e => e.id !== id));

  const statusTone: Record<QuestStatus, string> = {
    active: 'text-gold',
    completed: 'text-gold-light',
    failed: 'text-text-muted',
  };

  return (
    <div>
      {/* Заголовок + удаление */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <InlineEditable
            value={quest.title}
            placeholder={t('notes.questTitlePlaceholder')}
            readOnly={readOnly}
            onChange={v => onPatch({ title: v })}
            className="text-2xl font-medieval text-gold-light block w-full leading-tight px-1"
            inputClassName="text-2xl font-medieval text-gold-light"
            emptyClassName="text-2xl font-medieval text-text-muted/50 block w-full px-1"
          />
        </div>
        {!readOnly && (
          <button
            onClick={() => { if (window.confirm(t('notes.confirmDeleteQuest'))) onDelete(); }}
            title={t('notes.deleteQuest')}
            className="shrink-0 p-1.5 text-text-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Раздел + статус */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
        {readOnly ? (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${statusTone[quest.status]}`}>
            <StatusGlyph status={quest.status} />
            {t(`notes.status.${quest.status}`)}
            <span className="text-text-muted/60">·</span>
            <span className="text-text-secondary">{sectionLabel}</span>
          </span>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              {t('notes.section')}
              <select
                value={sectionId}
                onChange={e => onPatch({ sectionId: e.target.value, category: undefined })}
                className="bg-bg-secondary/70 border border-border-default rounded px-2 py-1 text-xs text-dnd-parchment focus:outline-none focus:border-gold/50 max-w-[180px]"
              >
                {sectionOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1.5">
              {STATUSES.map(st => {
                const sel = quest.status === st;
                return (
                  <button
                    key={st}
                    onClick={() => onPatch({ status: st })}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      sel ? `border-current bg-gold/[0.07] ${statusTone[st]}` : 'border-border-default text-text-muted hover:text-text-secondary hover:border-border-hover'
                    }`}
                  >
                    {t(`notes.status.${st}`)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Подзаголовок «Задачи» (как на скрине) */}
      <h4 className="font-medieval text-sm text-gold/80 mb-2.5">{t('notes.tasksTitle')}</h4>

      {/* Текущая цель — подсвеченный орнаментальный блок с самоцветом */}
      {(!readOnly || quest.objective) && (
        <div className="ornate-border gold-glow rounded-md bg-gold/[0.06] px-4 py-3 mb-4 flex items-start gap-3">
          <Gem size={18} className="text-gold shrink-0 mt-0.5" />
          <InlineEditable
            value={quest.objective ?? ''}
            placeholder={t('notes.objectivePlaceholder')}
            multiline
            readOnly={readOnly}
            onChange={v => onPatch({ objective: v || undefined })}
            className="text-[15px] text-dnd-parchment font-medieval leading-snug block w-full whitespace-pre-wrap px-1"
            emptyClassName="text-[15px] text-text-muted/50 block w-full px-1"
          />
        </div>
      )}

      {/* Лента записей журнала — ромбовидные маркеры */}
      <ul className="space-y-2.5">
        {quest.entries.length === 0 ? (
          <li className="text-sm text-text-muted/50 italic px-1">{t('notes.noEntries')}</li>
        ) : (
          quest.entries.map(entry => (
            <li key={entry.id} className="flex items-start gap-2.5 group">
              <button
                disabled={readOnly}
                onClick={() => patchEntry(entry.id, { done: !entry.done })}
                title={entry.done ? t('notes.markActive') : t('notes.markDone')}
                className={`mt-[5px] shrink-0 w-3 flex justify-center ${readOnly ? 'cursor-default' : 'hover:scale-125'} transition-transform`}
              >
                {entry.done
                  ? <Check size={13} className="text-gold-light" strokeWidth={3} />
                  : <span className="block w-[7px] h-[7px] rotate-45 bg-gold/70" />}
              </button>
              <div className="flex-1 min-w-0">
                <InlineEditable
                  value={entry.text}
                  placeholder={t('notes.entryPlaceholder')}
                  multiline
                  readOnly={readOnly}
                  onChange={v => patchEntry(entry.id, { text: v })}
                  className={`text-sm block w-full whitespace-pre-wrap leading-relaxed px-1 ${entry.done ? 'text-text-muted line-through' : 'text-dnd-parchment/85'}`}
                  emptyClassName="text-sm text-text-muted/50 block w-full px-1"
                />
              </div>
              {!readOnly && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="opacity-0 group-hover:opacity-100 mt-1 shrink-0 text-text-muted hover:text-rose-400 transition-all"
                  title={t('notes.deleteEntry')}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      {!readOnly && (
        <button
          onClick={addEntry}
          className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary hover:text-gold transition-colors"
        >
          <Plus size={13} /> {t('notes.addEntry')}
        </button>
      )}
    </div>
  );
};

// ─── Главный компонент вкладки ───

export const NotesTab: React.FC<{
  character: Character;
  onUpdate: (character: Character) => void;
  readOnly?: boolean;
}> = ({ character, onUpdate, readOnly }) => {
  const { t } = useTranslation('character');
  const quests = character.quests ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(quests[0]?.id ?? null);
  // id только что добавленного раздела — чтобы открыть его сразу в режиме правки имени.
  const [newSectionId, setNewSectionId] = useState<string | null>(null);

  const update = useCallback(
    (fields: Partial<Character>) => onUpdate({ ...character, ...fields, updatedAt: new Date().toISOString() }),
    [character, onUpdate],
  );

  // Текущие разделы (сохранённые или встроенные по умолчанию).
  const sections: QuestSection[] = character.questSections && character.questSections.length
    ? character.questSections
    : defaultSections(t);

  const sectionIds = new Set(sections.map(s => s.id));
  const topSections = sections.filter(s => !s.parentId);
  const firstTopId = topSections[0]?.id ?? sections[0]?.id ?? 'main';
  const childrenOf = (id: string) => sections.filter(s => s.parentId === id);
  const resolveSectionId = (q: Quest): string => {
    const sid = q.sectionId ?? q.category;
    return sid && sectionIds.has(sid) ? sid : firstTopId;
  };
  const questsOf = (sectionId: string) => quests.filter(q => resolveSectionId(q) === sectionId);

  const sectionTitle = (id: string) => sections.find(s => s.id === id)?.title || t('notes.untitledSection');
  const sectionOptions = topSections.flatMap(top => [
    { id: top.id, label: top.title || t('notes.untitledSection') },
    ...childrenOf(top.id).map(child => ({ id: child.id, label: `↳ ${child.title || t('notes.untitledSection')}` })),
  ]);

  // Текущий список разделов для мутаций (материализует дефолты при первой правке).
  const materializeSections = () => sections.map(s => ({ ...s }));

  const setQuests = useCallback((next: Quest[]) => update({ quests: next }), [update]);

  const addQuest = (sectionId: string) => {
    const q: Quest = {
      id: genId('quest'),
      title: '',
      sectionId,
      status: 'active',
      entries: [],
      updatedAt: new Date().toISOString(),
    };
    setQuests([...quests, q]);
    setSelectedId(q.id);
  };

  const patchQuest = (id: string, patch: Partial<Quest>) =>
    setQuests(quests.map(q => (q.id === id ? { ...q, ...patch, updatedAt: new Date().toISOString() } : q)));

  const deleteQuest = (id: string) => {
    const next = quests.filter(q => q.id !== id);
    setQuests(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const addSection = (parentId?: string) => {
    const s: QuestSection = { id: genId('sec'), title: '', parentId };
    update({ questSections: [...materializeSections(), s] });
    setNewSectionId(s.id);
  };

  const renameSection = (id: string, title: string) => {
    setNewSectionId(null);
    update({ questSections: materializeSections().map(s => (s.id === id ? { ...s, title } : s)) });
  };

  const deleteSection = (id: string) => {
    if (!window.confirm(t('notes.confirmDeleteSection'))) return;
    const secs = materializeSections();
    const removeIds = new Set<string>([id, ...secs.filter(s => s.parentId === id).map(s => s.id)]);
    let remaining = secs.filter(s => !removeIds.has(s.id));
    // Гарантируем хотя бы один верхнеуровневый раздел.
    let reassignTo = remaining.find(s => !s.parentId)?.id;
    if (!reassignTo) {
      const fallback: QuestSection = { id: genId('sec'), title: t('notes.categories.main') };
      remaining = [fallback, ...remaining];
      reassignTo = fallback.id;
    }
    const nextQuests = quests.map(q =>
      removeIds.has(resolveSectionId(q)) ? { ...q, sectionId: reassignTo, category: undefined } : q,
    );
    update({ questSections: remaining, quests: nextQuests });
  };

  // Если выбор устарел (другой персонаж / снимок обновился) — показываем первое
  // задание, чтобы у зрителя read-only сразу были детали без лишнего клика.
  const selected = quests.find(q => q.id === selectedId) ?? quests[0] ?? null;

  return (
    <div className="space-y-4">
      {/* Свободные заметки */}
      <FreeNotesField
        title={t('notes.freeNotesTitle')}
        value={character.notes ?? ''}
        placeholder={t('notes.freeNotesPlaceholder')}
        editLabel={t('notes.edit')}
        cancelLabel={t('notes.cancel')}
        saveLabel={t('notes.save')}
        readOnly={readOnly}
        onChange={v => update({ notes: v || undefined })}
      />

      {/* Журнал заданий */}
      <section className="glass-panel ornate-border overflow-hidden">
        {quests.length === 0 ? (
          <div className="text-center py-14 px-5">
            <Gem size={30} className="mx-auto text-gold/30 mb-3" />
            <p className="text-base font-medieval text-gold-light/70">{t('notes.noQuests')}</p>
            {!readOnly && <p className="text-xs text-text-muted/70 mt-1.5">{t('notes.noQuestsHint')}</p>}
            {!readOnly && (
              <button
                onClick={() => addQuest(firstTopId)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm bg-gold/15 text-gold-light border border-gold/30 rounded-md hover:bg-gold/25 transition-colors"
              >
                <Plus size={14} /> {t('notes.addQuest')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(210px,310px)_1fr]">
            {/* Левый столбец — дерево разделов */}
            <div className="p-5 md:border-r border-border-default">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medieval text-lg text-gold-light">{t('notes.questsHeader')}</h3>
                {!readOnly && (
                  <button
                    onClick={() => addQuest(firstTopId)}
                    title={t('notes.addQuest')}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-gold transition-colors"
                  >
                    <Plus size={14} /> {t('notes.addQuest')}
                  </button>
                )}
              </div>
              <QuestList
                topSections={topSections}
                childrenOf={childrenOf}
                questsOf={questsOf}
                selectedId={selected?.id ?? null}
                readOnly={readOnly}
                newSectionId={newSectionId}
                t={t}
                onSelect={setSelectedId}
                onAddQuest={addQuest}
                onAddSection={addSection}
                onRenameSection={renameSection}
                onDeleteSection={deleteSection}
              />
            </div>

            {/* Правый столбец — детали */}
            <div className="p-5 min-w-0">
              {selected ? (
                <QuestDetail
                  quest={selected}
                  sectionId={resolveSectionId(selected)}
                  sectionOptions={sectionOptions}
                  sectionLabel={sectionTitle(resolveSectionId(selected))}
                  readOnly={readOnly}
                  t={t}
                  onPatch={patch => patchQuest(selected.id, patch)}
                  onDelete={() => deleteQuest(selected.id)}
                />
              ) : (
                <p className="text-sm text-text-muted/50 italic text-center py-14">{t('notes.selectQuest')}</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
