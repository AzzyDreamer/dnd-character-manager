import React, { useRef, useState, useEffect } from 'react';
import { X, Check, ImagePlus, ZoomIn } from 'lucide-react';
import { getPortraitPos, portraitBgStyle } from '../utils/portraitPosition';
import type { PortraitPos } from '../utils/portraitPosition';

interface PortraitCropModalProps {
  imageDataUrl: string;
  initialPosition?: PortraitPos;
  onSave: (position: { x: number; y: number; zoom: number }) => void;
  onCancel: () => void;
  onChangeImage: () => void;
}

const CONTAINER_ASPECT = 9 / 21; // width / height

export const PortraitCropModal: React.FC<PortraitCropModalProps> = ({
  imageDataUrl,
  initialPosition,
  onSave,
  onCancel,
  onChangeImage,
}) => {
  const init = getPortraitPos(initialPosition);
  const [posX, setPosX] = useState(init.x);
  const [posY, setPosY] = useState(init.y);
  const [zoom, setZoom] = useState(init.zoom);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // Load image natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Mouse drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      // Invert: dragging right → image moves right → position decreases
      const deltaPctX = -(deltaX / rect.width) * 100;
      const deltaPctY = -(deltaY / rect.height) * 100;
      setPosX(Math.max(0, Math.min(100, Math.round(dragRef.current.startPosX + deltaPctX))));
      setPosY(Math.max(0, Math.min(100, Math.round(dragRef.current.startPosY + deltaPctY))));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: posX, startPosY: posY };
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      return Math.round(Math.max(1, Math.min(3, z + delta)) * 10) / 10;
    });
  };

  // Touch events for mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartData: { startX: number; startY: number; startPosX: number; startPosY: number } | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartData = { startX: t.clientX, startY: t.clientY, startPosX: posX, startPosY: posY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartData) return;
      e.preventDefault();
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      const dx = -(t.clientX - touchStartData.startX) / rect.width * 100;
      const dy = -(t.clientY - touchStartData.startY) / rect.height * 100;
      setPosX(Math.max(0, Math.min(100, Math.round(touchStartData.startPosX + dx))));
      setPosY(Math.max(0, Math.min(100, Math.round(touchStartData.startPosY + dy))));
    };

    const handleTouchEnd = () => { touchStartData = null; };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [posX, posY]);

  const bgStyles = portraitBgStyle(imageDataUrl, CONTAINER_ASPECT, naturalSize.w, naturalSize.h, { x: posX, y: posY, zoom });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div
        className="bg-bg-primary border border-border-default rounded-xl p-5 flex flex-col items-center gap-4 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medieval text-gold">Настройка обрезки</h3>
        <p className="text-xs text-text-muted text-center">
          Перетащите для позиции, колёсико мыши для зума
        </p>

        {/* Preview frame — 9:21 aspect */}
        <div
          ref={containerRef}
          className="relative w-40 aspect-[9/21] rounded-lg overflow-hidden border-2 border-gold/50 cursor-grab active:cursor-grabbing select-none"
          style={bgStyles}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {/* Crosshair overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          </div>
        </div>

        {/* Sliders */}
        <div className="w-48 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted w-3">X</span>
            <input
              type="range" min={0} max={100} value={posX}
              onChange={(e) => setPosX(Number(e.target.value))}
              className="flex-1 accent-[#d4af37]"
            />
            <span className="text-[10px] text-text-muted w-7 text-right">{posX}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted w-3">Y</span>
            <input
              type="range" min={0} max={100} value={posY}
              onChange={(e) => setPosY(Number(e.target.value))}
              className="flex-1 accent-[#d4af37]"
            />
            <span className="text-[10px] text-text-muted w-7 text-right">{posY}%</span>
          </div>
          <div className="flex items-center gap-2">
            <ZoomIn size={12} className="text-text-muted shrink-0" />
            <input
              type="range" min={100} max={300} value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="flex-1 accent-[#d4af37]"
            />
            <span className="text-[10px] text-text-muted w-7 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={onChangeImage}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-white/5 flex items-center gap-2 text-sm transition-colors"
          >
            <ImagePlus size={14} />
            Сменить
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-default text-text-muted hover:bg-white/5 flex items-center gap-2 text-sm transition-colors"
          >
            <X size={14} />
            Отмена
          </button>
          <button
            onClick={() => onSave({ x: posX, y: posY, zoom })}
            className="px-4 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Check size={14} />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
