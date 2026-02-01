import type { RaceDefinition } from './types';

export const human: RaceDefinition = {
  id: 'human',
  name: 'Человек',
  speed: 30,
  size: 'Средний',
  traits: [
    { name: 'Дополнительный язык', description: 'Вы знаете один дополнительный язык по вашему выбору.' },
    { name: 'Дополнительный навык', description: 'Вы владеете одним дополнительным навыком по вашему выбору.' },
  ],
  languages: ['Общий', 'Один на выбор'],
  description: 'Самая распространённая и адаптивная раса. Люди отличаются разнообразием, амбициями и короткой, но яркой жизнью.',
  source: "Player's Handbook",
};
