// Единый «богатый» рендер предмета в стиле 5etools — используется и в Глоссарии,
// и в окне «Подробнее» инвентаря. Складывает после заголовка четыре слоя текста:
//   1) собственные entries предмета (из его JSON);
//   2) общий текст типа предмета (layer 2 — данные появятся позже, см.
//      getItemTypeEntries);
//   3) описания свойств (из data/itemproperties);
//   4) описание мастерства (из variantrule «Weapon Mastery Properties»).
import React from 'react';
import i18n from '../i18n';
import { getDamageTypeName, getMasteryName, getPropertyName } from '../data/items/constants';
import { getItemPropertyByCode } from '../data/itemproperties';
import { getVariantRuleByName } from '../data/variantrule';
import { getItemTypeEntries } from '../data/itemTypeEntries';

const tg = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'game', ...opts }) as string;

function typeCodeOf(raw: any): string {
  return (typeof raw?.type === 'string' ? raw.type.split('|')[0] : '') || '';
}

function isWeapon(raw: any): boolean {
  const tc = typeCodeOf(raw);
  return !!raw?.weapon || tc === 'M' || tc === 'R';
}

function buildTypeLine(raw: any): { primary: string; secondary: string[] } {
  const tc = typeCodeOf(raw);
  let primary: string;
  if (isWeapon(raw)) primary = tg('itemRender.weapon');
  else if (tc === 'LA' || tc === 'MA' || tc === 'HA') primary = tg('itemRender.armor');
  else primary = i18n.t(`itemDisplayTypes.${tc}`, { ns: 'game', defaultValue: tc || tg('itemRender.item') });

  const secondary: string[] = [];
  if (isWeapon(raw)) {
    if (raw.weaponCategory === 'simple') secondary.push(tg('itemRender.simple'));
    else if (raw.weaponCategory === 'martial') secondary.push(tg('itemRender.martial'));
    else if (raw.weaponCategory === 'advanced') secondary.push(tg('itemRender.advanced'));
    if (tc === 'R') secondary.push(tg('itemRender.ranged'));
    else if (tc === 'M') secondary.push(tg('itemRender.melee'));
    if (raw.firearm) secondary.push(tg('itemRender.firearm'));
  }
  return { primary, secondary };
}

// Сводная строка свойств (текстом). Свойство Range (Rng) сворачивается в скобку
// свойства Боеприпасы (как в 5etools); Reload получает «(N выстрелов)».

// Параметр свойства из customProperties (GrimHollow: Magazine "20",
// Momentum "{@dice 1d12}", Damage "Slashing or Piercing") — код → ключ.
const CUSTOM_PROP_KEYS: Record<string, string> = { mag: 'Magazine', mom: 'Momentum', dam: 'Damage' };

/** Убирает 5etools-теги из короткой строки: "{@dice 1d12}" → "1d12". */
function stripTags(s: string): string {
  return s.replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

function buildPropertySummary(raw: any): string {
  const out: string[] = [];
  for (const p of (raw.property || [])) {
    if (typeof p !== 'string') continue;
    const code = p.split('|')[0];
    const lc = code.toLowerCase();
    if (lc === 'rng' || lc === 'gc:vss-r') continue; // Range сворачивается в скобку Боеприпасов
    let text = getPropertyName(code);
    if (lc === 'a' || lc === 'af') {
      const parts: string[] = [];
      if (raw.range) parts.push(tg('itemRender.rangePar', { range: raw.range }));
      if (raw.ammoType) {
        const an = String(raw.ammoType).split('|')[0];
        parts.push(an.charAt(0).toUpperCase() + an.slice(1));
      }
      if (parts.length) text += ` (${parts.join('; ')})`;
    } else if (lc === 'rld' && raw.reload != null) {
      text += ` (${tg('itemRender.reloadShots', { n: raw.reload })})`;
    } else if (CUSTOM_PROP_KEYS[lc] && raw.customProperties?.[CUSTOM_PROP_KEYS[lc]] != null) {
      text += ` (${stripTags(String(raw.customProperties[CUSTOM_PROP_KEYS[lc]]))})`;
    }
    out.push(text);
  }
  return out.join(', ');
}

function getMasteryEntries(name: string, source?: string): any[] | null {
  const rule = getVariantRuleByName('Weapon Mastery Properties');
  if (!rule?.entries) return null;
  // Мастерства-тёзки из разных книг лежат под именем с источником
  // («Scatter (GrimHollowPG24)» рядом с валдовским «Scatter») — сначала точное.
  const candidates = source ? [`${name} (${source})`, name] : [name];
  for (const wanted of candidates) {
    for (const e of rule.entries as any[]) {
      if (e && typeof e === 'object' && ((e as any)._origName === wanted || e.name === wanted)) {
        return Array.isArray(e.entries) ? e.entries : null;
      }
    }
  }
  return null;
}

/**
 * Отображаемое имя мастерства из тега "Код|Источник|Текст". Числовой довесок
 * из третьего сегмента ("Scatter (10 ft.)") переносится к локализованному
 * имени, чтобы дистанция не терялась: «Разброс (10 фт.)».
 */
function masteryDisplayName(m: string): string {
  const parts = m.split('|');
  const base = getMasteryName(parts[0]);
  const disp = parts[2]?.trim();
  if (!disp) return base;
  const par = disp.match(/\((\d+)\s*ft\.?\)/i);
  if (par) return `${base} (${par[1]} ${tg('itemRender.ft')})`;
  return disp;
}

// Полный набор entries для EntryRenderer: описание + тип + свойства + мастерство.
export function buildItemDetailEntries(raw: any): any[] {
  const result: any[] = [];

  const own = Array.isArray(raw.entries) && raw.entries.length
    ? raw.entries
    : (raw._description ? [raw._description] : []);
  result.push(...own);

  result.push(...getItemTypeEntries(typeCodeOf(raw)));

  const seen = new Set<string>();
  for (const p of (raw.property || [])) {
    if (typeof p !== 'string') continue;
    const [code, src] = p.split('|');
    const key = code.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const prop = getItemPropertyByCode(code, src);
    if (prop?.entries?.length) {
      result.push({ type: 'entries', name: prop.name, entries: prop.entries });
    }
  }

  const seenM = new Set<string>();
  for (const m of (raw.mastery || [])) {
    if (typeof m !== 'string') continue;
    const [code, src] = m.split('|');
    if (seenM.has(code)) continue;
    seenM.add(code);
    const entries = getMasteryEntries(code, src);
    if (entries?.length) {
      result.push({
        type: 'entries',
        name: `${tg('itemRender.masteryLabel')}: ${masteryDisplayName(m)}`,
        entries,
      });
    }
  }
  return result;
}

function valueWeightText(raw: any): string {
  const parts: string[] = [];
  if (raw.value != null) {
    parts.push(
      raw.value >= 100 ? `${raw.value / 100} ${tg('itemRender.gp')}`
      : raw.value >= 10 ? `${raw.value / 10} ${tg('itemRender.sp')}`
      : `${raw.value} ${tg('itemRender.cp')}`,
    );
  }
  if (raw.weight != null) parts.push(`${raw.weight} ${tg('itemRender.lb')}`);
  return parts.join(', ');
}

interface ItemRenderBodyProps {
  raw: any;
  EntryRenderer: React.FC<any>;
  onNavigate?: (entry: any) => void;
}

export const ItemRenderBody: React.FC<ItemRenderBodyProps> = ({ raw, EntryRenderer, onNavigate }) => {
  const { primary, secondary } = buildTypeLine(raw);
  const propSummary = buildPropertySummary(raw);
  const masteryNames = (raw.mastery || [])
    .filter((m: any) => typeof m === 'string')
    .map((m: string) => masteryDisplayName(m));
  const entries = buildItemDetailEntries(raw);
  const vw = valueWeightText(raw);
  const dmg = raw.dmg1 ? `${raw.dmg1} ${raw.dmgType ? getDamageTypeName(raw.dmgType) : ''}`.trim() : '';

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="italic text-text-secondary">{primary}</div>
        {secondary.length > 0 && <div className="text-text-muted text-xs">{secondary.join(', ')}</div>}
      </div>

      <div className="rounded-lg bg-bg-secondary p-3 space-y-1">
        {dmg && <div><span className="text-text-secondary">{tg('itemRender.damageLabel')}: </span><span className="text-text-primary">{dmg}{raw.dmg2 ? ` (${raw.dmg2})` : ''}</span></div>}
        {raw.range && <div><span className="text-text-secondary">{tg('itemRender.rangeLabel')}: </span><span className="text-text-primary">{raw.range} {tg('itemRender.ft')}</span></div>}
        {raw.ac != null && <div><span className="text-text-secondary">{tg('itemRender.acLabel')}: </span><span className="text-text-primary">{raw.ac}</span></div>}
        {raw.reqAttune && <div className="text-amber-400 text-xs">{typeof raw.reqAttune === 'string' ? tg('itemRender.attuneBy', { by: raw.reqAttune }) : tg('itemRender.attune')}</div>}
        {propSummary && <div><span className="text-text-secondary">{tg('itemRender.propertiesLabel')}: </span><span className="text-text-primary">{propSummary}</span></div>}
        {masteryNames.length > 0 && <div><span className="text-text-secondary">{tg('itemRender.masteryLabel')}: </span><span className="text-text-primary">{masteryNames.join(', ')}</span></div>}
        {vw && <div className="text-text-muted text-xs">{vw}</div>}
      </div>

      {entries.length > 0 && (
        <div className="border-t border-border-default pt-3 prose prose-invert prose-sm max-w-none">
          <EntryRenderer entries={entries} context="item-detail" onNavigate={onNavigate} />
        </div>
      )}

      {raw.source && (
        <div className="text-xs text-text-muted italic pt-1">{tg('itemRender.sourceLabel')}: {raw.source}</div>
      )}
    </div>
  );
};
