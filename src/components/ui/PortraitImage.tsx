import React, { useState, useEffect, useRef } from 'react';
import { portraitBgStyle } from '../../utils/portraitPosition';
import type { PortraitPos } from '../../utils/portraitPosition';

interface PortraitImageProps {
  src: string;
  pos?: PortraitPos;
  className?: string;
  /** Fallback content when no image */
  children?: React.ReactNode;
}

/**
 * Renders a portrait image with proper zoom + position support.
 * Uses background-image internally so zoom actually allows repositioning on both axes.
 */
export const PortraitImage: React.FC<PortraitImageProps> = ({ src, pos, className = '', children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerAspect, setContainerAspect] = useState(9 / 21);

  // Load image natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  // Observe container aspect ratio
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (height > 0) setContainerAspect(width / height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!naturalSize) {
    return <div ref={containerRef} className={className}>{children}</div>;
  }

  const bgStyles = portraitBgStyle(src, containerAspect, naturalSize.w, naturalSize.h, pos);

  return (
    <div
      ref={containerRef}
      className={className}
      style={bgStyles}
    />
  );
};
