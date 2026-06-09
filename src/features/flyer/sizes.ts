import type { SizeKey } from './flyerStore';

export interface Dimensions {
  width: number;
  height: number;
}

export const FLYER_DIMENSIONS: Record<SizeKey, Dimensions> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
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
}

export const FLYER_SIZE_INFO: SizeInfo[] = [
  {
    key: 'square',
    label: 'Square',
    dimensions: '1080 × 1080',
    aspect: '1:1',
    blurb: 'Best for feed posts (Instagram, Facebook)',
    ratioClass: 'w-10 h-10',
  },
  {
    key: 'portrait',
    label: 'Portrait',
    dimensions: '1080 × 1350',
    aspect: '4:5',
    blurb: 'Best for feed posts that take up more space',
    ratioClass: 'w-10 h-[50px]',
  },
  {
    key: 'story',
    label: 'Story / Reel',
    dimensions: '1080 × 1920',
    aspect: '9:16',
    blurb: 'Best for Stories & Reels (full-screen vertical)',
    ratioClass: 'w-10 h-[70px]',
  },
];
