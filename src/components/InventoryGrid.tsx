import React, { useState, useCallback, useRef } from 'react';
import type { Character, InventoryItem, EquipmentSlot, Equipment } from '../types';
import {
  ITEM_TEMPLATES,
  RARITY_COLORS,
  RARITY_BG_COLORS,
  RARITY_NAMES,
  EQUIPMENT_SLOT_NAMES,
  EQUIPMENT_SLOT_ICONS,
  CATEGORY_NAMES,
  type ItemTemplate,
} from '../data/items';
import { Backpack, Plus, X, Search, Package, Sword, Shield, FlaskConical } from 'lucide-react';

// ============================
// Константы сетки
// ============================
const GRID_COLS = 10;
const GRID_ROWS = 8;
const CELL_SIZE = 56; // px

// ============================
// Props
// ============================
interface InventoryGridProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

// ============================
// Утилиты для работы с сеткой
// ============================

function canPlaceItem(
  grid: (string | null)[][],
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreItemId?: string,
): boolean {
  if (x < 0 || y < 0 || x + w > GRID_COLS || y + h > GRID_ROWS) return false;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cellId = grid[y + dy]?.[x + dx];
      if (cellId !== null && cellId !== ignoreItemId) return false;
    }
  }
  return true;
}

function buildGrid(items: InventoryItem[]): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null),
  );
  for (const item of items) {
    if (item.gridX == null || item.gridY == null) continue;
    if (item.equipped) continue;
    for (let dy = 0; dy < item.gridHeight; dy++) {
      for (let dx = 0; dx < item.gridWidth; dx++) {
        const gy = item.gridY + dy;
        const gx = item.gridX + dx;
        if (gy < GRID_ROWS && gx < GRID_COLS) {
          grid[gy][gx] = item.id;
        }
      }
    }
  }
  return grid;
}

function findFreePosition(
  grid: (string | null)[][],
  w: number,
  h: number,
): { x: number; y: number } | null {
  for (let y = 0; y <= GRID_ROWS - h; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      if (canPlaceItem(grid, x, y, w, h)) {
        return { x, y };
      }
    }
  }
  return null;
}

// ============================
// Компонент: Тултип предмета
// ============================
const ItemTooltip: React.FC<{ item: InventoryItem; style?: React.CSSProperties }> = ({ item, style }) => {
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
          background: '#1a1a2e',
          borderColor: rarityColor,
        }}
      >
        <div className="font-semibold text-base mb-1" style={{ color: rarityColor }}>
          {item.name}
        </div>
        <div className="text-xs text-gray-400 mb-1">{item.type}</div>
        <div className="text-xs mb-2" style={{ color: rarityColor }}>
          {RARITY_NAMES[item.rarity]}
        </div>
        {item.description && (
          <div className="text-sm text-gray-300 border-t border-gray-700 pt-2 mb-2">
            {item.description}
          </div>
        )}
        <div className="flex gap-3 text-xs text-gray-500">
          {item.weight != null && <span>Вес: {item.weight} фнт.</span>}
          {item.quantity > 1 && <span>Кол-во: {item.quantity}</span>}
        </div>
      </div>
    </div>
  );
};

// ============================
// Компонент: Ячейка предмета в сетке
// ============================
const GridItem: React.FC<{
  item: InventoryItem;
  onDragStart: (item: InventoryItem) => void;
  onRightClick: (item: InventoryItem, e: React.MouseEvent) => void;
  showTooltip: (item: InventoryItem, rect: DOMRect) => void;
  hideTooltip: () => void;
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
        width: item.gridWidth * CELL_SIZE - 2,
        height: item.gridHeight * CELL_SIZE - 2,
        border: `2px solid ${rarityColor}`,
        background: rarityBg,
        zIndex: 10,
      }}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <span className="text-2xl leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
          {item.icon ? (
            <img src={item.icon} alt={item.name} className="w-8 h-8 object-contain" />
          ) : (
            item.iconPlaceholder
          )}
        </span>
        {(item.gridWidth > 1 || item.gridHeight > 1) && (
          <span className="text-[9px] text-gray-300 truncate max-w-full px-1 leading-tight">
            {item.name}
          </span>
        )}
      </div>
      {item.quantity > 1 && (
        <span
          className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white"
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
  onEquip: (slot: EquipmentSlot) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (slot: EquipmentSlot) => void;
  showTooltip: (item: InventoryItem, rect: DOMRect) => void;
  hideTooltip: () => void;
}> = ({ slot, item, onEquip, onUnequip, onDragOver, onDrop, showTooltip, hideTooltip }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rarityColor = item ? RARITY_COLORS[item.rarity] : '#4b5563';
  const rarityBg = item ? RARITY_BG_COLORS[item.rarity] : 'rgba(75, 85, 99, 0.1)';

  return (
    <div
      ref={ref}
      className="relative rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:brightness-125 group"
      style={{
        width: CELL_SIZE + 8,
        height: CELL_SIZE + 8,
        border: `2px solid ${rarityColor}`,
        background: rarityBg,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(slot);
      }}
      onClick={() => (item ? onUnequip(slot) : onEquip(slot))}
      onMouseEnter={() => {
        if (item && ref.current) showTooltip(item, ref.current.getBoundingClientRect());
      }}
      onMouseLeave={hideTooltip}
    >
      {item ? (
        <>
          <span className="text-2xl">
            {item.icon ? (
              <img src={item.icon} alt={item.name} className="w-8 h-8 object-contain" />
            ) : (
              item.iconPlaceholder
            )}
          </span>
          <div className="absolute -bottom-4 left-0 right-0 text-center">
            <span className="text-[8px] text-gray-400 truncate block px-0.5">{item.name}</span>
          </div>
        </>
      ) : (
        <>
          <span className="text-lg opacity-30">{EQUIPMENT_SLOT_ICONS[slot]}</span>
          <span className="text-[8px] text-gray-600 mt-0.5">{EQUIPMENT_SLOT_NAMES[slot]}</span>
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
  onUnequip: () => void;
  onRemove: () => void;
}> = ({ item, x, y, onClose, onEquip, onUnequip, onRemove }) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg shadow-2xl border border-gray-700 py-1 min-w-[160px]"
        style={{
          left: x,
          top: y,
          background: '#1a1a2e',
        }}
      >
        <div className="px-3 py-1.5 border-b border-gray-700">
          <div className="text-sm font-semibold" style={{ color: RARITY_COLORS[item.rarity] }}>
            {item.name}
          </div>
        </div>
        {item.equipSlot && !item.equipped && (
          <button
            onClick={onEquip}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
          >
            Экипировать
          </button>
        )}
        {item.equipped && (
          <button
            onClick={onUnequip}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
          >
            Снять
          </button>
        )}
        <button
          onClick={onRemove}
          className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Удалить
        </button>
      </div>
    </>
  );
};

// ============================
// Компонент: Модал добавления предмета
// ============================
const AddItemModal: React.FC<{
  onAdd: (template: ItemTemplate, quantity: number) => void;
  onClose: () => void;
}> = ({ onAdd, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ItemTemplate | null>(null);
  const [quantity, setQuantity] = useState(1);

  const categories = ['all', ...new Set(ITEM_TEMPLATES.map((i) => i.category))];

  const filtered = ITEM_TEMPLATES.filter((item) => {
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.type.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-xl border-2 border-dnd-secondary w-full max-w-3xl max-h-[85vh] flex flex-col"
        style={{ background: '#0f0f23' }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-medieval text-dnd-secondary flex items-center gap-2">
            <Plus size={20} />
            Добавить предмет
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Поиск и фильтры */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск предметов..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-700 text-white placeholder-gray-500"
              style={{ background: '#1a1a2e' }}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-dnd-secondary text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {cat === 'all' ? 'Все' : CATEGORY_NAMES[cat as keyof typeof CATEGORY_NAMES] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Список предметов */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Предметы не найдены</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((template) => {
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
                        ? 'border-dnd-secondary bg-dnd-secondary/10'
                        : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="text-2xl flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center"
                        style={{
                          border: `1px solid ${RARITY_COLORS[template.rarity]}`,
                          background: RARITY_BG_COLORS[template.rarity],
                        }}
                      >
                        {template.iconPlaceholder}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-semibold text-sm truncate"
                          style={{ color: RARITY_COLORS[template.rarity] }}
                        >
                          {template.name}
                        </div>
                        <div className="text-xs text-gray-500">{template.type}</div>
                        <div className="text-xs text-gray-600 mt-0.5 truncate">{template.description}</div>
                        <div className="text-[10px] text-gray-600 mt-1">
                          {template.gridWidth}×{template.gridHeight} | {RARITY_NAMES[template.rarity]}
                          {template.weight ? ` | ${template.weight} фнт.` : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Нижняя панель с кнопкой добавления */}
        {selectedItem && (
          <div className="p-4 border-t border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Количество:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center text-sm rounded border border-gray-700 text-white py-1"
                  style={{ background: '#1a1a2e' }}
                  min={1}
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                onAdd(selectedItem, quantity);
                setSelectedItem(null);
                setQuantity(1);
              }}
              className="px-6 py-2 bg-dnd-secondary text-white rounded-lg hover:bg-dnd-secondary/80 font-semibold shadow-lg transition-colors"
            >
              Добавить {selectedItem.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================
export const InventoryGrid: React.FC<InventoryGridProps> = ({ character, onUpdate }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragItem, setDragItem] = useState<InventoryItem | null>(null);
  const [tooltipItem, setTooltipItem] = useState<{ item: InventoryItem; rect: DOMRect } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: InventoryItem; x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const equipment: Equipment = character.equipment || {};
  const inventory = character.inventory || [];

  // Предметы в рюкзаке (не экипированные, с координатами)
  const backpackItems = inventory.filter((i) => !i.equipped && i.gridX != null && i.gridY != null);
  const grid = buildGrid(inventory);

  // === Обработчики ===

  const updateInventory = useCallback(
    (newInventory: InventoryItem[], newEquipment?: Equipment) => {
      onUpdate({
        ...character,
        inventory: newInventory,
        equipment: newEquipment ?? equipment,
        updatedAt: new Date().toISOString(),
      });
    },
    [character, equipment, onUpdate],
  );

  const handleAddItem = useCallback(
    (template: ItemTemplate, quantity: number) => {
      const currentGrid = buildGrid(inventory);
      const pos = findFreePosition(currentGrid, template.gridWidth, template.gridHeight);
      if (!pos) {
        alert('Нет свободного места в рюкзаке!');
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
        gridWidth: template.gridWidth,
        gridHeight: template.gridHeight,
        gridX: pos.x,
        gridY: pos.y,
        equipSlot: template.equipSlot,
        rarity: template.rarity,
        iconPlaceholder: template.iconPlaceholder,
      };

      updateInventory([...inventory, newItem]);
    },
    [inventory, updateInventory],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const item = inventory.find((i) => i.id === itemId);
      const newEquipment = { ...equipment };

      // Снять предмет из слота экипировки если он экипирован
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

  const handleEquipItem = useCallback(
    (itemId: string) => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item || !item.equipSlot) return;

      let targetSlot: EquipmentSlot = item.equipSlot;

      // Для колец: если ring1 занят, пробуем ring2
      if (item.category === 'ring') {
        if (equipment.ring1 && equipment.ring1 !== itemId) {
          targetSlot = 'ring2';
        } else {
          targetSlot = 'ring1';
        }
      }

      const newEquipment = { ...equipment };
      const currentEquippedId = newEquipment[targetSlot];

      // Снимаем текущий предмет из слота (возвращаем в рюкзак)
      let newInventory = [...inventory];
      if (currentEquippedId && currentEquippedId !== itemId) {
        const currentGrid = buildGrid(newInventory.map(i =>
          i.id === currentEquippedId ? { ...i, equipped: false } : i
        ));
        const currentItem = newInventory.find(i => i.id === currentEquippedId);
        if (currentItem) {
          const pos = findFreePosition(currentGrid, currentItem.gridWidth, currentItem.gridHeight);
          newInventory = newInventory.map((i) =>
            i.id === currentEquippedId
              ? { ...i, equipped: false, gridX: pos?.x ?? 0, gridY: pos?.y ?? 0 }
              : i,
          );
        }
      }

      // Экипируем новый предмет
      newEquipment[targetSlot] = itemId;
      newInventory = newInventory.map((i) =>
        i.id === itemId ? { ...i, equipped: true, gridX: undefined, gridY: undefined } : i,
      );

      updateInventory(newInventory, newEquipment);
      setContextMenu(null);
    },
    [inventory, equipment, updateInventory],
  );

  const handleUnequipItem = useCallback(
    (slot: EquipmentSlot) => {
      const itemId = equipment[slot];
      if (!itemId) return;

      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;

      const currentGrid = buildGrid(inventory);
      const pos = findFreePosition(currentGrid, item.gridWidth, item.gridHeight);
      if (!pos) {
        alert('Нет свободного места в рюкзаке!');
        return;
      }

      const newEquipment = { ...equipment };
      delete newEquipment[slot];

      const newInventory = inventory.map((i) =>
        i.id === itemId ? { ...i, equipped: false, gridX: pos.x, gridY: pos.y } : i,
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
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const cellX = Math.floor(rawX / CELL_SIZE);
      const cellY = Math.floor(rawY / CELL_SIZE);

      // Центрируем предмет
      const placeX = Math.max(0, Math.min(cellX - Math.floor(dragItem.gridWidth / 2), GRID_COLS - dragItem.gridWidth));
      const placeY = Math.max(0, Math.min(cellY - Math.floor(dragItem.gridHeight / 2), GRID_ROWS - dragItem.gridHeight));

      const currentGrid = buildGrid(inventory);

      if (!canPlaceItem(currentGrid, placeX, placeY, dragItem.gridWidth, dragItem.gridHeight, dragItem.id)) {
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
          ? { ...i, gridX: placeX, gridY: placeY, equipped: false }
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

      // Проверяем что предмет подходит к слоту
      if (!dragItem.equipSlot) return;

      const slotCategory = slot.replace(/[12]$/, ''); // ring1 -> ring
      const itemSlotCategory = dragItem.equipSlot.replace(/[12]$/, '');
      if (slotCategory !== itemSlotCategory && !(dragItem.category === 'shield' && slot === 'offhand')) return;

      const newEquipment = { ...equipment };
      const currentEquippedId = newEquipment[slot];

      let newInventory = [...inventory];

      // Снимаем текущий предмет из слота
      if (currentEquippedId && currentEquippedId !== dragItem.id) {
        const currentGrid = buildGrid(newInventory.map(i =>
          i.id === currentEquippedId ? { ...i, equipped: false } : i
        ));
        const currentItem = newInventory.find(i => i.id === currentEquippedId);
        if (currentItem) {
          const pos = findFreePosition(currentGrid, currentItem.gridWidth, currentItem.gridHeight);
          if (!pos) {
            alert('Нет свободного места в рюкзаке!');
            setDragItem(null);
            return;
          }
          newInventory = newInventory.map((i) =>
            i.id === currentEquippedId
              ? { ...i, equipped: false, gridX: pos.x, gridY: pos.y }
              : i,
          );
        }
      }

      // Если предмет перетаскивается из другого слота
      if (dragItem.equipped) {
        for (const [s, id] of Object.entries(newEquipment)) {
          if (id === dragItem.id) {
            delete newEquipment[s as keyof Equipment];
          }
        }
      }

      // Экипируем предмет
      newEquipment[slot] = dragItem.id;
      newInventory = newInventory.map((i) =>
        i.id === dragItem.id ? { ...i, equipped: true, gridX: undefined, gridY: undefined } : i,
      );

      updateInventory(newInventory, newEquipment);
      setDragItem(null);
    },
    [dragItem, inventory, equipment, updateInventory],
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

  // Общий вес инвентаря
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);

  // Слоты экипировки в порядке отображения
  const equipmentLayout: { slot: EquipmentSlot; row: number; col: number }[] = [
    { slot: 'helmet', row: 0, col: 1 },
    { slot: 'amulet', row: 0, col: 2 },
    { slot: 'cloak', row: 0, col: 0 },
    { slot: 'armor', row: 1, col: 1 },
    { slot: 'gloves', row: 1, col: 0 },
    { slot: 'ring1', row: 1, col: 2 },
    { slot: 'mainhand', row: 2, col: 0 },
    { slot: 'boots', row: 2, col: 1 },
    { slot: 'offhand', row: 2, col: 2 },
    { slot: 'ring2', row: 3, col: 1 },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Backpack className="text-dnd-secondary" size={28} />
          <h2 className="text-2xl font-medieval text-dnd-secondary">Инвентарь</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Вес: <span className="text-white font-semibold">{totalWeight.toFixed(1)} фнт.</span>
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-dnd-secondary text-white rounded-lg hover:bg-dnd-secondary/80 flex items-center gap-2 font-semibold shadow-lg transition-colors text-sm"
          >
            <Plus size={16} />
            Добавить предмет
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* === Левая часть: Экипировка (как в BG3) === */}
        <div
          className="rounded-xl border-2 border-gray-700 p-5 flex-shrink-0"
          style={{ background: '#0f0f23' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-gray-400" size={18} />
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Экипировка</h3>
          </div>

          <div className="grid grid-cols-3 gap-3" style={{ width: (CELL_SIZE + 8) * 3 + 24 }}>
            {equipmentLayout.map(({ slot, row, col }) => (
              <div
                key={slot}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
              >
                <EquipSlot
                  slot={slot}
                  item={getEquippedItem(slot)}
                  onEquip={() => {}}
                  onUnequip={() => handleUnequipItem(slot)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleEquipSlotDrop(slot)}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                />
              </div>
            ))}
          </div>

          {/* Быстрые статы */}
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Sword size={14} />
              <span>КД: <span className="text-white font-semibold">{character.armorClass}</span></span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <FlaskConical size={14} />
              <span>Зелий: <span className="text-white font-semibold">{inventory.filter(i => i.category === 'potion').reduce((s, i) => s + i.quantity, 0)}</span></span>
            </div>
          </div>
        </div>

        {/* === Правая часть: Сетка рюкзака === */}
        <div
          className="rounded-xl border-2 border-gray-700 p-5 flex-1 min-w-0"
          style={{ background: '#0f0f23' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-gray-400" size={18} />
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Рюкзак</h3>
            <span className="text-xs text-gray-600 ml-auto">
              {backpackItems.length} предметов | {GRID_COLS}×{GRID_ROWS} ячеек
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
                    className="absolute rounded-sm transition-colors"
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
                  onRightClick={(item, e) => {
                    setContextMenu({ item, x: e.clientX, y: e.clientY });
                    hideTooltipFn();
                  }}
                  showTooltip={showTooltipFn}
                  hideTooltip={hideTooltipFn}
                />
              ))}

              {/* Пустая сетка — подсказка */}
              {backpackItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <Backpack className="mx-auto text-gray-700 mb-2" size={48} />
                    <div className="text-gray-600 text-sm">Рюкзак пуст</div>
                    <div className="text-gray-700 text-xs mt-1">Нажмите «Добавить предмет»</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Валюта */}
      <div
        className="rounded-xl border-2 border-gray-700 p-5"
        style={{ background: '#0f0f23' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💰</span>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Валюта</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          {([
            { key: 'platinum' as const, label: 'ПП', color: '#e5e7eb', icon: '💎' },
            { key: 'gold' as const, label: 'ЗМ', color: '#fbbf24', icon: '🪙' },
            { key: 'electrum' as const, label: 'ЭМ', color: '#a3a3a3', icon: '🪙' },
            { key: 'silver' as const, label: 'СМ', color: '#d1d5db', icon: '🪙' },
            { key: 'copper' as const, label: 'ММ', color: '#d97706', icon: '🪙' },
          ]).map(({ key, label, color, icon }) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2"
              style={{ background: '#1a1a2e' }}
            >
              <span>{icon}</span>
              <span className="text-xs text-gray-500">{label}</span>
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
                className="w-16 text-center text-sm font-semibold rounded border border-gray-700 text-white py-0.5"
                style={{ background: '#0f0f23', color }}
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
          onUnequip={() => {
            const slot = Object.entries(equipment).find(([, id]) => id === contextMenu.item.id)?.[0] as EquipmentSlot | undefined;
            if (slot) handleUnequipItem(slot);
            setContextMenu(null);
          }}
          onRemove={() => handleRemoveItem(contextMenu.item.id)}
        />
      )}

      {/* Модал добавления */}
      {showAddModal && (
        <AddItemModal
          onAdd={(template, quantity) => {
            handleAddItem(template, quantity);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};
