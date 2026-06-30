import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, InventoryItem, EquipmentSlot, Equipment, ItemCategory } from '../types';
import {
  RARITY_COLORS,
  RARITY_BG_COLORS,
  getRarityName,
  getEquipmentSlotName,
  EQUIPMENT_SLOT_ICONS,
  getCategoryName,
  getArmorType,
  getArmorAC,
  getWeaponCategory,
  getWeaponMastery,
  loadAllItemTemplates,
  getAllItemTemplatesSync,
  type ItemTemplate,
} from '../data/items';
import { resolveAC, getClassSpeedBonus, hasItemProficiency, getEffectiveAbilityScores } from '../utils/classEffects';
import { currencyToCopper, adjustCurrency } from '../utils/currency';
import { Backpack, Plus, X, Search, Package, Shield, FlaskConical, Coins, AlertTriangle, NotebookPen } from 'lucide-react';
import { ItemRenderBody } from '../utils/itemRender';

// ============================
// Константы сетки (все предметы 1x1)
// ============================
const GRID_COLS = 10;
const GRID_ROWS = 8;
const CELL_SIZE = 72; // px — backpack grid (same as equip slots)
const EQUIP_SLOT_SIZE = 72; // px — equipment slots

// D&D 5e: a character can be attuned to at most 3 magic items at once.
const MAX_ATTUNEMENT = 3;

/** Format a copper amount as the largest sensible coin (gp / sp / cp). */
function formatCoins(cp: number, t: (key: string, opts?: { value: number | string }) => string): string {
  if (cp >= 100) return t('itemValue.gp', { value: cp % 100 === 0 ? cp / 100 : (cp / 100).toFixed(1) });
  if (cp >= 10) return t('itemValue.sp', { value: cp % 10 === 0 ? cp / 10 : (cp / 10).toFixed(1) });
  return t('itemValue.cp', { value: cp });
}

// ============================
// Props
// ============================
interface InventoryGridProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

// ============================
// Утилиты для работы с сеткой (1x1)
// ============================

function buildGrid(items: InventoryItem[]): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null),
  );
  for (const item of items) {
    if (item.gridX == null || item.gridY == null) continue;
    if (item.equipped) continue;
    if (item.gridY < GRID_ROWS && item.gridX < GRID_COLS) {
      grid[item.gridY][item.gridX] = item.id;
    }
  }
  return grid;
}

function findFreePosition(grid: (string | null)[][]): { x: number; y: number } | null {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x] === null) {
        return { x, y };
      }
    }
  }
  return null;
}

// Проверяет, является ли предмет двуручным
function isItemTwoHanded(item: InventoryItem): boolean {
  const props = item.raw?.property;
  if (!Array.isArray(props)) return false;
  return props.some((p: any) => typeof p === 'string' && p.startsWith('2H'));
}

// Проверяет, блокирует ли оружие в mainhand использование offhand.
// Только двуручное оружие занимает обе руки. Полуторное (Versatile) можно
// держать одной рукой, оставляя offhand под щит (классический «меч + щит»).
function isMainhandBlocking(item: InventoryItem, equipment: Equipment, inventory: InventoryItem[]): boolean {
  const isRanged = item.equipSlot === 'rangedMainhand' || item.equipSlot === 'rangedOffhand';
  const mainId = isRanged ? equipment.rangedMainhand : equipment.mainhand;
  if (!mainId) return false;
  const mainItem = inventory.find(i => i.id === mainId);
  if (!mainItem) return false;
  return isItemTwoHanded(mainItem);
}

// Проверяет, подходит ли предмет к слоту offhand (melee или ranged)
function canItemFitOffhand(item: InventoryItem): boolean {
  // Щиты
  if (item.category === 'shield') return true;
  // Двуручное и полуторное — нельзя в offhand
  if (isItemTwoHanded(item)) return false;
  // Любое одноручное оружие (Two-Handed уже отсеяно выше) можно в offhand.
  if (item.category === 'weapon' && (item.equipSlot === 'mainhand' || item.equipSlot === 'rangedMainhand')) {
    return true;
  }
  return false;
}

// ============================
// Компонент: Детальный просмотр предмета (модал)
// ============================

const ItemDetailModal: React.FC<{ item: InventoryItem; onClose: () => void; onSell?: () => void }> = ({ item, onClose, onSell }) => {
  const { t } = useTranslation('inventory');
  const rarityColor = RARITY_COLORS[item.rarity];
  const raw = item.raw ?? {};
  const sellValueCp = Math.floor(((raw.value as number | undefined) ?? 0) / 2);
  const [EntryRendererComp, setEntryRendererComp] = useState<React.FC<any> | null>(null);

  useEffect(() => {
    import('../utils/entryRenderer').then(mod => {
      setEntryRendererComp(() => mod.EntryRenderer);
    });
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div
        className="fixed z-50 rounded-xl shadow-2xl border-2 p-5 max-w-md w-full"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-bg-primary)',
          borderColor: rarityColor,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Заголовок */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: rarityColor }}>{item.name}</h3>
            <div className="text-sm text-text-secondary">{item.type}</div>
            <div className="text-sm" style={{ color: rarityColor }}>{getRarityName(item.rarity)}</div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors ml-4">
            <X size={20} />
          </button>
        </div>

        {/* Полный рендер предмета: тип, характеристики, свойства, мастерство,
            описание и тексты свойств/мастерства — единый ItemRenderBody. */}
        {EntryRendererComp ? (
          <ItemRenderBody raw={raw} EntryRenderer={EntryRendererComp} />
        ) : (
          <div className="text-sm text-text-secondary mb-3">{t('detail.loadingEntries')}</div>
        )}
        {item.quantity > 1 && (
          <div className="text-xs text-text-muted mt-2">{t('detail.quantityLabel', { value: item.quantity })}</div>
        )}

        {/* Бонусы (магические свойства предмета) */}
        {(raw.bonusAc || raw.bonusSavingThrow || raw.bonusWeapon || raw.bonusSpellAttack || raw.bonusSpellSaveDc) && (
          <div className="mt-3 p-2 rounded-lg bg-bg-secondary text-sm space-y-1">
            {raw.bonusAc && <div><span className="text-text-secondary">{t('detail.bonusAc')}</span><span className="text-green-400">{raw.bonusAc}</span></div>}
            {raw.bonusSavingThrow && <div><span className="text-text-secondary">{t('detail.bonusSavingThrow')}</span><span className="text-green-400">{raw.bonusSavingThrow}</span></div>}
            {raw.bonusWeapon && <div><span className="text-text-secondary">{t('detail.bonusAttackDamage')}</span><span className="text-green-400">{raw.bonusWeapon}</span></div>}
            {raw.bonusSpellAttack && <div><span className="text-text-secondary">{t('detail.bonusSpellAttack')}</span><span className="text-green-400">{raw.bonusSpellAttack}</span></div>}
            {raw.bonusSpellSaveDc && <div><span className="text-text-secondary">{t('detail.bonusSpellSaveDc')}</span><span className="text-green-400">{raw.bonusSpellSaveDc}</span></div>}
          </div>
        )}

        {/* Продажа (за половину стоимости) */}
        {onSell && sellValueCp > 0 && (
          <div className="border-t border-border-default pt-3 mt-3 flex items-center justify-between">
            <span className="text-xs text-text-muted">{t('sell.label')}</span>
            <button
              onClick={onSell}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors text-sm font-semibold"
            >
              <Coins size={14} />
              {t('sell.button', { coins: formatCoins(sellValueCp, t) })}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ============================
// Компонент: Тултип предмета
// ============================
const ItemTooltip: React.FC<{ item: InventoryItem; style?: React.CSSProperties }> = ({ item, style }) => {
  const { t } = useTranslation('inventory');
  const rarityColor = RARITY_COLORS[item.rarity];
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        ...style,
        minWidth: 220,
        maxWidth: 300,
      }}
    >
      <div
        className="rounded-lg shadow-2xl border-2 p-3"
        style={{
          background: 'var(--color-bg-panel-solid)',
          borderColor: rarityColor,
        }}
      >
        <div className="font-semibold text-base mb-1" style={{ color: rarityColor }}>
          {item.name}
        </div>
        <div className="text-xs text-text-secondary mb-1">{item.type}</div>
        <div className="text-xs mb-2" style={{ color: rarityColor }}>
          {getRarityName(item.rarity)}
        </div>
        {item.description && (
          <div className="text-sm text-text-primary border-t border-border-default pt-2 mb-2">
            {item.description}
          </div>
        )}
        <div className="flex gap-3 text-xs text-text-muted">
          {item.weight != null && <span>{t('tooltip.weightLabel', { value: item.weight })}</span>}
          {item.quantity > 1 && <span>{t('tooltip.quantityLabel', { value: item.quantity })}</span>}
        </div>
      </div>
    </div>
  );
};

// ============================
// Компонент: Ячейка предмета в сетке (1x1)
// ============================
const GridItem: React.FC<{
  item: InventoryItem;
  onDragStart: (item: InventoryItem) => void;
  onRightClick: (item: InventoryItem, e: React.MouseEvent) => void;
  showTooltip: (item: InventoryItem, rect: DOMRect) => void;
  hideTooltip: () => void;
  onShowDetails?: (item: InventoryItem) => void;
}> = ({ item, onDragStart, onRightClick, showTooltip, hideTooltip }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLORS[item.rarity];
  const rarityBg = RARITY_BG_COLORS[item.rarity];

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(item);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick(item, e);
      }}
      onMouseEnter={() => {
        if (ref.current) showTooltip(item, ref.current.getBoundingClientRect());
      }}
      onMouseLeave={hideTooltip}
      className="absolute cursor-grab active:cursor-grabbing rounded-md flex items-center justify-center select-none transition-shadow hover:shadow-lg hover:shadow-black/30"
      style={{
        left: (item.gridX ?? 0) * CELL_SIZE,
        top: (item.gridY ?? 0) * CELL_SIZE,
        width: CELL_SIZE - 2,
        height: CELL_SIZE - 2,
        border: `2px solid ${rarityColor}`,
        background: rarityBg,
        zIndex: 10,
      }}
    >
      <span className="text-2xl leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
        {item.icon ? (
          <img src={item.icon} alt={item.name} className="w-8 h-8 object-contain" />
        ) : (
          item.iconPlaceholder
        )}
      </span>
      {item.quantity > 1 && (
        <span
          className="absolute bottom-0 right-0.5 text-[10px] font-bold text-text-primary"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          {item.quantity}
        </span>
      )}
    </div>
  );
};

// ============================
// Компонент: Слот экипировки
// ============================
const EquipSlot: React.FC<{
  slot: EquipmentSlot;
  item?: InventoryItem;
  notProficient?: boolean;
  onUnequip: (slot: EquipmentSlot) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (slot: EquipmentSlot) => void;
  showTooltip: (item: InventoryItem, rect: DOMRect) => void;
  hideTooltip: () => void;
  onShowDetails?: (item: InventoryItem) => void;
}> = ({ slot, item, notProficient, onUnequip, onDragOver, onDrop, showTooltip, hideTooltip, onShowDetails }) => {
  const { t } = useTranslation('inventory');
  const ref = useRef<HTMLDivElement>(null);
  const borderColor = notProficient ? '#ef4444' : (item ? RARITY_COLORS[item.rarity] : '#4b5563');
  const rarityBg = item ? RARITY_BG_COLORS[item.rarity] : 'rgba(75, 85, 99, 0.1)';

  return (
    <div
      ref={ref}
      className={`relative rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:brightness-125${notProficient ? ' ring-1 ring-red-500/50' : ''}`}
      style={{
        width: EQUIP_SLOT_SIZE,
        height: EQUIP_SLOT_SIZE,
        border: `2px solid ${borderColor}`,
        background: notProficient ? 'rgba(239, 68, 68, 0.08)' : rarityBg,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(slot);
      }}
      onClick={() => item && onUnequip(slot)}
      onContextMenu={(e) => {
        if (item && onShowDetails) {
          e.preventDefault();
          onShowDetails(item);
        }
      }}
      onMouseEnter={() => {
        if (item && ref.current) showTooltip(item, ref.current.getBoundingClientRect());
      }}
      onMouseLeave={hideTooltip}
    >
      {item ? (
        <>
          <span className="text-3xl">
            {item.icon ? (
              <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain" />
            ) : (
              item.iconPlaceholder
            )}
          </span>
          {notProficient && (
            <span className="absolute top-0.5 right-0.5 text-xs text-red-400 leading-none" title={t('noProficiency')}>✗</span>
          )}
          <div className="absolute -bottom-4 left-0 right-0 text-center">
            <span className={`text-[9px] truncate block px-0.5 ${notProficient ? 'text-red-400' : 'text-text-secondary'}`}>{item.name}</span>
          </div>
        </>
      ) : (
        <>
          <span className="text-2xl opacity-30">{EQUIPMENT_SLOT_ICONS[slot]}</span>
          <span className="text-[9px] text-text-muted mt-1">{getEquipmentSlotName(slot)}</span>
        </>
      )}
    </div>
  );
};

// ============================
// Компонент: Контекстное меню предмета
// ============================
const ItemContextMenu: React.FC<{
  item: InventoryItem;
  x: number;
  y: number;
  onClose: () => void;
  onEquip: () => void;
  onEquipOffhand: () => void;
  onUnequip: () => void;
  onDecreaseStack: (amount: number) => void;
  onRemove: () => void;
  onDetails: () => void;
  showOffhand: boolean;
}> = ({ item, x, y, onClose, onEquip, onEquipOffhand, onUnequip, onDecreaseStack, onRemove, onDetails, showOffhand }) => {
  const { t } = useTranslation('inventory');
  const [decAmount, setDecAmount] = useState(1);
  const maxDec = Math.max(1, item.quantity - 1);
  const clampedDec = Math.min(Math.max(1, decAmount), maxDec);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg shadow-2xl border border-border-default py-1 min-w-[180px]"
        style={{
          left: x,
          top: y,
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div className="px-3 py-1.5 border-b border-border-default">
          <div className="text-sm font-semibold" style={{ color: RARITY_COLORS[item.rarity] }}>
            {item.name}
          </div>
        </div>
        {item.equipSlot && !item.equipped && (
          <button
            onClick={onEquip}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 transition-colors"
          >
            {t('contextMenu.equip')}
          </button>
        )}
        {showOffhand && !item.equipped && (
          <button
            onClick={onEquipOffhand}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 transition-colors"
          >
            {t('contextMenu.equipOffhand')}
          </button>
        )}
        {item.equipped && (
          <button
            onClick={onUnequip}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 transition-colors"
          >
            {t('contextMenu.unequip')}
          </button>
        )}
        <button
          onClick={onDetails}
          className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 transition-colors border-t border-border-default"
        >
          {t('contextMenu.details')}
        </button>
        {item.quantity > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <input
              type="number"
              min={1}
              max={maxDec}
              value={clampedDec}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDecAmount(Math.min(maxDec, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-12 text-center text-sm rounded border border-border-default bg-bg-primary text-text-primary py-0.5"
            />
            <button
              onClick={() => onDecreaseStack(clampedDec)}
              className="flex-1 text-left px-2 py-0.5 text-sm text-text-primary hover:bg-white/10 rounded transition-colors"
            >
              {t('contextMenu.decreaseStack')}
            </button>
          </div>
        )}
        <button
          onClick={onRemove}
          className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          {t('contextMenu.remove')}
        </button>
      </div>
    </>
  );
};

// ============================
// Компонент: Модал добавления предмета
// ============================
const AddItemModal: React.FC<{
  onAdd: (template: ItemTemplate, quantity: number, buy: boolean) => void;
  onClose: () => void;
  currency: Character['currency'];
}> = ({ onAdd, onClose, currency }) => {
  const { t } = useTranslation('inventory');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ItemTemplate | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyMode, setBuyMode] = useState(false);
  const initialItems = getAllItemTemplatesSync();
  const [allItems, setAllItems] = useState<ItemTemplate[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length < 100);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    if (!loading) return;
    loadAllItemTemplates((partial) => {
      setAllItems(partial);
    }).then((final) => {
      setAllItems(final);
      setLoading(false);
    });
  }, []);

  const categories = ['all', ...new Set(allItems.map((i) => i.category))];

  const filtered = allItems.filter((item) => {
    const q = search.toLowerCase();
    // Ищем и по переведённому имени, и по английскому оригиналу (_origName),
    // чтобы поиск работал независимо от языка интерфейса — многие предметы
    // ещё не переведены, и в RU их можно найти только по английскому названию.
    const origName = (item.raw as { _origName?: string })._origName;
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(q) ||
      (origName ? origName.toLowerCase().includes(q) : false) ||
      item.type.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Форматирование стоимости
  const formatValue = (value?: number) => {
    if (!value) return null;
    if (value >= 100) return t('itemValue.gp', { value: Math.floor(value / 100) });
    if (value >= 10) return t('itemValue.sp', { value: Math.floor(value / 10) });
    return t('itemValue.cp', { value });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl border-2 border-gold/40 bg-bg-primary w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-xl font-medieval text-gold flex items-center gap-2">
            <Plus size={20} />
            {t('addModal.title')}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Поиск и фильтры */}
        <div className="p-4 border-b border-border-default space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDisplayLimit(50); }}
              placeholder={t('addModal.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border-default bg-bg-secondary text-text-primary placeholder-text-muted"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setDisplayLimit(50); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gold text-text-primary'
                    : 'bg-bg-panel-solid text-text-secondary hover:bg-bg-panel hover:text-text-primary'
                }`}
              >
                {cat === 'all' ? t('addModal.allCategories') : getCategoryName(cat as ItemCategory)}
              </button>
            ))}
          </div>
        </div>

        {/* Список предметов */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center text-text-muted py-2 text-xs mb-2">{t('addModal.loading')}</div>
          )}
          {filtered.length === 0 ? (
            <div className="text-center text-text-muted py-8">{t('addModal.noResults')}</div>
          ) : (
            <>
              <div className="text-xs text-text-muted mb-2">{t('addModal.itemCount', { count: filtered.length })}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filtered.slice(0, displayLimit).map((template) => {
                  const isSelected = selectedItem?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedItem(template);
                        setQuantity(1);
                      }}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-gold/40 bg-gold/10'
                          : 'border-border-default hover:border-border-hover bg-bg-panel'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="text-2xl flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center overflow-hidden"
                          style={{
                            border: `1px solid ${RARITY_COLORS[template.rarity]}`,
                            background: RARITY_BG_COLORS[template.rarity],
                          }}
                        >
                          {template.icon ? (
                            <img
                              src={template.icon}
                              alt=""
                              className="w-8 h-8 object-contain"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.textContent = template.iconPlaceholder;
                              }}
                            />
                          ) : (
                            template.iconPlaceholder
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-semibold text-sm truncate"
                            style={{ color: RARITY_COLORS[template.rarity] }}
                          >
                            {template.name}
                          </div>
                          <div className="text-xs text-text-muted">{template.type}</div>
                          <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{template.description}</div>
                          <div className="text-[10px] text-text-muted mt-1">
                            {getRarityName(template.rarity)}
                            {template.weight ? ` | ${t('weightValue', { value: template.weight })}` : ''}
                            {template.value ? ` | ${formatValue(template.value)}` : ''}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filtered.length > displayLimit && (
                <button
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="w-full mt-3 py-2 text-sm text-gold hover:text-gold/80 bg-bg-secondary/50 rounded-lg transition-colors"
                >
                  {t('addModal.showMore', { count: filtered.length - displayLimit })}
                </button>
              )}
            </>
          )}
        </div>

        {/* Нижняя панель с кнопкой добавления */}
        {selectedItem && (() => {
          const totalCostCp = (selectedItem.value ?? 0) * quantity;
          const affordable = currencyToCopper(currency) >= totalCostCp;
          const hasCost = totalCostCp > 0;
          const blocked = buyMode && hasCost && !affordable;
          return (
          <div className="p-4 border-t border-border-default flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-text-secondary">{t('addModal.quantity')}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded bg-bg-panel-solid text-text-primary hover:bg-bg-panel text-sm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center text-sm rounded border border-border-default bg-bg-secondary text-text-primary py-1"
                  min={1}
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 rounded bg-bg-panel-solid text-text-primary hover:bg-bg-panel text-sm"
                >
                  +
                </button>
              </div>
              {/* Buy toggle — deducts the cost from the character's coins */}
              <button
                onClick={() => setBuyMode(b => !b)}
                disabled={!hasCost}
                title={hasCost ? t('buy.tooltip') : t('buy.noPrice')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 ${
                  buyMode && hasCost
                    ? 'border-gold/60 bg-gold/15 text-gold'
                    : 'border-border-default text-text-muted hover:text-text-secondary'
                }`}
              >
                <Coins size={13} />
                {t('buy.deductGold')}
                {hasCost && <span className="font-semibold">{formatCoins(totalCostCp, t)}</span>}
              </button>
              {blocked && (
                <span className="text-xs text-red-bright flex items-center gap-1">
                  <AlertTriangle size={12} /> {t('buy.cantAfford')}
                </span>
              )}
            </div>
            <button
              disabled={blocked}
              onClick={() => {
                onAdd(selectedItem, quantity, buyMode && hasCost);
                setSelectedItem(null);
                setQuantity(1);
              }}
              className="px-6 py-2 bg-gold text-text-primary rounded-lg hover:bg-gold/80 font-semibold shadow-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {buyMode && hasCost ? t('buy.buyItem', { name: selectedItem.name }) : t('addModal.addItem', { name: selectedItem.name })}
            </button>
          </div>
          );
        })()}
      </div>
    </div>
  );
};

// ============================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================
export const InventoryGrid: React.FC<InventoryGridProps> = ({ character, onUpdate }) => {
  const { t } = useTranslation('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragItem, setDragItem] = useState<InventoryItem | null>(null);
  const [tooltipItem, setTooltipItem] = useState<{ item: InventoryItem; rect: DOMRect } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: InventoryItem; x: number; y: number } | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [profWarning, setProfWarning] = useState<{ itemId: string; slot: EquipmentSlot; item: InventoryItem } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Свободные заметки инвентаря (предметы вне приложения). Локальный черновик,
  // коммит в персонажа по потере фокуса — чтобы не дёргать onUpdate на каждый
  // символ. Пересинхронизируется при переключении персонажа (по id).
  const [notesDraft, setNotesDraft] = useState(character.inventoryNotes ?? '');
  useEffect(() => {
    setNotesDraft(character.inventoryNotes ?? '');
  }, [character.id]);
  const commitNotes = useCallback(() => {
    if ((character.inventoryNotes ?? '') !== notesDraft) {
      onUpdate({ ...character, inventoryNotes: notesDraft, updatedAt: new Date().toISOString() });
    }
  }, [character, notesDraft, onUpdate]);

  const equipment: Equipment = character.equipment || {};
  const inventory = character.inventory || [];

  // Предметы в рюкзаке (не экипированные, с координатами)
  const backpackItems = inventory.filter((i) => !i.equipped && i.gridX != null && i.gridY != null);
  const grid = buildGrid(inventory);

  // === Обработчики ===

  const updateInventory = useCallback(
    (newInventory: InventoryItem[], newEquipment?: Equipment, newCurrency?: Character['currency']) => {
      const updated = {
        ...character,
        inventory: newInventory,
        equipment: newEquipment ?? equipment,
        ...(newCurrency ? { currency: newCurrency } : {}),
        updatedAt: new Date().toISOString(),
      };
      // Recalculate AC and speed when equipment changes (armor affects Unarmored Defense, Fast Movement)
      if (newEquipment) {
        updated.armorClass = resolveAC(updated);
        const baseSpeed = character.speed - getClassSpeedBonus(character);
        updated.speed = baseSpeed + getClassSpeedBonus(updated);
      }
      onUpdate(updated);
    },
    [character, equipment, onUpdate],
  );

  const handleAddItem = useCallback(
    (template: ItemTemplate, quantity: number, buy = false) => {
      // When buying, deduct the total cost from the character's coins.
      const cost = buy ? (template.value ?? 0) * quantity : 0;
      const newCurrency = cost > 0 ? adjustCurrency(character.currency, -cost) : undefined;

      // Stack identical non-equippable items (potions, ammo, scrolls, …) into an
      // existing pile instead of taking a new grid cell. Equippable gear always
      // gets its own entry so each piece can be equipped separately. Identity is
      // matched on the English raw name so it stays stable across locales.
      if (!template.equipSlot) {
        const englishName = (template.raw as { name?: string } | undefined)?.name ?? template.name;
        const existing = inventory.find(
          (i) =>
            !i.equipped &&
            !i.equipSlot &&
            i.category === template.category &&
            (((i.raw as { name?: string } | undefined)?.name ?? i.name) === englishName),
        );
        if (existing) {
          updateInventory(
            inventory.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i,
            ),
            undefined,
            newCurrency,
          );
          return;
        }
      }

      const currentGrid = buildGrid(inventory);
      const pos = findFreePosition(currentGrid);
      if (!pos) {
        alert(t('noFreeSpace'));
        return;
      }

      const newItem: InventoryItem = {
        id: `${template.id}_${Date.now()}`,
        name: template.name,
        type: template.type,
        category: template.category,
        quantity,
        weight: template.weight,
        description: template.description,
        equipped: false,
        gridWidth: 1,
        gridHeight: 1,
        gridX: pos.x,
        gridY: pos.y,
        equipSlot: template.equipSlot,
        armorType: getArmorType(template),
        armorAC: getArmorAC(template),
        weaponCategory: getWeaponCategory(template),
        mastery: getWeaponMastery(template),
        rarity: template.rarity,
        icon: template.icon,
        iconPlaceholder: template.iconPlaceholder,
        raw: template.raw,
      };

      updateInventory([...inventory, newItem], undefined, newCurrency);
    },
    [inventory, updateInventory, character.currency, t],
  );

  // Sell one unit of an item for half its value; removes it (and unequips) when
  // the last unit is sold, crediting the refund to the character's coins.
  const sellItem = useCallback(
    (item: InventoryItem) => {
      const unitValue = (item.raw?.value as number | undefined) ?? 0;
      const refund = Math.floor(unitValue / 2);
      const newCurrency = refund > 0 ? adjustCurrency(character.currency, refund) : undefined;

      let newInventory: InventoryItem[];
      let newEquipment: Equipment | undefined;
      if (item.quantity > 1) {
        newInventory = inventory.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
      } else {
        newInventory = inventory.filter((i) => i.id !== item.id);
        if (item.equipped || Object.values(equipment).includes(item.id)) {
          newEquipment = { ...equipment };
          for (const k of Object.keys(newEquipment) as (keyof Equipment)[]) {
            if (newEquipment[k] === item.id) delete newEquipment[k];
          }
        }
      }
      updateInventory(newInventory, newEquipment, newCurrency);
    },
    [inventory, equipment, character.currency, updateInventory],
  );

  // Decrease a stacked item's quantity by `amount` (keeps at least one unit;
  // use "Remove" from the menu to delete the stack entirely).
  const handleDecreaseStack = useCallback(
    (itemId: string, amount: number) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item || item.quantity <= 1) return;
      const dec = Math.min(Math.max(1, Math.floor(amount)), item.quantity - 1);
      updateInventory(
        inventory.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - dec } : i)),
      );
      setContextMenu(null);
    },
    [inventory, updateInventory],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const item = inventory.find((i) => i.id === itemId);
      const newEquipment = { ...equipment };

      if (item?.equipped) {
        for (const [slot, id] of Object.entries(newEquipment)) {
          if (id === itemId) {
            delete newEquipment[slot as keyof Equipment];
          }
        }
      }

      updateInventory(
        inventory.filter((i) => i.id !== itemId),
        newEquipment,
      );
      setContextMenu(null);
    },
    [inventory, equipment, updateInventory],
  );

  // Экипировать предмет в конкретный слот
  const equipToSlot = useCallback(
    (itemId: string, targetSlot: EquipmentSlot) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;

      const newEquipment = { ...equipment };
      const currentEquippedId = newEquipment[targetSlot];

      let newInventory = [...inventory];

      // Снимаем текущий предмет из слота
      if (currentEquippedId && currentEquippedId !== itemId) {
        const tempInv = newInventory.map(i =>
          i.id === currentEquippedId ? { ...i, equipped: false, attuned: false } : i
        );
        // Exclude the item being equipped — it vacates its backpack cell.
        const currentGrid = buildGrid(tempInv.filter(i => i.id !== itemId));
        const currentItem = newInventory.find(i => i.id === currentEquippedId);
        if (currentItem) {
          const pos = findFreePosition(currentGrid);
          newInventory = newInventory.map((i) =>
            i.id === currentEquippedId
              ? { ...i, equipped: false, attuned: false, gridX: pos?.x ?? 0, gridY: pos?.y ?? 0 }
              : i,
          );
        }
      }

      // Если предмет уже был экипирован в другом слоте — снимаем
      if (item.equipped) {
        for (const [s, id] of Object.entries(newEquipment)) {
          if (id === itemId) {
            delete newEquipment[s as keyof Equipment];
          }
        }
      }

      // Двуручное/полуторное в mainhand → освобождаем offhand
      if (targetSlot === 'mainhand' && isItemTwoHanded(item)) {
        const offhandId = newEquipment.offhand;
        if (offhandId) {
          const tempInv2 = newInventory.map(i => i.id === offhandId ? { ...i, equipped: false, attuned: false } : i);
          const grid2 = buildGrid(tempInv2.filter(i => i.id !== itemId));
          const pos2 = findFreePosition(grid2);
          newInventory = newInventory.map(i =>
            i.id === offhandId ? { ...i, equipped: false, attuned: false, gridX: pos2?.x ?? 0, gridY: pos2?.y ?? 0 } : i,
          );
          delete newEquipment.offhand;
        }
      }
      if (targetSlot === 'rangedMainhand' && isItemTwoHanded(item)) {
        const offhandId = newEquipment.rangedOffhand;
        if (offhandId) {
          const tempInv2 = newInventory.map(i => i.id === offhandId ? { ...i, equipped: false, attuned: false } : i);
          const grid2 = buildGrid(tempInv2.filter(i => i.id !== itemId));
          const pos2 = findFreePosition(grid2);
          newInventory = newInventory.map(i =>
            i.id === offhandId ? { ...i, equipped: false, attuned: false, gridX: pos2?.x ?? 0, gridY: pos2?.y ?? 0 } : i,
          );
          delete newEquipment.rangedOffhand;
        }
      }

      // Экипируем. Предметы, требующие настройку, авто-настраиваются, но соблюдаем
      // лимит D&D 5e в 3 настроенных предмета: при достижении лимита вещь надевается
      // без настройки (магические бонусы не применяются — см. getEquippedItemBonuses).
      newEquipment[targetSlot] = itemId;
      const attunedCount = newInventory.filter(i => i.id !== itemId && i.attuned).length;
      const canAttune = !!item.raw?.reqAttune && attunedCount < MAX_ATTUNEMENT;
      newInventory = newInventory.map((i) =>
        i.id === itemId ? { ...i, equipped: true, attuned: canAttune, gridX: undefined, gridY: undefined } : i,
      );

      updateInventory(newInventory, newEquipment);
      setContextMenu(null);
    },
    [inventory, equipment, updateInventory],
  );

  // Проверка владения перед экипировкой
  const tryEquipToSlot = useCallback(
    (itemId: string, targetSlot: EquipmentSlot) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;

      if (!hasItemProficiency(character, item)) {
        setProfWarning({ itemId, slot: targetSlot, item });
        return;
      }

      equipToSlot(itemId, targetSlot);
    },
    [inventory, character, equipToSlot],
  );

  const handleEquipItem = useCallback(
    (itemId: string) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item || !item.equipSlot) return;

      let targetSlot: EquipmentSlot = item.equipSlot;

      // Для аксессуаров: находим первый свободный слот
      if (targetSlot === 'accessory1' || targetSlot === 'accessory2' || targetSlot === 'accessory3') {
        if (!equipment.accessory1 || equipment.accessory1 === itemId) {
          targetSlot = 'accessory1';
        } else if (!equipment.accessory2 || equipment.accessory2 === itemId) {
          targetSlot = 'accessory2';
        } else {
          targetSlot = 'accessory3';
        }
      }

      tryEquipToSlot(itemId, targetSlot);
    },
    [inventory, equipment, tryEquipToSlot],
  );

  const handleEquipOffhand = useCallback(
    (itemId: string) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;
      if (isMainhandBlocking(item, equipment, inventory)) return;
      // Ranged weapons go to ranged offhand
      const isRangedItem = item.equipSlot === 'rangedMainhand' || item.equipSlot === 'rangedOffhand';
      tryEquipToSlot(itemId, isRangedItem ? 'rangedOffhand' : 'offhand');
    },
    [inventory, equipment, tryEquipToSlot],
  );

  const handleUnequipItem = useCallback(
    (slot: EquipmentSlot) => {
      const itemId = equipment[slot];
      if (!itemId) return;

      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;

      const currentGrid = buildGrid(inventory);
      const pos = findFreePosition(currentGrid);
      if (!pos) {
        alert(t('noFreeSpace'));
        return;
      }

      const newEquipment = { ...equipment };
      delete newEquipment[slot];

      const newInventory = inventory.map((i) =>
        i.id === itemId ? { ...i, equipped: false, attuned: false, gridX: pos.x, gridY: pos.y } : i,
      );

      updateInventory(newInventory, newEquipment);
      setContextMenu(null);
    },
    [inventory, equipment, updateInventory],
  );

  // Drag & Drop на сетку рюкзака
  const handleGridDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragItem || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const cellX = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((e.clientX - rect.left) / CELL_SIZE)));
      const cellY = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((e.clientY - rect.top) / CELL_SIZE)));

      const currentGrid = buildGrid(inventory);

      // Проверяем что ячейка свободна (или занята этим же предметом)
      const occupant = currentGrid[cellY][cellX];
      if (occupant !== null && occupant !== dragItem.id) {
        setDragItem(null);
        return;
      }

      // Если предмет был экипирован — снимаем
      const newEquipment = { ...equipment };
      if (dragItem.equipped) {
        for (const [slot, id] of Object.entries(newEquipment)) {
          if (id === dragItem.id) {
            delete newEquipment[slot as keyof Equipment];
          }
        }
      }

      const newInventory = inventory.map((i) =>
        i.id === dragItem.id
          ? { ...i, gridX: cellX, gridY: cellY, equipped: false }
          : i,
      );

      updateInventory(newInventory, newEquipment);
      setDragItem(null);
    },
    [dragItem, inventory, equipment, updateInventory],
  );

  // Drag & Drop на слот экипировки
  const handleEquipSlotDrop = useCallback(
    (slot: EquipmentSlot) => {
      if (!dragItem) return;

      // Проверяем совместимость предмета со слотом
      if (!canDragToSlot(dragItem, slot, equipment, inventory)) return;

      tryEquipToSlot(dragItem.id, slot);
      setDragItem(null);
    },
    [dragItem, tryEquipToSlot],
  );

  const showTooltipFn = useCallback((item: InventoryItem, rect: DOMRect) => {
    setTooltipItem({ item, rect });
  }, []);

  const hideTooltipFn = useCallback(() => {
    setTooltipItem(null);
  }, []);

  // Получить предмет экипировки по слоту
  const getEquippedItem = (slot: EquipmentSlot): InventoryItem | undefined => {
    const itemId = equipment[slot];
    if (!itemId) return undefined;
    return inventory.find((i) => i.id === itemId);
  };

  // Общий вес инвентаря и грузоподъёмность (Сила × 15, с учётом предметов на Силу)
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
  const carryCapacity = getEffectiveAbilityScores(character).strength * 15;
  const overCapacity = totalWeight > carryCapacity;
  // Число настроенных предметов (лимит — 3)
  const attunedCount = inventory.reduce((n, item) => n + (item.attuned ? 1 : 0), 0);

  // Группы слотов экипировки
  const armorSlots: EquipmentSlot[] = ['helmet', 'cloak', 'armor', 'gloves', 'boots'];
  const accessorySlots: EquipmentSlot[] = ['accessory1', 'accessory2', 'accessory3'];
  const meleeSlots: EquipmentSlot[] = ['mainhand', 'offhand'];
  const rangedSlots: EquipmentSlot[] = ['rangedMainhand', 'rangedOffhand'];

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Backpack className="text-gold" size={24} />
          <h2 className="text-xl font-medieval text-gold">{t('title')}</h2>
          <span
            className={`text-xs ml-1 ${overCapacity ? 'text-red-bright font-semibold' : 'text-text-muted'}`}
            title={t('capacity.tooltip', { capacity: carryCapacity })}
          >
            {t('weight')} {t('weightValue', { value: totalWeight.toFixed(1) })}
            <span className="text-text-muted/70"> / {t('weightValue', { value: carryCapacity })}</span>
          </span>
          {overCapacity && (
            <span className="text-xs text-red-bright flex items-center gap-1" title={t('capacity.overTooltip')}>
              <AlertTriangle size={12} /> {t('capacity.overloaded')}
            </span>
          )}
          {attunedCount > 0 && (
            <span
              className={`text-xs ml-1 ${attunedCount >= MAX_ATTUNEMENT ? 'text-gold' : 'text-text-muted'}`}
              title={t('attunement.tooltip')}
            >
              {t('attunement.label')} {attunedCount}/{MAX_ATTUNEMENT}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 flex items-center gap-1.5 font-semibold transition-colors text-sm"
        >
          <Plus size={14} />
          {t('addButton')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* === Левая часть: Экипировка === */}
        <div className="glass-panel p-5 flex-shrink-0" style={{ minWidth: 420 }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-text-secondary" size={18} />
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('equipment')}</h3>
          </div>

          {/* Верхняя часть: броня (лево) + аксессуары (право) */}
          <div className="flex justify-between">
            {/* Левая колонка: броня */}
            <div className="flex flex-col gap-3">
              {armorSlots.map(slot => (
                <EquipSlot
                  key={slot}
                  slot={slot}
                  item={getEquippedItem(slot)}
                  notProficient={(() => {
                    const eqItem = getEquippedItem(slot);
                    return eqItem ? !hasItemProficiency(character, eqItem) : false;
                  })()}
                  onUnequip={handleUnequipItem}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEquipSlotDrop(slot)}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                  onShowDetails={setDetailItem}
                />
              ))}
            </div>
            {/* Правая колонка: аксессуары */}
            <div className="flex flex-col gap-3">
              {accessorySlots.map(slot => (
                <EquipSlot
                  key={slot}
                  slot={slot}
                  item={getEquippedItem(slot)}
                  notProficient={(() => {
                    const eqItem = getEquippedItem(slot);
                    return eqItem ? !hasItemProficiency(character, eqItem) : false;
                  })()}
                  onUnequip={handleUnequipItem}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEquipSlotDrop(slot)}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                  onShowDetails={setDetailItem}
                />
              ))}
            </div>
          </div>

          {/* Нижняя часть: оружие */}
          <div className="flex justify-between mt-3 pt-3 border-t border-border-default">
            {/* Левый: ближний бой */}
            <div className="flex gap-3">
              {meleeSlots.map(slot => (
                <EquipSlot
                  key={slot}
                  slot={slot}
                  item={getEquippedItem(slot)}
                  notProficient={(() => {
                    const eqItem = getEquippedItem(slot);
                    return eqItem ? !hasItemProficiency(character, eqItem) : false;
                  })()}
                  onUnequip={handleUnequipItem}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEquipSlotDrop(slot)}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                  onShowDetails={setDetailItem}
                />
              ))}
            </div>
            {/* Правый: дальний бой (offhand, mainhand — справа налево) */}
            <div className="flex gap-3">
              {rangedSlots.map(slot => (
                <EquipSlot
                  key={slot}
                  slot={slot}
                  item={getEquippedItem(slot)}
                  notProficient={(() => {
                    const eqItem = getEquippedItem(slot);
                    return eqItem ? !hasItemProficiency(character, eqItem) : false;
                  })()}
                  onUnequip={handleUnequipItem}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEquipSlotDrop(slot)}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                  onShowDetails={setDetailItem}
                />
              ))}
            </div>
          </div>

          {/* Зелья */}
          {inventory.filter(i => i.category === 'potion').length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-default text-xs text-text-secondary flex items-center gap-2">
              <FlaskConical size={12} />
              <span>{t('potions.label')} <span className="text-text-primary font-semibold">{inventory.filter(i => i.category === 'potion').reduce((s, i) => s + i.quantity, 0)}</span></span>
            </div>
          )}
        </div>

        {/* === Правая часть: Сетка рюкзака === */}
        <div className="glass-panel p-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-text-secondary" size={18} />
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('backpack')}</h3>
            <span className="text-xs text-text-muted ml-auto">
              {t('cellsCount', { count: backpackItems.length, total: GRID_COLS * GRID_ROWS })}
            </span>
          </div>

          {/* Сетка */}
          <div className="overflow-x-auto">
            <div
              ref={gridRef}
              className="relative select-none"
              style={{
                width: GRID_COLS * CELL_SIZE,
                height: GRID_ROWS * CELL_SIZE,
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleGridDrop}
            >
              {/* Ячейки фона */}
              {Array.from({ length: GRID_ROWS }).map((_, y) =>
                Array.from({ length: GRID_COLS }).map((_, x) => (
                  <div
                    key={`${x}-${y}`}
                    className="absolute rounded-sm"
                    style={{
                      left: x * CELL_SIZE,
                      top: y * CELL_SIZE,
                      width: CELL_SIZE - 2,
                      height: CELL_SIZE - 2,
                      border: '1px solid rgba(75, 85, 99, 0.3)',
                      background:
                        grid[y][x] !== null
                          ? 'rgba(75, 85, 99, 0.05)'
                          : 'rgba(30, 30, 50, 0.5)',
                    }}
                  />
                )),
              )}

              {/* Предметы */}
              {backpackItems.map((item) => (
                <GridItem
                  key={item.id}
                  item={item}
                  onDragStart={setDragItem}
                  onRightClick={(itm, e) => {
                    setContextMenu({ item: itm, x: e.clientX, y: e.clientY });
                    hideTooltipFn();
                  }}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                  onShowDetails={setDetailItem}
                />
              ))}

              {/* Пустая сетка — подсказка */}
              {backpackItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <Backpack className="mx-auto text-text-muted/30 mb-2" size={48} />
                    <div className="text-text-muted text-sm">{t('backpackEmpty')}</div>
                    <div className="text-text-muted/50 text-xs mt-1">{t('backpackHint')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Прочие предметы и заметки — для вещей, которых нет в приложении */}
          <div className="mt-4 pt-3 border-t border-border-default">
            <div className="flex items-center gap-2 mb-2">
              <NotebookPen className="text-text-secondary" size={16} />
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('customNotes.title')}</h3>
            </div>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              placeholder={t('customNotes.placeholder')}
              rows={5}
              className="w-full resize-y rounded-lg border border-border-default bg-bg-secondary text-text-primary text-sm p-2.5 placeholder:text-text-muted/60 focus:outline-none focus:border-gold/40"
            />
          </div>
        </div>
      </div>

      {/* Валюта */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="text-gold" size={16} />
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('currency.title')}</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {([
            { key: 'platinum' as const, label: t('currency.platinum'), color: '#e5e7eb' },
            { key: 'gold' as const, label: t('currency.gold'), color: '#fbbf24' },
            { key: 'electrum' as const, label: t('currency.electrum'), color: '#a3a3a3' },
            { key: 'silver' as const, label: t('currency.silver'), color: '#d1d5db' },
            { key: 'copper' as const, label: t('currency.copper'), color: '#d97706' },
          ]).map(({ key, label, color }) => (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-2.5 py-1.5"
            >
              <span className="text-xs text-text-muted">{label}</span>
              <input
                type="number"
                value={character.currency[key]}
                onChange={(e) => {
                  onUpdate({
                    ...character,
                    currency: {
                      ...character.currency,
                      [key]: Math.max(0, parseInt(e.target.value) || 0),
                    },
                    updatedAt: new Date().toISOString(),
                  });
                }}
                className="w-14 text-center text-sm font-semibold rounded border border-border-default bg-bg-secondary text-text-primary py-0.5"
                style={{ color }}
                min={0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Тултип */}
      {tooltipItem && (
        <ItemTooltip
          item={tooltipItem.item}
          style={{
            left: tooltipItem.rect.right + 8,
            top: tooltipItem.rect.top,
            position: 'fixed',
          }}
        />
      )}

      {/* Контекстное меню */}
      {contextMenu && (
        <ItemContextMenu
          item={contextMenu.item}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEquip={() => handleEquipItem(contextMenu.item.id)}
          onEquipOffhand={() => handleEquipOffhand(contextMenu.item.id)}
          onUnequip={() => {
            const slot = Object.entries(equipment).find(([, id]) => id === contextMenu.item.id)?.[0] as EquipmentSlot | undefined;
            if (slot) handleUnequipItem(slot);
            setContextMenu(null);
          }}
          onDecreaseStack={(amount) => handleDecreaseStack(contextMenu.item.id, amount)}
          onRemove={() => handleRemoveItem(contextMenu.item.id)}
          onDetails={() => { setDetailItem(contextMenu.item); setContextMenu(null); }}
          showOffhand={canItemFitOffhand(contextMenu.item) && !isMainhandBlocking(contextMenu.item, equipment, inventory)}
        />
      )}

      {/* Предупреждение о невладении */}
      {profWarning && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setProfWarning(null)}>
            <div
              className="rounded-xl border-2 border-red-500/50 shadow-2xl p-5 max-w-sm mx-4"
              style={{ background: 'var(--color-bg-secondary)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 text-xl">⚠️</span>
                <h3 className="text-red-400 font-semibold text-lg">{t('profWarning.title')}</h3>
              </div>
              <p className="text-text-secondary text-sm mb-2">
                {t('profWarning.descriptionText')} <span className="text-text-primary font-semibold">{profWarning.item.name}</span>.
              </p>
              <p className="text-text-muted text-xs mb-4">
                {profWarning.item.armorType
                  ? t('profWarning.armorPenalty')
                  : t('profWarning.weaponPenalty')}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setProfWarning(null)}
                  className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-white/5 text-sm transition-colors"
                >
                  {t('profWarning.cancel')}
                </button>
                <button
                  onClick={() => {
                    equipToSlot(profWarning.itemId, profWarning.slot);
                    setProfWarning(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
                >
                  {t('profWarning.equipAnyway')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Модал добавления */}
      {showAddModal && (
        <AddItemModal
          onAdd={(template, quantity, buy) => {
            handleAddItem(template, quantity, buy);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
          currency={character.currency}
        />
      )}

      {/* Детали предмета */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onSell={() => { sellItem(detailItem); setDetailItem(null); }}
        />
      )}
    </div>
  );
};

// === Утилита: проверка совместимости drag-and-drop со слотом ===

function canDragToSlot(item: InventoryItem, slot: EquipmentSlot, equipment?: Equipment, inventory?: InventoryItem[]): boolean {
  // Offhand: щиты + одноручное оружие (melee), не двуручное/полуторное
  if (slot === 'offhand') {
    if (!canItemFitOffhand(item)) return false;
    if (equipment && inventory && isMainhandBlocking(item, equipment, inventory)) return false;
    return true;
  }

  // Mainhand: melee оружие
  if (slot === 'mainhand') {
    if (item.category !== 'weapon') return false;
    // Ranged weapons go to ranged slots
    return item.equipSlot === 'mainhand' || item.equipSlot === 'offhand';
  }

  // Ranged mainhand: ranged оружие
  if (slot === 'rangedMainhand') {
    if (item.category !== 'weapon') return false;
    return item.equipSlot === 'rangedMainhand' || item.equipSlot === 'rangedOffhand';
  }

  // Ranged offhand: одноручное дальнобойное оружие
  if (slot === 'rangedOffhand') {
    if (item.category !== 'weapon') return false;
    if (item.equipSlot !== 'rangedMainhand' && item.equipSlot !== 'rangedOffhand') return false;
    if (isItemTwoHanded(item)) return false;
    if (equipment && inventory && isMainhandBlocking(item, equipment, inventory)) return false;
    return true;
  }

  // Аксессуары: любой предмет с accessory equipSlot
  if (slot === 'accessory1' || slot === 'accessory2' || slot === 'accessory3') {
    return item.equipSlot === 'accessory1' || item.equipSlot === 'accessory2' || item.equipSlot === 'accessory3';
  }

  // Прямое совпадение слота
  if (item.equipSlot === slot) return true;

  // Доспехи
  if (slot === 'armor' && item.category === 'armor') return true;

  return false;
}
