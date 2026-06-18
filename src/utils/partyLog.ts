// Web-safe шим для эмита событий в игровой лог партии (LP3). Точки эмита живут в
// общих компонентах (DiceRollProvider, обработчики листа), которым НЕЛЬЗЯ
// статически импортировать src/online (десктоп-онли). Этот модуль безопасен для
// веб-бандла: статически тянет только isTauri, а сам сетевой код подгружает
// ДИНАМИЧЕСКИ под Tauri. Вне Tauri — полный no-op.

import { isTauri } from './isTauri';

// Тумблер «приватный бросок» (LP3): когда включён, броски в лог не уходят.
// Живёт здесь (а не в React), чтобы DiceRollProvider мог проверить флаг на эмите.
let privateRolls = false;

export function setPrivateRolls(value: boolean): void {
  privateRolls = value;
}

export function arePrivateRolls(): boolean {
  return privateRolls;
}

/** Отправить событие в игровой лог партии. No-op вне Tauri/партии. */
export function logPartyEvent(kind: string, payload: unknown): void {
  if (!isTauri()) return;
  if (kind === 'roll' && privateRolls) return; // приватный бросок — не транслируем
  void import('../online/gameLog')
    .then((m) => m.logEvent(kind, payload))
    .catch(() => {});
}
