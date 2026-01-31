import type { Character, CharacterStorage } from '../types';

const STORAGE_KEY = 'dnd-characters';

// Получить все персонажи из localStorage
export const getCharacters = (): Character[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const storage: CharacterStorage = JSON.parse(data);
    return storage.characters || [];
  } catch (error) {
    console.error('Ошибка при загрузке персонажей:', error);
    return [];
  }
};

// Получить активного персонажа
export const getActiveCharacterId = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const storage: CharacterStorage = JSON.parse(data);
    return storage.activeCharacterId;
  } catch (error) {
    console.error('Ошибка при получении активного персонажа:', error);
    return null;
  }
};

// Сохранить персонажа
export const saveCharacter = (character: Character): void => {
  try {
    const characters = getCharacters();
    const index = characters.findIndex(c => c.id === character.id);
    
    const updatedCharacter = {
      ...character,
      updatedAt: new Date().toISOString()
    };
    
    if (index >= 0) {
      characters[index] = updatedCharacter;
    } else {
      characters.push(updatedCharacter);
    }
    
    const storage: CharacterStorage = {
      characters,
      activeCharacterId: getActiveCharacterId() || character.id
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Ошибка при сохранении персонажа:', error);
    throw error;
  }
};

// Удалить персонажа
export const deleteCharacter = (characterId: string): void => {
  try {
    const characters = getCharacters();
    const filtered = characters.filter(c => c.id !== characterId);
    
    let activeId = getActiveCharacterId();
    if (activeId === characterId) {
      activeId = filtered.length > 0 ? filtered[0].id : null;
    }
    
    const storage: CharacterStorage = {
      characters: filtered,
      activeCharacterId: activeId
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Ошибка при удалении персонажа:', error);
    throw error;
  }
};

// Установить активного персонажа
export const setActiveCharacter = (characterId: string): void => {
  try {
    const storage: CharacterStorage = {
      characters: getCharacters(),
      activeCharacterId: characterId
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Ошибка при установке активного персонажа:', error);
    throw error;
  }
};

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
        const character = JSON.parse(e.target?.result as string) as Character;
        // Генерируем новый ID для импортированного персонажа
        character.id = crypto.randomUUID();
        character.createdAt = new Date().toISOString();
        character.updatedAt = new Date().toISOString();
        resolve(character);
      } catch {
        reject(new Error('Неверный формат файла персонажа'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
};
