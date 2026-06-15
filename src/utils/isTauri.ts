// Определение десктоп-среды (Tauri) без статического импорта @tauri-apps/*,
// чтобы детектор был безопасен и в веб-бандле. Tauri v2 всегда инжектит
// window.__TAURI_INTERNALS__ (через него идёт IPC), независимо от withGlobalTauri.
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
