// Загрузка JSON данных классов из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface ClassJsonData {
  id: string;
  name: string;
  source: string;
  page?: number;
  hitDie: string;
  primaryAbility?: string[];
  savingThrows?: string[];
  spellcaster?: boolean;
  fluff?: string[];
  proficiencies?: any;
  startingEquipment?: any;
  multiclassing?: any;
  levelTable?: any[];
  classFeatures?: any[];
  subclassIds?: string[];
  [key: string]: any;
}

export const ALL_CLASS_DATA: ClassJsonData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/classes.json');
    const items = (mod.default ?? mod) as ClassJsonData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name && data.hitDie) {
        ALL_CLASS_DATA.push(data as ClassJsonData);
      }
    }

    ALL_CLASS_DATA.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('classes', ALL_CLASS_DATA, c => c.id, 'class');
    _initialized = true;
  })();

  return _initializing;
}

export function getClassDataByName(name: string): ClassJsonData | undefined {
  const lc = name.toLowerCase();
  // Имена классов в данных русские (захардкожены в source), а английский идентификатор
  // живёт только в id ("warlock", "wizard", "monster-hunter"). Поэтому теги вида
  // {@class Warlock} матчим ещё и по id, нормализуя дефисы/пробелы ("Monster Hunter"→id).
  const norm = lc.replace(/[^a-z0-9]/g, '');
  return ALL_CLASS_DATA.find(c =>
    c.name.toLowerCase() === lc ||
    (c as any)._origName?.toLowerCase() === lc ||
    c.id?.toLowerCase() === lc ||
    c.id?.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
  );
}

export function getClassImageUrl(id: string): string {
  return asset(`/images/classes/${id}.webp`);
}
