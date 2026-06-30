import type { SizeKey } from './flyerStore';

export interface Dimensions {
  width: number;
  height: number;
}

export const FLYER_DIMENSIONS: Record<SizeKey, Dimensions> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1080, height: 566 },
};

/**
 * Gets the width and height dimensions for a given SizeKey.
 * Fallbacks to square dimensions if the key is invalid or not found.
 */
export function getDimensionsForSize(size: SizeKey): Dimensions {
  return FLYER_DIMENSIONS[size] || FLYER_DIMENSIONS.square;
}

/* ── Shared size metadata (single source of truth) ── */

export interface SizeInfo {
  key: SizeKey;
  label: string;
  dimensions: string;
  aspect: string;
  blurb: string;
  /** Tailwind classes for the aspect-ratio box visual on the Setup screen */
  ratioClass: string;
  platforms?: string[];
}

export const FLYER_SIZE_INFO: SizeInfo[] = [
  {
    key: 'square',
    label: 'Square',
    dimensions: '1080 × 1080',
    aspect: '1:1',
    blurb: 'Best for feed posts (Instagram, Facebook)',
    ratioClass: 'w-10 h-10',
    platforms: ['instagram', 'facebook'],
  },
  {
    key: 'portrait',
    label: 'Portrait',
    dimensions: '1080 × 1350',
    aspect: '4:5',
    blurb: 'Best for feed posts that take up more space',
    ratioClass: 'w-10 h-[50px]',
    platforms: ['instagram'],
  },
  {
    key: 'story',
    label: 'Story / Reel',
    dimensions: '1080 × 1920',
    aspect: '9:16',
    blurb: 'Best for Stories & Reels (full-screen vertical)',
    ratioClass: 'w-10 h-[70px]',
    platforms: ['instagram', 'facebook'],
  },
  {
    key: 'landscape',
    label: 'Landscape',
    dimensions: '1080 × 566',
    aspect: '1.91:1',
    blurb: 'Wide feed posts & link previews (1.91:1)',
    ratioClass: 'w-14 h-7',
    platforms: ['facebook', 'threads', 'youtube'],
  },
];

export function getTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const minWidth = 40;
  if (!text) {
    return minWidth;
  }
  if (typeof document === 'undefined') {
    // Fallback if document is not defined (e.g. Server Side Rendering or tests)
    return Math.max(minWidth, Math.ceil(text.length * fontSize * 0.55));
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return minWidth;
  }

  context.font = `${fontSize}px ${fontFamily}`;
  const lines = text.split('\n');
  let maxWidth = 0;
  for (const line of lines) {
    const w = context.measureText(line).width;
    if (w > maxWidth) {
      maxWidth = w;
    }
  }
  return Math.max(minWidth, Math.ceil(maxWidth));
}

export function clampTextNodeXAndWidth(
  x: number,
  width: number,
  canvasWidth: number,
  margin = 20
): { x: number; width: number } {
  const minWidth = 40;
  let clampedX = Math.max(0, x);
  if (clampedX + minWidth > canvasWidth - margin) {
    clampedX = Math.max(0, canvasWidth - minWidth - margin);
  }
  const maxW = canvasWidth - clampedX - margin;
  const clampedWidth = Math.max(minWidth, Math.min(width, maxW));
  return { x: clampedX, width: clampedWidth };
}


