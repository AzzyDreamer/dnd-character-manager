import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Crown, Heart, Users } from 'lucide-react';
import type { Character } from '../types';
import type { SheetMode } from './party';
import { getConditionImageUrl, init as initConditions } from '../data/conditionsdiseases';
import { asset } from '../utils/asset';

// Глобальный сайдбар-HUD партии (LPD). Виден на всех экранах, КРОМЕ окна партии,
// пока сессия активна — и у ГМ, и у игроков. Показывает по каждому участнику имя
// (персонажа, либо игрока, если режим minimal) + HP, по правилам режима: ГМ и сам
// игрок видят полный лист, остальные — по выбранному владельцем режиму. Сворачивается
// слайдом вправо до вертикальной кнопки-стрелки.

interface SidebarMember {
  id: string;
  displayName: string;
  role: 'gm' | 'player';
  online: boolean;
}
interface SidebarSnapshot {
  characterName?: string;
  characterId?: string;
  mode?: SheetMode;
  data: unknown;
}

export default function PartySidebar({
  members,
  snapshots,
  selfId,
  isGm,
  selfChar,
  selfMode,
  partyName,
}: {
  members: SidebarMember[];
  snapshots: Record<string, SidebarSnapshot>;
  selfId: string | null;
  isGm: boolean;
  selfChar?: Character;
  selfMode: SheetMode;
  partyName: string;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(true);
  // Справочник состояний — чтобы getConditionImageUrl вернул английское имя из
  // _origName (под RU имя состояния переведено, иначе путь к картинке 404-ит).
  const [, setCondReady] = useState(false);
  useEffect(() => {
    initConditions().then(() => setCondReady(true)).catch(() => {});
  }, []);

  return (
    <div className="fixed right-0 top-24 z-40 hidden md:block">
      <div className={`relative transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Вертикальная кнопка-стрелка — торчит слева от панели и остаётся видимой,
            когда панель уехала за правый край. */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="absolute right-full top-3 flex flex-col items-center gap-1 rounded-l-md border border-r-0 border-border-default bg-bg-panel-solid px-1.5 py-2.5 text-text-secondary hover:text-gold transition-colors"
          title={open ? t('party.sidebar.collapse') : t('party.sidebar.expand')}
          aria-label={open ? t('party.sidebar.collapse') : t('party.sidebar.expand')}
        >
          {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!open && <Users size={14} className="text-gold" />}
          {!open && members.length > 0 && (
            <span className="text-[10px] text-text-muted tabular-nums">{members.length}</span>
          )}
        </button>

        {/* Панель */}
        <div className="w-56 max-h-[70vh] overflow-y-auto rounded-l-lg border border-r-0 border-border-default bg-bg-panel-solid/95 backdrop-blur shadow-xl shadow-black/40">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
            <Users size={14} className="text-gold shrink-0" />
            <span className="text-sm font-medieval text-gold truncate">{partyName || t('party.title')}</span>
          </div>
          {members.length === 0 ? (
            <p className="text-text-muted text-xs px-3 py-2">{t('party.rosterLoading')}</p>
          ) : (
            <ul className="p-2 space-y-1">
              {members.map((m) => {
                const isSelf = m.id === selfId;
                const snap = isSelf
                  ? selfChar
                    ? { mode: selfMode, data: selfChar }
                    : undefined
                  : snapshots[m.id];
                const char = snap?.data as Character | undefined;
                const mode: SheetMode = isGm || isSelf ? 'full' : snap?.mode ?? 'minimal';
                const showChar = !!char && mode !== 'minimal';
                const name = showChar ? char!.name : m.displayName;
                const hp = showChar ? char!.hitPoints : null;
                const conditions = showChar ? char!.conditions ?? [] : [];
                return (
                  <li key={m.id} className="rounded-md px-2 py-1.5 bg-bg-secondary/50">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.online ? 'bg-emerald-400' : 'bg-text-muted'}`} />
                      {m.role === 'gm' && <Crown size={11} className="text-gold shrink-0" />}
                      <span className={`text-xs truncate ${m.online ? 'text-text-primary' : 'text-text-muted'}`}>{name}</span>
                      {isSelf && <span className="text-[10px] text-text-muted shrink-0">({t('party.you')})</span>}
                    </div>
                    {hp && (
                      <div className="mt-1">
                        <HpMini hp={hp} />
                      </div>
                    )}
                    {conditions.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {conditions.map((cond) => (
                          <img
                            key={cond}
                            src={getConditionImageUrl(cond)}
                            alt=""
                            title={cond}
                            className="w-3.5 h-3.5 rounded-sm object-contain ring-1 ring-amber-500/40 bg-black/30"
                            onError={(e) => { (e.target as HTMLImageElement).src = asset('/images/conditionsdiseases/PLACEHOLDER.webp'); }}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function HpMini({ hp }: { hp: { current: number; max: number; temporary: number } }) {
  const pct = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0;
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="flex items-center gap-0.5 text-[10px] text-text-secondary tabular-nums">
        <Heart size={9} className="text-red-400" />
        {hp.current}/{hp.max}
        {hp.temporary > 0 && <span className="text-sky-300">+{hp.temporary}</span>}
      </span>
    </div>
  );
}
