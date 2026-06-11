// Проверки экипировки (броня/щит), общие для classEffects и activatedEffects.
// Вынесены в отдельный модуль, чтобы не создавать циклических импортов.
import type { Character, InventoryItem } from '../types';

/** Get the equipped armor item (if any) from the armor slot. */
export function getEquippedArmor(char: Character): InventoryItem | null {
  const armorSlotId = char.equipment?.armor;
  if (!armorSlotId) return null;
  const armorItem = char.inventory?.find(i => i.id === armorSlotId);
  if (!armorItem) return null;
  // Only count actual armor (not other items in the slot)
  if (armorItem.armorType && armorItem.armorType !== 'shield') return armorItem;
  if (armorItem.category === 'armor') return armorItem;
  return null;
}

/** Check if character is wearing armor. */
export function isWearingArmor(char: Character): boolean {
  return getEquippedArmor(char) !== null;
}

/** Check if character is wearing heavy armor. */
export function isWearingHeavyArmor(char: Character): boolean {
  const armor = getEquippedArmor(char);
  return armor?.armorType === 'heavy';
}

/** Check if character is wearing medium or heavy armor (Bladesong restriction). */
export function isWearingMediumOrHeavyArmor(char: Character): boolean {
  const armor = getEquippedArmor(char);
  return armor?.armorType === 'medium' || armor?.armorType === 'heavy';
}

/** Check if character is wielding a shield. */
export function isWieldingShield(char: Character): boolean {
  const offhandId = char.equipment?.offhand;
  if (!offhandId) return false;
  const item = char.inventory?.find(i => i.id === offhandId);
  return item?.armorType === 'shield' || item?.category === 'shield';
}
