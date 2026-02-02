// Загрузка всех навыков из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

export interface SkillData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  ability: string;
  entries: any[];
  [key: string]: any;
}

const ALL_SKILLS: SkillData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_SKILLS.push(data as SkillData);
  }
}

ALL_SKILLS.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_SKILLS };

export function getSkillByName(name: string): SkillData | undefined {
  return ALL_SKILLS.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export const ABILITY_ABBR_NAMES: Record<string, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
};
