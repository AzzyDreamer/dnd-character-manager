import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Copy, Crown, Heart, LogIn, Server, Shield, User, Wifi } from 'lucide-react';
import type { Character } from '../types';
import { DEFAULT_PORT } from './protocol';
import {
  hostParty,
  joinParty,
  leaveParty,
  subscribeParty,
  type HostResult,
  type PartyMember,
  type PartyStateSnapshot,
  type PartyStatus,
  type Visibility,
} from './party';

interface PartyBinding {
  characterId: string;
  visibility: Visibility;
}

interface SnapshotCard {
  characterName?: string;
  characterId?: string;
  data: unknown;
}

interface PartyPanelProps {
  /** Локальные персонажи — кандидаты «поделиться». */
  characters: Character[];
  /** Текущая привязка (живёт в App, чтобы снимок уходил при правке на любом экране). */
  binding: PartyBinding | null;
  onChangeBinding: (binding: PartyBinding | null) => void;
  /** Снимки чужих листов (копятся в App), ключ — id участника. */
  snapshots: Record<string, SnapshotCard>;
  /** Выход из партии — App чистит привязку и снимки. */
  onLeave: () => void;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// Десктоп-онли экран онлайн-партий. LP0: транспорт + рукопожатие.
// LP1: членство и presence — хост = ГМ, состав партии (роли + online/offline)
// рассылается всем и виден и хосту, и игрокам. Грузится лениво из App.tsx под
// isTauri(), поэтому @tauri-apps/* не попадает в веб-бандл.

type Screen = 'menu' | 'host' | 'join';
type Session = { role: 'host'; info: HostResult } | { role: 'client' } | null;

const MAX_LOG = 50;

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
  onLeave,
}: PartyPanelProps) {
  const { t } = useTranslation('common');

  const [screen, setScreen] = useState<Screen>('menu');
  const [session, setSession] = useState<Session>(null);
  const [status, setStatus] = useState<PartyStatus | null>(null);
  const [partyState, setPartyState] = useState<PartyStateSnapshot | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));
  const [nameInput, setNameInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  // Подписка на события создаётся один раз — актуальный стейт читаем через ref.
  const sessionRef = useRef<Session>(null);
  sessionRef.current = session;
  const membersRef = useRef<PartyMember[]>([]);
  membersRef.current = partyState?.members ?? [];

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

  const handleHost = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsed = Number.parseInt(portInput, 10);
      const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : undefined;
      const info = await hostParty({
        port,
        displayName: nameInput.trim() || t('party.defaultName'),
        partyName: partyNameInput.trim(),
      });
      setSession({ role: 'host', info });
      appendLog(t('party.log.hostingOn', { port: info.port }));
    } catch (e) {
      setError(t('party.errors.hostFailed', { error: String(e instanceof Error ? e.message : e) }));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinParty({ code: codeInput.trim(), displayName: nameInput.trim() || t('party.defaultName') });
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

  const handleLeave = async () => {
    try {
      await leaveParty();
    } catch {
      /* и так очищаем UI */
    }
    onLeave(); // App чистит привязку и снимки
    resetToMenu();
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
    const members = partyState?.members ?? [];
    const title = partyState?.partyName || (isHost ? t('party.hostingTitle') : t('party.connectedTitle'));

    return (
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <Header icon={isHost ? Server : Wifi} title={title} />

        {isHost && (
          <div className="glass-panel p-5 space-y-4">
            <p className="text-text-secondary text-sm">{t('party.shareHint')}</p>
            <div className="text-text-muted text-xs">{t('party.boundPort', { port: session.info.port })}</div>
            {session.info.codes.length > 0 ? (
              <ul className="space-y-2">
                {session.info.codes.map((c, idx) => (
                  <li
                    key={c.ip}
                    className="flex items-center gap-2 bg-bg-secondary border border-border-default rounded-md px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-text-primary text-sm">
                        {c.ip}:{session.info.port}
                      </div>
                      <div className="text-text-muted text-xs font-mono truncate">{c.code}</div>
                    </div>
                    <button onClick={() => copyCode(c.code, idx)} className={GHOST_BTN} title={t('party.copyCode')}>
                      {copiedIdx === idx ? <Check size={15} /> : <Copy size={15} />}
                      <span className="hidden sm:inline">
                        {copiedIdx === idx ? t('party.copied') : t('party.copyCode')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-red-bright text-sm">{t('party.noLocalIps')}</p>
            )}
          </div>
        )}

        {!isHost && (
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-400' : disconnected ? 'bg-red-bright' : 'bg-amber-400'
                }`}
              />
              <span className="text-text-primary text-sm">
                {connected
                  ? t('party.statusConnected')
                  : disconnected
                    ? t('party.statusDisconnected')
                    : t('party.statusPending')}
              </span>
            </div>
          </div>
        )}

        <ShareControls characters={characters} binding={binding} onChange={onChangeBinding} t={t} />
        <Roster members={members} selfId={selfId} t={t} />
        <SummaryGrid snapshots={snapshots} selfId={selfId} t={t} />
        <EventLog log={log} emptyLabel={t('party.log.empty')} />

        <div className="flex justify-end">
          <button onClick={handleLeave} className={PRIMARY_BTN}>
            {t('party.leave')}
          </button>
        </div>
      </div>
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

          <button onClick={() => { setError(null); setScreen('join'); }} className="glass-panel p-6 text-left hover:bg-white/5 transition-all group">
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
          <button onClick={() => setScreen('menu')} className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1">
            <ArrowLeft size={15} /> {t('party.back')}
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
            <span className="text-text-muted text-xs">{t('party.gmHint')}</span>
          </label>
          <label className="block">
            <span className="text-text-secondary text-sm">{t('party.partyName')}</span>
            <input
              value={partyNameInput}
              onChange={(e) => setPartyNameInput(e.target.value)}
              className={`${INPUT} mt-1`}
              placeholder={t('party.partyNamePlaceholder')}
              maxLength={60}
            />
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
          {error && <p className="text-red-bright text-sm">{error}</p>}
          <button onClick={handleHost} disabled={busy} className={PRIMARY_BTN}>
            <Server size={16} /> {busy ? t('party.starting') : t('party.startHost')}
          </button>
        </div>
      )}

      {screen === 'join' && (
        <div className="glass-panel p-5 space-y-4">
          <button onClick={() => setScreen('menu')} className="text-text-muted hover:text-text-primary text-sm flex items-center gap-1">
            <ArrowLeft size={15} /> {t('party.back')}
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
  const visibility = binding?.visibility ?? 'party';
  const boundChar = binding ? characters.find((c) => c.id === binding.characterId) : undefined;
  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="text-text-secondary text-sm">{t('party.shareCharacter')}</div>
      <div className="flex flex-wrap gap-2">
        <select
          value={binding?.characterId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            onChange(id ? { characterId: id, visibility } : null);
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
        <select
          value={visibility}
          disabled={!binding}
          onChange={(e) =>
            binding && onChange({ characterId: binding.characterId, visibility: e.target.value as Visibility })
          }
          className={SELECT}
        >
          <option value="party">{t('party.visParty')}</option>
          <option value="gm">{t('party.visGm')}</option>
          <option value="hidden">{t('party.visHidden')}</option>
        </select>
      </div>
      {binding ? (
        <>
          <p className="text-text-muted text-xs">{t(`party.visHint.${visibility}`)}</p>
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

function SummaryGrid({
  snapshots,
  selfId,
  t,
}: {
  snapshots: Record<string, SnapshotCard>;
  selfId: string | null;
  t: TFn;
}) {
  // Свой лист в сводке не показываем — он и так локально у владельца.
  const cards = Object.entries(snapshots).filter(([from]) => from !== selfId);
  return (
    <div className="glass-panel p-5">
      <div className="text-text-secondary text-sm mb-3">{t('party.sharedSheets')}</div>
      {cards.length === 0 ? (
        <p className="text-text-muted text-sm">{t('party.noShared')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cards.map(([from, snap]) => (
            <SummaryCard key={from} snap={snap} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ snap, t }: { snap: SnapshotCard; t: TFn }) {
  const c = snap.data as Character | undefined;
  const hp = c?.hitPoints;
  const conditions = c?.conditions ?? [];
  return (
    <div className="bg-bg-secondary border border-border-default rounded-md p-3">
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
    </div>
  );
}

function Roster({
  members,
  selfId,
  t,
}: {
  members: PartyMember[];
  selfId: string | null;
  t: TFn;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="text-text-secondary text-sm mb-3">{t('party.members', { count: members.length })}</div>
      {members.length === 0 ? (
        <p className="text-text-muted text-sm">{t('party.rosterLoading')}</p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.online ? 'bg-emerald-400' : 'bg-text-muted'}`}
                title={m.online ? t('party.online') : t('party.offline')}
              />
              {m.role === 'gm' ? (
                <Crown size={14} className="text-gold shrink-0" />
              ) : (
                <User size={14} className="text-text-muted shrink-0" />
              )}
              <span className={m.online ? 'text-text-primary' : 'text-text-muted'}>{m.displayName}</span>
              {m.id === selfId && <span className="text-text-muted text-xs">({t('party.you')})</span>}
              <span className="text-text-muted text-xs ml-auto">
                {m.role === 'gm' ? t('party.roleGm') : t('party.rolePlayer')}
              </span>
            </li>
          ))}
        </ul>
      )}
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

function EventLog({ log, emptyLabel }: { log: string[]; emptyLabel: string }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log]);
  return (
    <div className="glass-panel p-4">
      <div className="max-h-40 overflow-y-auto text-xs font-mono text-text-secondary space-y-0.5">
        {log.length === 0 ? (
          <p className="text-text-muted">{emptyLabel}</p>
        ) : (
          log.map((line, i) => <div key={i}>{line}</div>)
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
