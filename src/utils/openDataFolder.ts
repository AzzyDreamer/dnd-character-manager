import { appDataDir, join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

// Открывает папку appData с данными приложения в системном проводнике.
// Если characters.json уже есть — показывает папку с выделением файла, иначе
// саму папку. Десктоп-онли: импортируется ДИНАМИЧЕСКИ (см. SettingsModal),
// чтобы @tauri-apps/* не попал в веб-бандл.
export async function openDataFolder(): Promise<void> {
  const dir = await appDataDir();
  const file = await join(dir, 'characters.json');
  await revealItemInDir((await exists(file)) ? file : dir);
}
