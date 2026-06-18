import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ChevronDown, Copy, Crown, Dices, Heart, Loader2, LogIn, Moon, Radar, Server, Shield, Sparkles, Star, Trash2, User, Users, Wifi, X } from 'lucide-react';
import type { Character } from '../types';
import { CharacterSheet } from '../components/CharacterSheet';
import { PortraitImage } from '../components/ui/PortraitImage';
import { CreatureToken } from '../components/ui/CreatureToken';
import { getActiveWildShapeForm } from '../utils/wildShape';
import { getActiveKindredForm, getHybridFormTokenUrl } from '../utils/kindredForm';
import { getEffectName } from '../utils/activatedEffects';
import { getClassName, getSubclassDisplayName } from '../data/classes';
import { resolveDisplayRace } from '../data/species';
import { getConditionImageUrl, init as initConditions } from '../data/conditionsdiseases';
import { asset } from '../utils/asset';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { arePrivateRolls, setPrivateRolls } from '../utils/partyLog';
import { DEFAULT_PORT, encodePartyCode } from './protocol';
import {
  hostParty,
  joinParty,
  leaveParty,
  scanParty,
  subscribeParty,
  type DiscoveredParty,
  type HostResult,
  type PartyLogEvent,
  type PartyMember,
  type PartyStateSnapshot,
  type PartyStatus,
  type SheetMode,
} from './party';
import {
  listCampaigns,
  saveCampaign,
  deleteCampaign,
  newCampaignId,
  mergeRosterForDisplay,
  collectCampaignMembers,
  type Campaign,
} from './campaignStore';

interface PartyBinding {
  characterId: string;
  mode: SheetMode;
}

interface SnapshotCard {
  characterName?: string;
  characterId?: string;
  mode?: SheetMode;
  data: unknown;
}

// Режимы отображения листа для других игроков (ГМ всегда видит полный лист).
const SHEET_MODES: SheetMode[] = ['full', 'partial', 'minimal'];

interface PartyPanelProps {
  /** Локальные персонажи — кандидаты «поделиться». */
  characters: Character[];
  /** Текущая привязка (живёт в App, чтобы снимок уходил при правке на любом экране). */
  binding: PartyBinding | null;
  onChangeBinding: (binding: PartyBinding | null) => void;
  /** Снимки чужих листов (копятся в App), ключ — id участника. */
  snapshots: Record<string, SnapshotCard>;
  /** Игровой лог партии (копится в App). */
  gameLog: PartyLogEvent[];
  /** Выход из партии — App чистит привязку, снимки и лог. */
  onLeave: () => void;
  /** Видна ли вкладка партии сейчас (PartyPanel остаётся смонтированным под
   *  display:none ради живой сессии; используем, чтобы при повторном входе без
   *  активной сессии показывать экран ВЫБОРА, а не последнюю форму). */
  visible: boolean;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// Десктоп-онли экран онлайн-партий. LP0: транспорт + рукопожатие.
// LP1: членство и presence — хост = ГМ, состав партии (роли + online/offline)
// рассылается всем и виден и хосту, и игрокам. Грузится лениво из App.tsx под
// isTauri(), поэтому @tauri-apps/* не попадает в веб-бандл.

type Screen = 'menu' | 'host' | 'join';
type Session = { role: 'host'; info: HostResult } | { role: 'client' } | null;

const MAX_LOG = 50;
// Имя игрока запоминаем между сессиями (локально, без серверов).
const PLAYER_NAME_KEY = 'party.playerName';

const INPUT =
  'w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-text-primary ' +
  'placeholder:text-text-muted focus:outline-none focus:border-gold/50 transition-colors';
const PRIMARY_BTN =
  'px-4 py-2 bg-gold/20 text-gold border border-gold/30 rounded-md hover:bg-gold/30 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2';
const GHOST_BTN =
  'px-3 py-2 text-text-secondary hover:text-text-primary border border-border-default rounded-md ' +
  'transition-colors flex items-center gap-2';
const SELECT =
  'px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-text-primary text-sm ' +
  'focus:outline-none focus:border-gold/50 disabled:opacity-40';

export default function PartyPanel({
  characters,
  binding,
  onChangeBinding,
  snapshots,
  gameLog,
  onLeave,
  visible,
}: PartyPanelProps) {
  const { t } = useTranslation('common');
  // Тумблер «приватный бросок» (флаг живёт в utils/partyLog, см. DiceRollProvider).
  const [privateRolls, setPrivateRollsState] = useState(() => arePrivateRolls());
  const togglePrivateRolls = (v: boolean) => {
    setPrivateRolls(v);
    setPrivateRollsState(v);
  };

  const [screen, setScreen] = useState<Screen>('menu');
  const [session, setSession] = useState<Session>(null);
  const [status, setStatus] = useState<PartyStatus | null>(null);
  const [partyState, setPartyState] = useState<PartyStateSnapshot | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));
  const [discoverable, setDiscoverable] = useState(true);
  // Автоскан LAN (экран подключения).
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredParty[]>([]);
  const [nameInput, setNameInput] = useState(() => localStorage.getItem(PLAYER_NAME_KEY) ?? '');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // Поповеры тулбара активной сессии + выезжающий справа дровер лога.
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  // Инициализируем справочник состояний — нужен getConditionImageUrl, чтобы под RU
  // вернуть английское имя из _origName для пути к картинке (иначе 404). Перерисовка
  // после загрузки обновит иконки в карточках.
  const [, setCondReady] = useState(false);
  useEffect(() => {
    initConditions().then(() => setCondReady(true)).catch(() => {});
  }, []);

  // Кампании (host-side): сохранённый именованный состав, который можно продолжить.
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const activeCampaignRef = useRef<Campaign | null>(null);
  activeCampaignRef.current = activeCampaign;
  // Список кампаний для экрана создания.
  useEffect(() => {
    if (screen === 'host') void listCampaigns().then(setCampaigns).catch(() => {});
  }, [screen]);
  // Запоминаем введённое имя игрока, чтобы не вписывать каждый раз.
  useEffect(() => {
    const name = nameInput.trim();
    if (name) localStorage.setItem(PLAYER_NAME_KEY, name);
  }, [nameInput]);
  // Открытый на просмотр чужой лист (read-only) — храним ID участника, а данные
  // берём из snapshots на КАЖДОМ рендере, чтобы лист обновлялся живо при правках
  // владельца (а не только при переоткрытии). Браузерный Back/Esc закрывает.
  const [viewing, setViewing] = useState<string | null>(null);
  useBackDismiss(viewing !== null, () => setViewing(null));
  // Если участник перестал делиться (снимок исчез) — закрываем оверлей.
  useEffect(() => {
    if (viewing !== null && !snapshots[viewing]) setViewing(null);
  }, [viewing, snapshots]);

  // Десктопная кнопка «Назад» (и браузерный Back) с формы создания/подключения →
  // обратно к экрану ВЫБОРА, а не выход со всей вкладки партии. Только вне сессии.
  useBackDismiss(!session && screen !== 'menu', () => setScreen('menu'));
  // Повторный вход на вкладку партии без активной сессии → всегда экран выбора
  // (PartyPanel не размонтируется ради живой сессии, иначе осталась бы прошлая форма).
  useEffect(() => {
    if (visible && !session) {
      setScreen('menu');
      setError(null);
    }
  }, [visible, session]);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  // Подписка на события создаётся один раз — актуальный стейт читаем через ref.
  const sessionRef = useRef<Session>(null);
  sessionRef.current = session;
  const membersRef = useRef<PartyMember[]>([]);
  membersRef.current = partyState?.members ?? [];

  // Персист состава кампании (host): при изменении живого состава/снимков обновляем
  // запомненных участников и сохраняем (дебаунс — снимки часто меняются).
  useEffect(() => {
    if (sessionRef.current?.role !== 'host' || !activeCampaignRef.current) return;
    const liveMembers = partyState?.members ?? [];
    const snaps = snapshots;
    const id = window.setTimeout(() => {
      const cur = activeCampaignRef.current;
      if (!cur) return;
      const members = collectCampaignMembers(liveMembers, snaps, cur.members);
      const updated: Campaign = { ...cur, members, lastPlayedAt: new Date().toISOString() };
      activeCampaignRef.current = updated;
      setActiveCampaign(updated);
      void saveCampaign(updated).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, [partyState, snapshots]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    subscribeParty({
      onStatus: (s) => {
        setStatus(s);
        if (s.state === 'closed' && sessionRef.current) appendLog(t('party.log.connectionClosed'));
      },
      onState: (s) => setPartyState(s),
      onPeer: (p) => {
        appendLog(
          p.event === 'join'
            ? t('party.log.peerJoined', { name: p.displayName || p.id })
            : t('party.log.peerLeft', {
                name: membersRef.current.find((m) => m.id === p.id)?.displayName || p.id,
              }),
        );
      },
      onMessage: (m) => appendLog(t('party.log.message', { data: JSON.stringify(m.data) })),
      onError: (e) => appendLog(t('party.log.error', { message: e.message })),
    }).then((u) => {
      if (cancelled) u();
      else unlisten = u;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToMenu = useCallback(() => {
    setScreen('menu');
    setSession(null);
    setStatus(null);
    setPartyState(null);
    setLog([]);
    setError(null);
  }, []);

  // Выбор кампании на экране создания: подставляет имя/ГМа, либо «новая» (null).
  const selectCampaign = (c: Campaign | null) => {
    setSelectedCampaignId(c?.id ?? null);
    setPartyNameInput(c?.name ?? '');
    if (c?.gmName) setNameInput(c.gmName);
  };

  const removeCampaign = async (id: string) => {
    await deleteCampaign(id).catch(() => {});
    if (selectedCampaignId === id) selectCampaign(null);
    setCampaigns(await listCampaigns().catch(() => []));
  };

  const handleHost = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsed = Number.parseInt(portInput, 10);
      const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : undefined;
      const gmName = nameInput.trim() || t('party.defaultName');
      const partyName = partyNameInput.trim();
      const now = new Date().toISOString();
      // Кампания: выбранная существующая / новая (если введено имя) / разовая (нет).
      let campaign: Campaign | null = null;
      if (selectedCampaignId) {
        const found = campaigns.find((c) => c.id === selectedCampaignId);
        if (found) campaign = { ...found, name: partyName || found.name, gmName, lastPlayedAt: now };
      } else if (partyName) {
        campaign = { id: newCampaignId(), name: partyName, gmName, createdAt: now, lastPlayedAt: now, members: [] };
      }
      const info = await hostParty({ port, displayName: gmName, partyName, discoverable });
      setSession({ role: 'host', info });
      if (campaign) {
        setActiveCampaign(campaign);
        activeCampaignRef.current = campaign;
        void saveCampaign(campaign).catch(() => {});
      }
      appendLog(t('party.log.hostingOn', { port: info.port }));
    } catch (e) {
      setError(t('party.errors.hostFailed', { error: String(e instanceof Error ? e.message : e) }));
    } finally {
      setBusy(false);
    }
  };

  const joinWithCode = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      await joinParty({ code, displayName: nameInput.trim() || t('party.defaultName') });
      setSession({ role: 'client' });
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      setError(
        msg.includes('invalid-code')
          ? t('party.errors.invalidCode')
          : /bad-code|rejected/.test(msg)
            ? t('party.errors.rejected')
            : /version/.test(msg)
              ? t('party.errors.version')
              : t('party.errors.connectFailed', { error: msg }),
      );
    } finally {
      setBusy(false);
    }
  };
  const handleJoin = () => joinWithCode(codeInput.trim());
  const handleJoinDiscovered = (d: DiscoveredParty) => joinWithCode(encodePartyCode(d.host, d.port, d.secret));

  // Автоскан LAN: шлём пробу, собираем ответы (~1.5с). Только реальная локалка.
  const handleScan = async () => {
    setScanning(true);
    setScanned(true);
    try {
      setDiscovered(await scanParty());
    } catch {
      setDiscovered([]);
    } finally {
      setScanning(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveParty();
    } catch {
      /* и так очищаем UI */
    }
    onLeave(); // App чистит привязку и снимки
    setActiveCampaign(null);
    activeCampaignRef.current = null;
    setSelectedCampaignId(null);
    resetToMenu();
    void listCampaigns().then(setCampaigns).catch(() => {});
  };

  const copyCode = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch {
      /* буфер недоступен — пользователь скопирует вручную */
    }
  };

  // --- Активная сессия ---------------------------------------------------
  if (session) {
    const isHost = session.role === 'host';
    const connected = !isHost && status?.state === 'connected';
    const disconnected = !isHost && status?.state === 'closed';
    const selfId = isHost ? 'gm' : status?.selfId ?? null;
    // Для хоста с кампанией мерджим запомненный состав (оффлайн) с живым; иначе — живой.
    const { members, snapshots: rosterSnapshots } =
      isHost && activeCampaign
        ? mergeRosterForDisplay(partyState?.members ?? [], snapshots, activeCampaign)
        : { members: partyState?.members ?? [], snapshots };
    const title = partyState?.partyName || (isHost ? t('party.hostingTitle') : t('party.connectedTitle'));
    // Текущий снимок открытого листа — берём по id из актуальных snapshots (живое обновление).
    // Кликабельны только ОНЛАЙН-участники, поэтому id всегда есть в живых snapshots.
    const viewingSnap = viewing !== null ? snapshots[viewing] ?? null : null;

    const boundChar = binding ? characters.find((c) => c.id === binding.characterId) : undefined;
    return (
      <>
      <div className="h-full flex flex-col">
        {/* Тонкий тулбар — имя партии/роль + действия. Сетка занимает весь экран. */}
        <div className="shrink-0 flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gold/15 text-gold shrink-0">
            {isHost ? <Server size={20} /> : <Wifi size={20} />}
          </div>
          <div className="min-w-0">
            <h1 className="font-medieval text-gold text-xl truncate leading-tight">{title}</h1>
            <div className="flex items-center gap-1.5 text-xs">
              {isHost ? (
                <span className="text-text-muted">{t('party.roleGm')} · {t('party.members', { count: members.length })}</span>
              ) : (
                <>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connected ? 'bg-emerald-400' : disconnected ? 'bg-red-bright' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span className="text-text-muted">
                    {connected ? t('party.statusConnected') : disconnected ? t('party.statusDisconnected') : t('party.statusPending')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Popover
              open={shareOpen}
              onToggle={() => setShareOpen((o) => !o)}
              icon={<User size={15} />}
              label={boundChar?.name ?? t('party.shareNone')}
            >
              <ShareControls characters={characters} binding={binding} onChange={onChangeBinding} t={t} />
            </Popover>
            {isHost && (
              <Popover open={inviteOpen} onToggle={() => setInviteOpen((o) => !o)} icon={<Wifi size={15} />} label={t('party.inviteTitle')}>
                <InvitePanel info={session.info} copyCode={copyCode} copiedIdx={copiedIdx} t={t} />
              </Popover>
            )}
            <button onClick={() => setLogOpen((o) => !o)} className={GHOST_BTN} title={t('party.gameLog')}>
              <Dices size={15} />
              <span className="hidden sm:inline">{t('party.gameLog')}</span>
            </button>
            <button onClick={handleLeave} className={PRIMARY_BTN}>
              {t('party.leave')}
            </button>
          </div>
        </div>

        {/* Сетка портретов — на весь экран (авто-размер, как экран выбора персонажа). */}
        <div className="flex-1 min-h-0">
          <PartyGrid
            members={members}
            snapshots={rosterSnapshots}
            selfId={selfId}
            isGm={isHost}
            selfChar={boundChar}
            selfMode={binding?.mode ?? 'full'}
            onOpen={setViewing}
            t={t}
          />
        </div>
      </div>

      {/* Лог — выезжающий справа дровер. */}
      {logOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setLogOpen(false)} />
          <div className="fixed right-0 top-24 bottom-0 z-40 w-80 max-w-[90vw] bg-bg-panel-solid border-l border-t border-border-default rounded-tl-lg p-4 overflow-y-auto space-y-4 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between">
              <span className="font-medieval text-gold">{t('party.gameLog')}</span>
              <button onClick={() => setLogOpen(false)} className={GHOST_BTN} title={t('party.close')} aria-label={t('party.close')}>
                <X size={16} />
              </button>
            </div>
            <GameLogFeed log={gameLog} privateRolls={privateRolls} onTogglePrivate={togglePrivateRolls} t={t} />
            <EventLog log={log} title={t('party.systemLog')} emptyLabel={t('party.log.empty')} />
          </div>
        </>
      )}
      {viewingSnap && viewingSnap.data != null && (
        <ReadOnlySheetOverlay snap={viewingSnap} onClose={() => setViewing(null)} t={t} />
      )}
      </>
    );
  }

  // --- Меню / формы ------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <Header icon={Wifi} title={t('party.title')} subtitle={t('party.subtitle')} />

      {screen === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => { setError(null); setScreen('host'); }} className="glass-panel p-6 text-left hover:bg-white/5 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gold/15 text-gold group-hover:bg-gold/25 transition-colors">
                <Server size={22} />
              </div>
              <h3 className="font-medieval text-gold text-lg">{t('party.create')}</h3>
            </div>
            <p className="text-text-muted text-sm">{t('party.createDesc')}</p>
          </button>

          <button onClick={() => { setError(null); setDiscovered([]); setScanned(false); setScreen('join'); }} className="glass-panel p-6 text-left hover:bg-white/5 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gold/15 text-gold group-hover:bg-gold/25 transition-colors">
                <LogIn size={22} />
              </div>
              <h3 className="font-medieval text-gold text-lg">{t('party.join')}</h3>
            </div>
            <p className="text-text-muted text-sm">{t('party.joinDesc')}</p>
          </button>
        </div>
      )}

      {screen === 'host' && (
        <div className="glass-panel p-5 space-y-4">
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center gap-1.5 -ml-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-gold/90 hover:text-gold hover:bg-gold/10 transition-colors"
          >
            <ArrowLeft size={16} /> {t('party.back')}
          </button>

          {campaigns.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-text-secondary text-sm">{t('party.continueCampaign')}</span>
              <div className="space-y-1.5">
                {campaigns.map((c) => {
                  const sel = selectedCampaignId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                        sel ? 'border-gold/50 bg-gold/10' : 'border-border-default hover:border-border-hover'
                      }`}
                    >
                      <button onClick={() => selectCampaign(sel ? null : c)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                        {sel ? <Check size={15} className="text-gold shrink-0" /> : <Users size={15} className="text-text-muted shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-text-primary text-sm truncate">{c.name}</span>
                          <span className="block text-text-muted text-xs">{t('party.campaignMeta', { count: c.members.length })}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => removeCampaign(c.id)}
                        className="p-1 text-text-muted hover:text-red-bright transition-colors shrink-0"
                        title={t('party.deleteCampaign')}
                        aria-label={t('party.deleteCampaign')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.yourName')}</span>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className={`${INPUT} mt-1`}
              placeholder={t('party.defaultName')}
              maxLength={40}
            />
            <span className="text-text-muted text-xs">{t('party.gmHint')}</span>
          </label>
          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.partyName')}</span>
            <input
              value={partyNameInput}
              onChange={(e) => {
                setPartyNameInput(e.target.value);
                if (selectedCampaignId) setSelectedCampaignId(null); // правка имени → новая кампания
              }}
              className={`${INPUT} mt-1`}
              placeholder={t('party.partyNamePlaceholder')}
              maxLength={60}
            />
            <span className="text-text-muted text-xs">{t('party.campaignHint')}</span>
          </label>
          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.port')}</span>
            <input
              type="number"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              className={`${INPUT} mt-1`}
              placeholder={String(DEFAULT_PORT)}
            />
            <span className="text-text-muted text-xs">{t('party.portHint')}</span>
          </label>
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={discoverable}
                onChange={(e) => setDiscoverable(e.target.checked)}
                className="accent-gold"
              />
              <span className="text-text-secondary text-sm">{t('party.discoverable')}</span>
            </label>
            <span className="text-text-muted text-xs">{t('party.discoverableHint')}</span>
          </div>
          {error && <p className="text-red-bright text-sm">{error}</p>}
          <button onClick={handleHost} disabled={busy} className={PRIMARY_BTN}>
            <Server size={16} /> {busy ? t('party.starting') : t('party.startHost')}
          </button>
        </div>
      )}

      {screen === 'join' && (
        <div className="glass-panel p-5 space-y-4">
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center gap-1.5 -ml-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-gold/90 hover:text-gold hover:bg-gold/10 transition-colors"
          >
            <ArrowLeft size={16} /> {t('party.back')}
          </button>
          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.yourName')}</span>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className={`${INPUT} mt-1`}
              placeholder={t('party.defaultName')}
              maxLength={40}
            />
          </label>

          {/* Автоскан локальной сети — найденные партии в один клик. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-secondary text-sm">{t('party.findOnLan')}</span>
              <button onClick={handleScan} disabled={scanning} className={GHOST_BTN}>
                {scanning ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
                <span className="hidden sm:inline">{scanning ? t('party.scanning') : t('party.scan')}</span>
              </button>
            </div>
            {discovered.length > 0 && (
              <div className="space-y-1">
                {discovered.map((d) => (
                  <button
                    key={`${d.host}:${d.port}`}
                    onClick={() => handleJoinDiscovered(d)}
                    disabled={busy}
                    className="w-full flex items-center gap-2 rounded-md border border-border-default hover:border-gold/50 hover:bg-gold/5 px-3 py-2 text-left transition-colors disabled:opacity-50"
                  >
                    <Wifi size={15} className="text-gold shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-text-primary text-sm truncate">{d.partyName || `${d.host}:${d.port}`}</span>
                      <span className="block text-text-muted text-xs truncate">{d.host}:{d.port}</span>
                    </span>
                    <LogIn size={14} className="text-text-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {scanned && !scanning && discovered.length === 0 && (
              <p className="text-text-muted text-xs">{t('party.scanNone')}</p>
            )}
          </div>

          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.partyCode')}</span>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              className={`${INPUT} mt-1 font-mono`}
              placeholder={t('party.pasteCode')}
            />
          </label>
          {error && <p className="text-red-bright text-sm">{error}</p>}
          <button onClick={handleJoin} disabled={busy || !codeInput.trim()} className={PRIMARY_BTN}>
            <LogIn size={16} /> {busy ? t('party.connecting') : t('party.connect')}
          </button>
        </div>
      )}
    </div>
  );
}

function ShareControls({
  characters,
  binding,
  onChange,
  t,
}: {
  characters: Character[];
  binding: PartyBinding | null;
  onChange: (binding: PartyBinding | null) => void;
  t: TFn;
}) {
  const mode = binding?.mode ?? 'full';
  const boundChar = binding ? characters.find((c) => c.id === binding.characterId) : undefined;
  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="text-text-secondary text-sm">{t('party.shareCharacter')}</div>
      <select
        value={binding?.characterId ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          onChange(id ? { characterId: id, mode } : null);
        }}
        className={SELECT}
      >
        <option value="">{t('party.shareNone')}</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {binding ? (
        <>
          {/* Режим отображения для ДРУГИХ игроков — ГМ всегда видит полный лист. */}
          <div className="inline-flex rounded-md border border-border-default overflow-hidden">
            {SHEET_MODES.map((m) => (
              <button
                key={m}
                onClick={() => onChange({ characterId: binding.characterId, mode: m })}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  m === mode ? 'bg-gold/20 text-gold' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {t(`party.mode${m.charAt(0).toUpperCase()}${m.slice(1)}`)}
              </button>
            ))}
          </div>
          <p className="text-text-muted text-xs">{t(`party.modeHint.${mode}`)}</p>
          {/* Превью того, чем делишься — иначе на своём экране правок не видно:
              хост свой лист в сводке прячет, клиент свой снимок назад не получает. */}
          {boundChar && (
            <SummaryCard snap={{ characterName: boundChar.name, characterId: boundChar.id, data: boundChar }} t={t} />
          )}
        </>
      ) : (
        <p className="text-text-muted text-xs">{t('party.shareNoneHint')}</p>
      )}
    </div>
  );
}

// --- Тулбар активной сессии: поповеры + панель приглашения ---------------
/** Поповер тулбара: кнопка + выпадающая панель (закрывается кликом вне). */
function Popover({
  open,
  onToggle,
  icon,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} className={`${GHOST_BTN} max-w-[12rem]`}>
        {icon}
        <span className="hidden sm:inline truncate">{label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[90vw]">{children}</div>
        </>
      )}
    </div>
  );
}

/** Коды-приглашения хоста (IP:порт + код, копирование). */
function InvitePanel({
  info,
  copyCode,
  copiedIdx,
  t,
}: {
  info: HostResult;
  copyCode: (code: string, idx: number) => void;
  copiedIdx: number | null;
  t: TFn;
}) {
  return (
    <div className="glass-panel bg-bg-panel-solid p-4 space-y-3 shadow-xl shadow-black/50">
      <p className="text-text-secondary text-sm">{t('party.shareHint')}</p>
      <div className="text-text-muted text-xs">{t('party.boundPort', { port: info.port })}</div>
      {info.codes.length > 0 ? (
        <ul className="space-y-2">
          {info.codes.map((c, idx) => (
            <li key={c.ip} className="flex items-center gap-2 bg-bg-secondary border border-border-default rounded-md px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-text-primary text-sm">{c.ip}:{info.port}</div>
                <div className="text-text-muted text-xs font-mono truncate">{c.code}</div>
              </div>
              <button onClick={() => copyCode(c.code, idx)} className={GHOST_BTN} title={t('party.copyCode')}>
                {copiedIdx === idx ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-red-bright text-sm">{t('party.noLocalIps')}</p>
      )}
    </div>
  );
}

// --- Сетка партии (LPD) -------------------------------------------------
// Главный экран партии — на весь экран, как экран выбора персонажа: портреты
// участников с авто-размером карточек (ResizeObserver), чтобы все влезли без
// прокрутки. Имя ИГРОКА — оверлеем сверху-слева; токен активной формы — сверху
// справа (как на листе); подпись снизу (иконка класса + имя/раса/класс·подкласс);
// HP-полоса и иконки состояний — ПОД прямоугольником. Режим режется здесь: ГМ и
// сам игрок видят полный лист; full — открывается кликом; partial — детали без
// листа; minimal — портрет + имя игрока + токен формы.
const CARD_ASPECT = 9 / 21; // width / height портрета
const CARD_GAP = 16;
const CARD_BELOW = 64; // место под HP-полосой и иконками состояний
const CARD_MIN = 116;
// Высокий потолок: при малом числе участников высота окна сама ограничит размер
// (портрет растягивается на всю высоту), а кап лишь страхует от гигантских карточек.
const CARD_MAX = 520;

function PartyGrid({
  members,
  snapshots,
  selfId,
  isGm,
  selfChar,
  selfMode,
  onOpen,
  t,
}: {
  members: PartyMember[];
  snapshots: Record<string, SnapshotCard>;
  selfId: string | null;
  isGm: boolean;
  selfChar?: Character;
  selfMode: SheetMode;
  onOpen: (from: string) => void;
  t: TFn;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(150);
  const count = members.length;

  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el || count === 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw === 0 || ch === 0) return;
    // Перебираем число рядов и берём вариант с самыми крупными карточками.
    let best = CARD_MIN;
    for (let rows = 1; rows <= count; rows++) {
      const cols = Math.ceil(count / rows);
      const wFromWidth = Math.floor((cw - CARD_GAP * (cols - 1)) / cols);
      const hPer = (ch - CARD_GAP * (rows - 1)) / rows;
      const wFromHeight = Math.floor((hPer - CARD_BELOW) * CARD_ASPECT);
      const cand = Math.min(wFromWidth, wFromHeight);
      if (cand > best) best = cand;
    }
    setCardW(Math.max(CARD_MIN, Math.min(CARD_MAX, best)));
  }, [count]);

  useEffect(() => {
    recalc();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalc]);

  if (count === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-muted text-sm">{t('party.rosterLoading')}</p>
      </div>
    );
  }
  return (
    <div ref={containerRef} className="h-full overflow-hidden flex items-center justify-center">
      <div className="flex flex-wrap gap-4 justify-center content-center">
        {members.map((m) => {
          const isSelf = m.id === selfId;
          // Свой снимок в snapshots не приходит — берём локально привязанного персонажа.
          const snap = isSelf
            ? selfChar
              ? { characterName: selfChar.name, characterId: selfChar.id, mode: selfMode, data: selfChar }
              : undefined
            : snapshots[m.id];
          const char = snap?.data as Character | undefined;
          // ГМ и сам игрок видят полный лист; остальные — по режиму владельца.
          const mode: SheetMode = isGm || isSelf ? 'full' : snap?.mode ?? 'minimal';
          // Открыть полный лист read-only можно только в режиме full и не для своего листа.
          // Кликабельны только онлайн-участники (у оффлайн/сохранённых — последний
          // снимок прошлой сессии, его в живых snapshots App уже нет).
          const clickable = !!char && mode === 'full' && !isSelf && m.online;
          return (
            <PartyMemberCard
              key={m.id}
              member={m}
              char={char}
              mode={mode}
              isSelf={isSelf}
              width={cardW}
              onOpen={clickable ? () => onOpen(m.id) : undefined}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

function PartyMemberCard({
  member,
  char,
  mode,
  isSelf,
  width,
  onOpen,
  t,
}: {
  member: PartyMember;
  char?: Character;
  mode: SheetMode;
  isSelf: boolean;
  width: number;
  onOpen?: () => void;
  t: TFn;
}) {
  // Детали (имя персонажа/раса/класс/HP/состояния) видны только в full/partial.
  // Портрет, имя игрока и токен формы — всегда, даже в minimal.
  const showDetails = !!char && mode !== 'minimal';
  const portraitUrl = char?.portraitDataUrl;
  return (
    <div className={`flex flex-col transition-opacity ${member.online ? '' : 'opacity-55'}`} style={{ width }}>
      <div
        onClick={onOpen}
        className={`relative aspect-[9/21] rounded-lg overflow-hidden bg-bg-secondary ring-1 transition-all group ${
          onOpen ? 'ring-border-default hover:ring-gold/50 hover:brightness-110 cursor-pointer' : 'ring-border-default'
        }`}
      >
        {portraitUrl ? (
          <PortraitImage src={portraitUrl} pos={char!.portraitPosition} className="w-full h-full" />
        ) : char ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-bg-secondary to-bg-primary">
            <img
              src={asset(`/images/classes/${char.classId}.webp`)}
              alt=""
              className="w-10 h-10 object-contain opacity-30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-bg-secondary to-bg-primary">
            <User size={26} className="text-text-muted/30" />
          </div>
        )}

        {/* Токен активной формы — сверху справа (как на листе персонажа) */}
        {char && <FormBadge char={char} />}

        {/* Имя ИГРОКА — сверху слева */}
        <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/75 to-transparent pt-1.5 pb-6 px-2 flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.online ? 'bg-emerald-400' : 'bg-text-muted'}`}
            title={member.online ? t('party.online') : t('party.offline')}
          />
          {member.role === 'gm' && <Crown size={12} className="text-gold shrink-0" />}
          <span className={`text-xs font-medium truncate ${member.online ? 'text-white' : 'text-white/50'}`}>
            {member.displayName}
          </span>
          {isSelf && <span className="text-[10px] text-white/55 shrink-0">({t('party.you')})</span>}
        </div>

        {/* Подпись снизу (full/partial) — ТОЛЬКО при наведении: иконка класса слева
            + 3 строки — имя персонажа / раса / класс · подкласс. */}
        {showDetails && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-8 pb-2 px-2 flex items-end gap-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
            <img
              src={asset(`/images/classes/${char!.classId}.webp`)}
              alt=""
              className="w-8 h-8 object-contain shrink-0 opacity-90 drop-shadow-md"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold text-white truncate">{char!.name}</div>
              <div className="text-[11px] text-white/70 truncate">{resolveDisplayRace(char!.race, char!.raceSource)}</div>
              <div className="text-[11px] text-white/60 truncate">
                {getClassName(char!.classId)}{char!.subclass ? ` · ${getSubclassDisplayName(char!.classId, char!.subclass)}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HP — полоской ПОД прямоугольником (full/partial) */}
      {showDetails && char!.hitPoints && <HpBar hp={char!.hitPoints} />}

      {/* Состояния и эффекты — иконками с тултипом (full/partial) */}
      {showDetails && <StatusIcons char={char!} />}
    </div>
  );
}

/** Токен активной формы бейджем в углу — приоритет ликантроп → дикий облик →
 *  гибридная форма, тот же резолв, что на листе (CharacterStatsSidebar). */
function FormBadge({ char }: { char: Character }) {
  const kindred = getActiveKindredForm(char);
  const wild = !kindred ? getActiveWildShapeForm(char) : null;
  const hybridUrl =
    !kindred && !wild
      ? (char.activeEffects ?? []).map((e) => getHybridFormTokenUrl(e.key)).find(Boolean) ?? null
      : null;
  const beast = kindred ?? wild;
  if (beast) {
    return (
      <span
        className="absolute top-1.5 right-1.5 z-10 rounded-full ring-2 ring-gold shadow-lg shadow-black/50"
        title={beast.creature.name}
      >
        <CreatureToken name={beast.form} size={34} />
      </span>
    );
  }
  if (hybridUrl) {
    return (
      <span className="absolute top-1.5 right-1.5 z-10 rounded-full ring-2 ring-gold shadow-lg shadow-black/50">
        <img src={hybridUrl} alt="" className="rounded-full object-cover bg-bg-primary" style={{ width: 34, height: 34 }} />
      </span>
    );
  }
  return null;
}

function HpBar({ hp }: { hp: { current: number; max: number; temporary: number } }) {
  const pct = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0;
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="mt-1.5 px-0.5">
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-text-secondary tabular-nums">
        <Heart size={10} className="text-red-400" />
        <span>
          {hp.current}/{hp.max}
        </span>
        {hp.temporary > 0 && <span className="text-sky-300">+{hp.temporary}</span>}
      </div>
    </div>
  );
}

/** Ряд иконок состояний и активных эффектов (кроме форм — те уже показаны токеном).
 *  ВАЖНО: под RU `character.conditions` хранит ПЕРЕВЕДЁННЫЕ имена; путь к картинке
 *  резолвит data-слой (`getConditionImageUrl` восстанавливает английское из
 *  `_origName`), иначе кириллица схлопывается в подчёркивания и картинка 404-ит. */
function StatusIcons({ char }: { char: Character }) {
  const { t } = useTranslation('common');
  const { t: tg } = useTranslation('game');
  const conditions = char.conditions ?? [];
  const exhaustion = char.exhaustion ?? 0;
  const effects = (char.activeEffects ?? []).filter((e) => !getHybridFormTokenUrl(e.key));
  if (conditions.length === 0 && exhaustion === 0 && effects.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
      {conditions.map((name) => (
        <img
          key={name}
          src={getConditionImageUrl(name)}
          alt=""
          title={name}
          className="w-4 h-4 rounded-sm object-contain ring-1 ring-amber-500/40 bg-black/30"
          onError={(e) => { (e.target as HTMLImageElement).src = asset('/images/conditionsdiseases/PLACEHOLDER.webp'); }}
        />
      ))}
      {exhaustion > 0 && (
        <span
          title={`${t('party.exhaustion')} ${exhaustion}`}
          className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[9px] font-bold text-amber-300 bg-amber-900/40 ring-1 ring-amber-500/40 tabular-nums"
        >
          {exhaustion}
        </span>
      )}
      {effects.map((e) => (
        <span
          key={e.key}
          title={getEffectName(e.key, tg)}
          className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-gold/15 ring-1 ring-gold/40"
        >
          <Sparkles size={11} className="text-gold" />
        </span>
      ))}
    </div>
  );
}

function SummaryCard({ snap, t, onClick }: { snap: SnapshotCard; t: TFn; onClick?: () => void }) {
  const c = snap.data as Character | undefined;
  const hp = c?.hitPoints;
  const conditions = c?.conditions ?? [];
  const base = 'bg-bg-secondary border border-border-default rounded-md p-3 w-full text-left';
  const body = (
    <>
      <div className="text-text-primary text-sm font-medium truncate">{snap.characterName || c?.name || '—'}</div>
      {c && (
        <div className="text-text-muted text-xs truncate">
          {c.class} · {t('party.lvl', { level: c.level })}
        </div>
      )}
      {hp && (
        <div className="flex items-center gap-3 mt-1.5 text-xs">
          <span className="flex items-center gap-1 text-red-400">
            <Heart size={12} /> {hp.current}/{hp.max}
            {hp.temporary ? ` +${hp.temporary}` : ''}
          </span>
          {typeof c?.armorClass === 'number' && (
            <span className="flex items-center gap-1 text-sky-300">
              <Shield size={12} /> {c.armorClass}
            </span>
          )}
        </div>
      )}
      {conditions.length > 0 && (
        <div className="text-amber-400 text-xs mt-1 truncate">{conditions.join(', ')}</div>
      )}
    </>
  );
  // Карточка в сводке кликабельна (открывает полный лист read-only); превью в
  // ShareControls — нет (это свой лист).
  return onClick ? (
    <button onClick={onClick} className={`${base} hover:ring-1 hover:ring-gold/40 transition-all cursor-pointer`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Полноэкранный read-only просмотр чужого листа из снимка. */
function ReadOnlySheetOverlay({
  snap,
  onClose,
  t,
}: {
  snap: SnapshotCard;
  onClose: () => void;
  t: TFn;
}) {
  // Лист сам показывает баннер «Только чтение — лист N» (CharacterSheet readOnly),
  // поэтому отдельную шапку с именем не дублируем — только плавающая кнопка закрытия.
  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex flex-col">
      <button
        onClick={onClose}
        className="absolute top-2.5 right-3 z-10 p-2 rounded-md bg-bg-secondary/85 border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
        title={t('party.close')}
        aria-label={t('party.close')}
      >
        <X size={18} />
      </button>
      <div className="flex-1 min-h-0 px-4 pb-4">
        <CharacterSheet character={snap.data as Character} onUpdate={() => {}} readOnly />
      </div>
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Wifi;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-lg bg-gold/15 text-gold">
        <Icon size={24} />
      </div>
      <div>
        <h1 className="font-medieval text-gold text-2xl">{title}</h1>
        {subtitle && <p className="text-text-muted text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}

function GameLogFeed({
  log,
  privateRolls,
  onTogglePrivate,
  t,
}: {
  log: PartyLogEvent[];
  privateRolls: boolean;
  onTogglePrivate: (v: boolean) => void;
  t: TFn;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log]);
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Dices size={14} className="text-gold" />
        <span className="text-text-secondary text-sm">{t('party.gameLog')}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={privateRolls}
            onChange={(e) => onTogglePrivate(e.target.checked)}
            className="accent-gold"
          />
          {t('party.privateRolls')}
        </label>
      </div>
      <div className="max-h-56 overflow-y-auto text-sm space-y-1">
        {log.length === 0 ? (
          <p className="text-text-muted text-xs">{t('party.gameLogEmpty')}</p>
        ) : (
          log.map((e) => <GameLogLine key={e.id} e={e} t={t} />)
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function eventVisual(e: PartyLogEvent): { Icon: typeof Dices; cls: string } {
  switch (e.kind) {
    case 'roll':
      return { Icon: Dices, cls: 'text-gold' };
    case 'hp': {
      const p = (e.payload ?? {}) as { delta?: number };
      return { Icon: Heart, cls: (p.delta ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400' };
    }
    case 'rest':
      return { Icon: Moon, cls: 'text-sky-300' };
    case 'levelup':
      return { Icon: Star, cls: 'text-gold' };
    default:
      return { Icon: Dices, cls: 'text-text-muted' };
  }
}

function GameLogLine({ e, t }: { e: PartyLogEvent; t: TFn }) {
  const time = new Date(e.ts).toLocaleTimeString();
  const { Icon, cls } = eventVisual(e);
  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-text-muted text-xs shrink-0 tabular-nums">{time}</span>
      <Icon size={12} className={`${cls} shrink-0 self-center`} />
      <span className="text-gold shrink-0 font-medium">{e.actor}</span>
      <span className="min-w-0 text-text-secondary">
        <EventBody e={e} t={t} />
      </span>
    </div>
  );
}

function EventBody({ e, t }: { e: PartyLogEvent; t: TFn }) {
  switch (e.kind) {
    case 'roll':
      return <RollLine payload={e.payload} t={t} />;
    case 'hp': {
      const p = (e.payload ?? {}) as { delta?: number; current?: number; max?: number };
      const dmg = (p.delta ?? 0) < 0;
      return (
        <span>
          <span className={dmg ? 'text-red-400' : 'text-emerald-400'}>
            {dmg ? t('party.ev.damage', { n: Math.abs(p.delta ?? 0) }) : t('party.ev.heal', { n: p.delta ?? 0 })}
          </span>{' '}
          <span className="text-text-muted">({p.current}/{p.max})</span>
        </span>
      );
    }
    case 'rest': {
      const p = (e.payload ?? {}) as { kind?: string };
      return <>{p.kind === 'long' ? t('party.ev.longRest') : t('party.ev.shortRest')}</>;
    }
    case 'levelup': {
      const p = (e.payload ?? {}) as { level?: number };
      return <span className="text-gold">{t('party.ev.levelup', { level: p.level })}</span>;
    }
    default:
      return <>{e.kind}</>;
  }
}

function RollLine({ payload, t }: { payload: unknown; t: TFn }) {
  const p = (payload ?? {}) as { expression?: string; total?: number | string; mode?: string };
  const mode =
    p.mode === 'advantage' ? ` · ${t('party.advShort')}` : p.mode === 'disadvantage' ? ` · ${t('party.disShort')}` : '';
  return (
    <>
      <span className="text-text-primary">{p.expression}</span> ={' '}
      <span className="text-gold font-semibold">{p.total}</span>
      {mode && <span className="text-text-muted">{mode}</span>}
    </>
  );
}

function EventLog({ log, title, emptyLabel }: { log: string[]; title: string; emptyLabel: string }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log]);
  // Системный лог соединения — свёрнут по умолчанию, чтобы не конкурировать с игровым.
  return (
    <details className="glass-panel p-4 group">
      <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-text-secondary text-sm marker:content-['']">
        <Wifi size={13} className="text-text-muted" />
        {title}
        {log.length > 0 && <span className="text-text-muted text-xs tabular-nums">({log.length})</span>}
        <ChevronDown size={14} className="ml-auto text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 max-h-40 overflow-y-auto text-xs font-mono text-text-secondary space-y-0.5">
        {log.length === 0 ? (
          <p className="text-text-muted">{emptyLabel}</p>
        ) : (
          log.map((line, i) => <div key={i}>{line}</div>)
        )}
        <div ref={endRef} />
      </div>
    </details>
  );
}
