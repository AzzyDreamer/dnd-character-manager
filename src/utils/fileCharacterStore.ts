import type { Character, CharacterStorage } from '../types';
import type { CharacterStore } from './storage';
import { migrateCharacter } from './storage';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';

const FILE_NAME = 'characters.json';
const TMP_NAME = 'characters.json.tmp';
const EMPTY: CharacterStorage = { characters: [], activeCharacterId: null };

/**
 * Десктоп-реализация CharacterStore поверх файла в appData
 * (%APPDATA%/<identifier>/characters.json). Подключается ДИНАМИЧЕСКИ только под
 * Tauri (см. isTauri + App.tsx), поэтому @tauri-apps/* не попадает в веб-бандл.
 *
 * Запись атомарная: пишем во временный файл и переименовываем, чтобы сбой на
 * середине не оставил битый characters.json. Мутации сериализуются очередью —
 * read-modify-write над файлом не должен гоняться сам с собой.
 */
class FileCharacterStore implements CharacterStore {
  private dirPromise: Promise<string> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  // Папка appData; создаём при первом обращении (recursive — no-op, если есть).
  private dir(): Promise<string> {
    if (!this.dirPromise) {
      this.dirPromise = (async () => {
        const d = await appDataDir();
        await mkdir(d, { recursive: true });
        return d;
      })();
    }
    return this.dirPromise;
  }

  private async read(): Promise<CharacterStorage> {
    try {
      const path = await join(await this.dir(), FILE_NAME);
      if (!(await exists(path))) return { ...EMPTY };
      const raw = await readTextFile(path);
      if (!raw.trim()) return { ...EMPTY };
      return JSON.parse(raw) as CharacterStorage;
    } catch (error) {
      console.error('Ошибка чтения файла персонажей:', error);
      return { ...EMPTY };
    }
  }

  private async write(storage: CharacterStorage): Promise<void> {
    const dir = await this.dir();
    const path = await join(dir, FILE_NAME);
    const tmp = await join(dir, TMP_NAME);
    await writeTextFile(tmp, JSON.stringify(storage, null, 2));
    await rename(tmp, path);
  }

  // Сериализация мутаций: каждая встаёт в хвост очереди, чтобы параллельные
  // upsert/remove не теряли правки друг друга.
  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.queue.then(op, op);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async list(): Promise<Character[]> {
    return ((await this.read()).characters || []).map(migrateCharacter);
  }

  async getActiveId(): Promise<string | null> {
    return (await this.read()).activeCharacterId ?? null;
  }

  upsert(character: Character): Promise<Character> {
    return this.enqueue(async () => {
      const storage = await this.read();
      const characters = (storage.characters || []).map(migrateCharacter);
      const updated: Character = { ...character, updatedAt: new Date().toISOString() };

      const index = characters.findIndex(c => c.id === character.id);
      if (index >= 0) {
        characters[index] = updated;
      } else {
        characters.push(updated);
      }

      await this.write({
        characters,
        // первый сохранённый персонаж становится активным
        activeCharacterId: storage.activeCharacterId || character.id,
      });
      return updated;
    });
  }

  remove(characterId: string): Promise<void> {
    return this.enqueue(async () => {
      const storage = await this.read();
      const filtered = (storage.characters || []).filter(c => c.id !== characterId);

      let activeId = storage.activeCharacterId;
      if (activeId === characterId) {
        activeId = filtered.length > 0 ? filtered[0].id : null;
      }

      await this.write({ characters: filtered, activeCharacterId: activeId });
    });
  }

  setActiveId(characterId: string): Promise<void> {
    return this.enqueue(async () => {
      const storage = await this.read();
      await this.write({ characters: storage.characters || [], activeCharacterId: characterId });
    });
  }
}

/** Синглтон файлового стора — дефолт для useCharacters под Tauri. */
export const fileCharacterStore: CharacterStore = new FileCharacterStore();
