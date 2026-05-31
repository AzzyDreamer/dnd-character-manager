import { createContext } from 'react';

// Запрос навигации по тегу {@filter}: в какую категорию глоссария перейти и какие
// параметры префильтра применить. Параметры — «сырые» ключи 5etools (category/level/
// type/feature type/…), сопоставление с измерениями фильтра делает сам Glossary.
export interface FilterNavRequest {
  category: string;
  params: Record<string, string[]>;
}

export type FilterNavHandler = (req: FilterNavRequest) => void;

// Провайдер задаётся на уровне App; null — обработчика нет (тег рендерится без клика).
export const FilterNavContext = createContext<FilterNavHandler | null>(null);
