import type { SizeKey, TextNode, ImageNode } from '../flyer/flyerStore';
import { FLYER_DIMENSIONS } from '../flyer/sizes';

export interface IngestedDesign {
  size: SizeKey;
  textNodes: TextNode[];
  imageNodes: ImageNode[];
  bgImageUrl: string | null;
  bgColor: string | null;
  gaps: Array<{ reason: string }>;
}

export function ingestDesign(design: any): IngestedDesign {
  const gaps: Array<{ reason: string }> = [];

  // 1. Determine size key
  const originalPreset = design?.canvas?.preset;
  let size: SizeKey = 'square';

  if (originalPreset === 'square' || originalPreset === 'portrait' || originalPreset === 'story' || originalPreset === 'landscape') {
    size = originalPreset;
  } else {
    size = 'square';
    gaps.push({ reason: `unknown preset '${originalPreset}' fall back to square` });
  }

  const dimensions = FLYER_DIMENSIONS[size] || FLYER_DIMENSIONS.square;
  const { width, height } = dimensions;

  // 2. Parse overlays
  const textNodes: TextNode[] = [];
  const imageNodes: ImageNode[] = [];
  const overlays = design?.layers?.overlay || [];

  for (const element of overlays) {
    if (element.type === 'text') {
      const px_x = Math.round(element.x * width);
      const px_y = Math.round(element.y * height);
      const px_w = Math.round(element.w * width);

      textNodes.push({
        id: element.id,
        field: element.id,
        text: element.content || '',
        x: px_x,
        y: px_y,
        fontFamily: element.font || 'Inter, system-ui, sans-serif',
        fontSize: element.size || 24,
        fill: element.color || '#ffffff',
        width: px_w,
        align: element.align || 'left',
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowBlur: 6,
        shadowOpacity: 0.6,
        highlightEnabled: false,
        highlightColor: '#000000',
        highlightOpacity: 0.5,
      });
    } else if (element.type === 'image') {
      const px_x = Math.round(element.x * width);
      const px_y = Math.round(element.y * height);
      const px_w = Math.round(element.w * width);
      const px_h = Math.round(element.h * height);

      imageNodes.push({
        id: element.id,
        url: element.value || '',
        x: px_x,
        y: px_y,
        width: px_w,
        height: px_h,
      });
    }
  }

  // 3. Parse background
  let bgImageUrl: string | null = null;
  let bgColor: string | null = null;
  const bgType = design?.layers?.background?.type;
  const bgVal = design?.layers?.background?.value || '';

  if (bgType === 'image') {
    bgImageUrl = bgVal;
  } else if (bgType === 'color') {
    bgColor = bgVal;
  } else if (bgType === 'gradient') {
    // Parse first stop color from gradient
    let firstStop = '#000000';
    const hexMatch = bgVal.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) {
      firstStop = hexMatch[0];
    } else {
      const rgbMatch = bgVal.match(/rgba?\(.*?\)/);
      if (rgbMatch) {
        firstStop = rgbMatch[0];
      } else {
        const wordMatch = bgVal.match(/[a-zA-Z]+/g);
        if (wordMatch) {
          const excludes = ['linear', 'radial', 'conic', 'gradient', 'to', 'top', 'bottom', 'left', 'right', 'deg', 'turn', 'ellipse', 'circle', 'at'];
          const colorWord = wordMatch.find((w: string) => !excludes.includes(w.toLowerCase()));
          if (colorWord) {
            firstStop = colorWord;
          }
        }
      }
    }
    bgColor = firstStop;
    gaps.push({ reason: `gradient background fallback to solid color '${firstStop}'` });
  }

  return {
    size,
    textNodes,
    imageNodes,
    bgImageUrl,
    bgColor,
    gaps,
  };
}
