import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enCharacter from './locales/en/character.json';
import enSpells from './locales/en/spells.json';
import enCombat from './locales/en/combat.json';
import enInventory from './locales/en/inventory.json';
import enGlossary from './locales/en/glossary.json';
import enGame from './locales/en/game.json';

import ruCommon from './locales/ru/common.json';
import ruCharacter from './locales/ru/character.json';
import ruSpells from './locales/ru/spells.json';
import ruCombat from './locales/ru/combat.json';
import ruInventory from './locales/ru/inventory.json';
import ruGlossary from './locales/ru/glossary.json';
import ruGame from './locales/ru/game.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        character: enCharacter,
        spells: enSpells,
        combat: enCombat,
        inventory: enInventory,
        glossary: enGlossary,
        game: enGame,
      },
      ru: {
        common: ruCommon,
        character: ruCharacter,
        spells: ruSpells,
        combat: ruCombat,
        inventory: ruInventory,
        glossary: ruGlossary,
        game: ruGame,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'character', 'spells', 'combat', 'inventory', 'glossary', 'game'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
