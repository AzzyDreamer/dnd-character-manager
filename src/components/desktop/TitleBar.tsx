import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ArrowLeft, ArrowRight, Settings, Minus, Square, Copy, X } from 'lucide-react';

// Кастомный тайтлбар для frameless-окна (decorations:false). Десктоп-онли:
// модуль грузится лениво под Tauri, поэтому @tauri-apps/* не попадает в веб-бандл.
const appWindow = getCurrentWindow();

// Кнопка-иконка бара: золото в покое, ярче + золотистая подложка на ховере.
const NAV_BTN =
  'px-3 flex items-center text-gold/80 hover:text-gold-light hover:bg-gold/15 transition-colors cursor-pointer';

export default function TitleBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [maximized, setMaximized] = useState(false);

  // Иконка «развернуть/восстановить» должна реагировать и на системные действия
  // (Win+стрелка, snap, даблклик по бару), поэтому слушаем onResized.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void appWindow.isMaximized().then(setMaximized).catch(() => {});
    appWindow
      .onResized(() => {
        void appWindow.isMaximized().then(setMaximized).catch(() => {});
      })
      .then((u) => { unlisten = u; })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-stretch h-9 shrink-0 select-none bg-bg-secondary border-b border-border-default"
    >
      {/* Левый блок: браузерные назад/вперёд + настройки. */}
      <div className="flex items-stretch h-full">
        <button onClick={() => window.history.back()} aria-label="Назад" title="Назад" className={NAV_BTN}>
          <ArrowLeft size={16} />
        </button>
        <button onClick={() => window.history.forward()} aria-label="Вперёд" title="Вперёд" className={NAV_BTN}>
          <ArrowRight size={16} />
        </button>
        <button onClick={onOpenSettings} aria-label="Настройки" title="Настройки" className={NAV_BTN}>
          <Settings size={16} />
        </button>
      </div>

      {/* Середина: заголовок + перетаскивание окна. pointer-events-none пропускает
          mousedown к бару-drag-region, чтобы за эту зону можно было таскать окно. */}
      <div className="flex-1 flex items-center px-3 pointer-events-none">
        <span className="font-medieval text-gold text-sm tracking-wide">D&amp;D Character Manager</span>
      </div>

      {/* Правый блок: управление окном. */}
      <div className="flex items-stretch h-full">
        <button onClick={() => { void appWindow.minimize(); }} aria-label="Свернуть" className={NAV_BTN}>
          <Minus size={15} />
        </button>
        <button
          onClick={() => { void appWindow.toggleMaximize(); }}
          aria-label={maximized ? 'Восстановить' : 'Развернуть'}
          className={NAV_BTN}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          onClick={() => { void appWindow.close(); }}
          aria-label="Закрыть"
          className="px-3 flex items-center text-gold/80 hover:text-white hover:bg-red-bright transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
