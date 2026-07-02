import type { Character, CharacterStorage } from '../types';
import { applySchemaMigrations } from './characterSchema';
import i18n from '../i18n';

const STORAGE_KEY = 'dnd-characters';

// Миграция: добавить недостающие поля к старым/импортированным персонажам
// (идемпотентная нормализация) + провести по версионной цепочке миграций схемы
// (см. utils/characterSchema.ts). Экспортируется, чтобы файловый стор десктопа
// (utils/fileCharacterStore) применял ту же миграцию к данным из JSON-файла.
export function migrateCharacter(character: Character): Character {
  if (!character.equipment) {
    character.equipment = {};
  }
  // Currency обязателен в типе, но импортированный JSON может его не содержать —
  // без дефолта таб инвентаря падает на character.currency[key].
  if (!character.currency) {
    character.currency = { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 };
  }
  return applySchemaMigrations(character);
}

/**
 * Async-шов хранилища персонажей. Весь персистентный доступ идёт через этот
 * интерфейс — это единственная точка подмены локального хранилища на сетевое
 * (см. docs/PLAN_PARTY.md, этапы 0 и 3). Методы async с самого начала, чтобы
 * переезд на сетевой стор (RemoteCharacterStore) не менял сигнатуры.
 */
export interface CharacterStore {
  list(): Promise<Character[]>;
  upsert(character: Character): Promise<Character>;
  remove(characterId: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  setActiveId(characterId: string): Promise<void>;
}

const EMPTY_STORAGE: CharacterStorage = { characters: [], activeCharacterId: null };

/** Текущая реализация: один JSON-ключ в localStorage. */
export class LocalCharacterStore implements CharacterStore {
  private read(): CharacterStorage {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return { ...EMPTY_STORAGE };
      return JSON.parse(data) as CharacterStorage;
    } catch (error) {
      console.error('Ошибка при чтении хранилища персонажей:', error);
      return { ...EMPTY_STORAGE };
    }
  }

  private write(storage: CharacterStorage): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  }

  async list(): Promise<Character[]> {
    return (this.read().characters || []).map(migrateCharacter);
  }

  async getActiveId(): Promise<string | null> {
    return this.read().activeCharacterId ?? null;
  }

  async upsert(character: Character): Promise<Character> {
    try {
      const storage = this.read();
      const characters = (storage.characters || []).map(migrateCharacter);
      // Мигрируем и входящего: новые персонажи и вставки из JSON-редактора
      // получают штамп schemaVersion (копия — не мутируем объект вызывающего).
      const updated: Character = migrateCharacter({ ...character, updatedAt: new Date().toISOString() });

      const index = characters.findIndex(c => c.id === character.id);
      if (index >= 0) {
        characters[index] = updated;
      } else {
        characters.push(updated);
      }

      this.write({
        characters,
        // первый сохранённый персонаж становится активным
        activeCharacterId: storage.activeCharacterId || character.id,
      });
      return updated;
    } catch (error) {
      console.error('Ошибка при сохранении персонажа:', error);
      throw error;
    }
  }

  async remove(characterId: string): Promise<void> {
    try {
      const storage = this.read();
      const filtered = (storage.characters || []).filter(c => c.id !== characterId);

      let activeId = storage.activeCharacterId;
      if (activeId === characterId) {
        activeId = filtered.length > 0 ? filtered[0].id : null;
      }

      this.write({ characters: filtered, activeCharacterId: activeId });
    } catch (error) {
      console.error('Ошибка при удалении персонажа:', error);
      throw error;
    }
  }

  async setActiveId(characterId: string): Promise<void> {
    try {
      const storage = this.read();
      this.write({ characters: storage.characters || [], activeCharacterId: characterId });
    } catch (error) {
      console.error('Ошибка при установке активного персонажа:', error);
      throw error;
    }
  }
}

/** Синглтон локального стора — дефолт для useCharacters в локальном режиме. */
export const localCharacterStore: CharacterStore = new LocalCharacterStore();

// Экспорт персонажа в JSON
export const exportCharacter = (character: Character): void => {
  const dataStr = JSON.stringify(character, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${character.name.replace(/\s+/g, '_')}_character.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// Импорт персонажа из JSON
export const importCharacter = (file: File): Promise<Character> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const character = migrateCharacter(JSON.parse(e.target?.result as string) as Character);
        // Генерируем новый ID для импортированного персонажа
        character.id = crypto.randomUUID();
        character.createdAt = new Date().toISOString();
        character.updatedAt = new Date().toISOString();
        resolve(character);
      } catch {
        reject(new Error(i18n.t('storageErrors.invalidCharacterFile', { ns: 'game' })));
      }
    };
    reader.onerror = () => reject(new Error(i18n.t('storageErrors.fileReadError', { ns: 'game' })));
    reader.readAsText(file);
  });
};
