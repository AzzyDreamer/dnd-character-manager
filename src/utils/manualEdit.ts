import type { Character } from '../types';

// ─── Скрытая пометка ручного редактирования («аутентичность») ───
// Любое изменение через режим полного редактирования проходит через stampManualEdit,
// который проставляет/обновляет невидимую в обычном UI отметку. Отметка
// переустанавливается при каждом сохранении, поэтому её нельзя «стереть» через
// raw-JSON редактор — она вернётся при следующем сохранении.

export function stampManualEdit(char: Character): Character {
  const now = new Date().toISOString();
  const prev = char.manualEdit;
  return {
    ...char,
    manualEdit: {
      edited: true,
      firstAt: prev?.firstAt ?? now,
      lastAt: now,
      count: (prev?.count ?? 0) + 1,
    },
  };
}

export function isManuallyEdited(char: Character): boolean {
  return char.manualEdit?.edited === true;
}

// Убрать отметку — используется только для показа «чистого» JSON в редакторе,
// чтобы пометка оставалась скрытой даже там (на сохранении она ставится заново).
export function stripManualEdit(char: Character): Character {
  if (!char.manualEdit) return char;
  const rest = { ...char };
  delete rest.manualEdit;
  return rest;
}
