// Десктоп-онли: отправка события в игровой лог партии (LP3). Грузится ДИНАМИЧЕСКИ
// из web-safe шима src/utils/partyLog.ts, поэтому @tauri-apps/* не попадает в
// веб-бандл. Вне партии invoke вернёт «no active party» — глотаем (no-op).

import { invoke } from '@tauri-apps/api/core';

export type GameEventKind = 'roll' | 'hp' | 'rest' | 'levelup' | 'resource' | 'system';

export async function logEvent(kind: GameEventKind | string, payload: unknown): Promise<void> {
  try {
    await invoke('party_event', { kind, payload });
  } catch {
    /* вне партии/сети — no-op */
  }
}
