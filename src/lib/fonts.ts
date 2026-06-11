export interface FontOption {
  label: string;
  family: string;
}

export const FONTS: FontOption[] = [
  { label: 'Inter', family: 'Inter' },
  { label: 'Montserrat', family: 'Montserrat' },
  { label: 'Playfair Display', family: 'Playfair Display' },
  { label: 'Lora', family: 'Lora' },
  { label: 'Outfit', family: 'Outfit' },
  { label: 'Syne', family: 'Syne' },
  { label: 'Anton', family: 'Anton' },
  { label: 'Righteous', family: 'Righteous' },
  { label: 'JetBrains Mono', family: 'JetBrains Mono' },
  { label: 'Cinzel', family: 'Cinzel' },
];

/**
 * Ensures that all curated Google Fonts are fully loaded in the browser.
 * This prevents Konva canvas from rendering fallback text layouts.
 */
export async function ensureFontsLoaded(): Promise<void> {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.fonts) {
    return;
  }

  try {
    // Trigger loading of each font by calling load() with the family name
    const promises = FONTS.map(async (font) => {
      try {
        await doc.fonts.load(`16px "${font.family}"`);
      } catch (err) {
        console.warn(`[FontLoader] Failed to load font: ${font.family}`, err);
      }
    });

    await Promise.all(promises);
    await doc.fonts.ready;
  } catch (err) {
    console.error('[FontLoader] Error during font loading orchestration:', err);
  }
}
