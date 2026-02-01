import type { BackgroundDefinition } from './types';

export const artisan: BackgroundDefinition = {
  id: 'artisan',
  name: 'Ремесленник',
  source: 'XPHB',
  abilityOptions: ['strength', 'dexterity', 'intelligence'],
  feat: 'Мастер на все руки',
  skillProficiencies: ['Анализ', 'Убеждение'],
  toolProficiency: 'Ремесленные инструменты (один на выбор)',
  description: 'Вы обучались ремеслу у мастера, создавая предметы своими руками.',
  equipment: 'Ремесленные инструменты (один набор), письмо от гильдии, дорожная одежда, 32 зм',
};
