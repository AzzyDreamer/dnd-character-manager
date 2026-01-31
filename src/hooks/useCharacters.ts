import { useState, useEffect } from 'react';
import { Character } from '../types';
import {
  getCharacters,
  getActiveCharacterId,
  saveCharacter,
  deleteCharacter,
  setActiveCharacter as setActiveCharacterStorage
} from '../utils/storage';

export const useCharacters = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Загрузка персонажей при монтировании
  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = () => {
    setLoading(true);
    try {
      const chars = getCharacters();
      const activeId = getActiveCharacterId();
      setCharacters(chars);
      setActiveCharacterId(activeId);
    } catch (error) {
      console.error('Ошибка загрузки персонажей:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeCharacter = characters.find(c => c.id === activeCharacterId) || null;

  const addCharacter = (character: Character) => {
    try {
      saveCharacter(character);
      loadCharacters();
    } catch (error) {
      console.error('Ошибка добавления персонажа:', error);
      throw error;
    }
  };

  const updateCharacter = (character: Character) => {
    try {
      saveCharacter(character);
      loadCharacters();
    } catch (error) {
      console.error('Ошибка обновления персонажа:', error);
      throw error;
    }
  };

  const removeCharacter = (characterId: string) => {
    try {
      deleteCharacter(characterId);
      loadCharacters();
    } catch (error) {
      console.error('Ошибка удаления персонажа:', error);
      throw error;
    }
  };

  const setActiveCharacter = (characterId: string) => {
    try {
      setActiveCharacterStorage(characterId);
      setActiveCharacterId(characterId);
    } catch (error) {
      console.error('Ошибка установки активного персонажа:', error);
      throw error;
    }
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
    refreshCharacters: loadCharacters
  };
};
