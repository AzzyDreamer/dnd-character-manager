import type { CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

// @tauri-apps/api не экспортирует тип ResizeDirection наружу — повторяем его
// локально (тот же строковый union, структурно совместим с startResizeDragging).
type ResizeDir =
  | 'East' | 'North' | 'NorthEast' | 'NorthWest'
  | 'South' | 'SouthEast' | 'SouthWest' | 'West';

// Невидимые полоски по краям окна возвращают ресайз, который пропадает у
// frameless-окна (decorations:false). Десктоп-онли, грузится лениво под Tauri.
const appWindow = getCurrentWindow();
const T = 5; // толщина зоны захвата по краям, px

const HANDLES: { dir: ResizeDir; style: CSSProperties }[] = [
  { dir: 'North', style: { top: 0, left: T, right: T, height: T, cursor: 'ns-resize' } },
  { dir: 'South', style: { bottom: 0, left: T, right: T, height: T, cursor: 'ns-resize' } },
  { dir: 'West', style: { left: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' } },
  { dir: 'East', style: { right: 0, top: T, bottom: T, width: T, cursor: 'ew-resize' } },
  { dir: 'NorthWest', style: { top: 0, left: 0, width: T, height: T, cursor: 'nwse-resize' } },
  { dir: 'NorthEast', style: { top: 0, right: 0, width: T, height: T, cursor: 'nesw-resize' } },
  { dir: 'SouthWest', style: { bottom: 0, left: 0, width: T, height: T, cursor: 'nesw-resize' } },
  { dir: 'SouthEast', style: { bottom: 0, right: 0, width: T, height: T, cursor: 'nwse-resize' } },
];

export default function WindowResizers() {
  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.dir}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            void appWindow.startResizeDragging(h.dir);
          }}
          style={{ position: 'fixed', zIndex: 40, ...h.style }}
        />
      ))}
    </>
  );
}
