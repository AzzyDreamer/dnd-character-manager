// Тонкая обёртка над Rust-командами самообновления (см. src-tauri/src/updater.rs).
// Десктоп-онли: импортируется ДИНАМИЧЕСКИ (см. SettingsModal), поэтому статический
// import @tauri-apps/* здесь безопасен и файл в allowlist check-web-imports.mjs.
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  /** Доступна ли версия новее установленной. */
  available: boolean;
  /** Версия в манифесте (равна current_version, если обновления нет). */
  version: string;
  /** Текущая установленная версия. */
  current_version: string;
  /** Список изменений из манифеста, если задан. */
  notes: string | null;
  /** Дата публикации из манифеста, если задана. */
  date: string | null;
}

/** Резолвит endpoint через pointer-файл и спрашивает у сервера манифест. */
export function checkUpdate(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>('check_update');
}

/** Скачивает найденный апдейт, проверяет подпись, ставит и перезапускает приложение. */
export function installUpdate(): Promise<void> {
  return invoke('install_update');
}
