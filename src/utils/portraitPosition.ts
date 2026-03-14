import type React from 'react';

export type PortraitPos = number | { x: number; y: number; zoom?: number };

/** Normalize portraitPosition to {x, y, zoom} from any stored format */
export function getPortraitPos(pos?: PortraitPos): { x: number; y: number; zoom: number } {
  if (pos == null) return { x: 50, y: 20, zoom: 1 };
  if (typeof pos === 'number') return { x: 50, y: pos, zoom: 1 };
  return { x: pos.x, y: pos.y, zoom: pos.zoom ?? 1 };
}

/** Convert to CSS object-position string (no zoom) */
export function portraitCss(pos?: PortraitPos): string {
  const { x, y } = getPortraitPos(pos);
  return `${x}% ${y}%`;
}

/**
 * Build background-image styles for a DIV, given the image's natural dimensions
 * and the container's aspect ratio. Supports zoom properly.
 */
export function portraitBgStyle(
  imageUrl: string,
  containerAspect: number, // width/height of the container
  imgNaturalW: number,
  imgNaturalH: number,
  pos?: PortraitPos,
): React.CSSProperties {
  const { x, y, zoom } = getPortraitPos(pos);
  const imgAspect = imgNaturalW / imgNaturalH;

  // "cover" logic: scale image so it fully covers the container.
  // If imgAspect > containerAspect → height is the covering axis → auto H%
  // If imgAspect <= containerAspect → width is the covering axis → W% auto
  const bgSize = imgAspect > containerAspect
    ? `auto ${zoom * 100}%`
    : `${zoom * 100}% auto`;

  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: bgSize,
  };
}

/**
 * @deprecated Use portraitBgStyle() on a <div> instead for proper zoom support.
 */
export function portraitStyle(pos?: PortraitPos): React.CSSProperties {
  const { x, y, zoom } = getPortraitPos(pos);
  return {
    objectPosition: `${x}% ${y}%`,
    ...(zoom !== 1 ? { transform: `scale(${zoom})` } : {}),
  };
}
