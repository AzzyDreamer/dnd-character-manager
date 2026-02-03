// Загрузка всех навыков из JSON файлов (ленивая загрузка)
const modules = import.meta.glob('./*.json');

export interface SkillData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  ability: string;
  entries: any[];
  [key: string]: any;
}

export const ALL_SKILLS: SkillData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
      if (data && typeof data === 'object' && data.name) {
        ALL_SKILLS.push(data as SkillData);
      }
    }
    ALL_SKILLS.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

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
