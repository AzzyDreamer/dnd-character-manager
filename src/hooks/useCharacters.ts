import { useState, useEffect, useRef, useCallback } from 'react';
import type { Character } from '../types';
import { localCharacterStore } from '../utils/storage';
import type { CharacterStore } from '../utils/storage';

export const useCharacters = (store: CharacterStore = localCharacterStore) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Перечитать состояние из стора БЕЗ переключения глобального флага loading,
  // чтобы мутации не мигали экраном загрузки (App гейтит контент по loading).
  // Флаг loading трогает только первичная загрузка ниже.
  const refresh = useCallback(async () => {
    const [chars, activeId] = await Promise.all([store.list(), store.getActiveId()]);
    if (!mountedRef.current) return;
    setCharacters(chars);
    setActiveCharacterId(activeId);
  }, [store]);

  // Первичная загрузка при монтировании (и при смене стора).
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [chars, activeId] = await Promise.all([store.list(), store.getActiveId()]);
        if (cancelled) return;
        setCharacters(chars);
        setActiveCharacterId(activeId);
      } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [store]);

  const activeCharacter = characters.find(c => c.id === activeCharacterId) || null;

  const addCharacter = async (character: Character): Promise<void> => {
    try {
      await store.upsert(character);
      await refresh();
    } catch (error) {
      console.error('Ошибка добавления персонажа:', error);
      throw error;
    }
  };

  const updateCharacter = async (character: Character): Promise<void> => {
    try {
      await store.upsert(character);
      await refresh();
    } catch (error) {
      console.error('Ошибка обновления персонажа:', error);
      throw error;
    }
  };

  const removeCharacter = async (characterId: string): Promise<void> => {
    try {
      await store.remove(characterId);
      await refresh();
    } catch (error) {
      console.error('Ошибка удаления персонажа:', error);
      throw error;
    }
  };

  // Активный персонаж: оптимистично в state сразу, персист в стор фоном.
  // App дёргает это синхронно вместе с переключением вида — ждать запись тут
  // не нужно, а сетевой стор не должен тормозить навигацию.
  const setActiveCharacter = (characterId: string): void => {
    setActiveCharacterId(characterId);
    store.setActiveId(characterId).catch((error) => {
      console.error('Ошибка установки активного персонажа:', error);
    });
  };

  return {
    characters,
    activeCharacter,
    activeCharacterId,
    loading,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setActiveCharacter,
    refreshCharacters: refresh,
  };
};
