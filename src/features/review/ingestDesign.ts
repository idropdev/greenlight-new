import type { SizeKey, TextNode, ImageNode, FlyerType } from '../flyer/flyerStore';
import { FLYER_DIMENSIONS, clampTextNodeXAndWidth } from '../flyer/sizes';
import { fieldConfig } from '../flyer/fieldConfig';

export interface IngestedDesign {
  size: SizeKey;
  textNodes: TextNode[];
  imageNodes: ImageNode[];
  bgImageUrl: string | null;
  bgColor: string | null;
  gaps: Array<{ reason: string }>;
  flyerType?: FlyerType | null;
  fields?: Record<string, string>;
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

  // 2. Parse background
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
  } else if (bgType) {
    gaps.push({ reason: `unknown background type '${bgType}'` });
  }

  // 3. Branch based on presence of content block
  const content = design?.content;
  const flyerTypeRaw = content?.flyer_type;
  const fieldsRaw = content?.fields;
  const hasContentBlock = !!(flyerTypeRaw && fieldsRaw);

  const textNodes: TextNode[] = [];
  const imageNodes: ImageNode[] = [];

  if (hasContentBlock) {
    // Primary path: fields-based design
    const VALID_FLYER_TYPES = ['event', 'service', 'product', 'sale', 'realEstate', 'hiring'];
    let flyerType: FlyerType = 'event';

    if (VALID_FLYER_TYPES.includes(flyerTypeRaw)) {
      flyerType = flyerTypeRaw as FlyerType;
    } else {
      gaps.push({ reason: `unknown flyer_type '${flyerTypeRaw}'` });
      flyerType = 'event'; // default/fallback
    }

    const fields: Record<string, string> = { ...fieldsRaw };
    const validKeys = fieldConfig[flyerType]?.map((f) => f.key) || [];
    for (const key of Object.keys(fields)) {
      if (!validKeys.includes(key)) {
        gaps.push({ reason: `unknown field key '${key}' for flyer_type '${flyerType}'` });
      }
    }

    // layers.overlay (optional): only image items -> ImageNode[]
    const overlays = design?.layers?.overlay || [];
    for (const element of overlays) {
      if (element.type === 'image') {
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

    return {
      size,
      textNodes,
      imageNodes,
      bgImageUrl,
      bgColor,
      gaps,
      flyerType,
      fields,
    };
  } else {
    // Fallback path: legacy overlay-only design
    const overlays = design?.layers?.overlay || [];
    for (const element of overlays) {
      if (element.type === 'text') {
        const px_x = Math.round(element.x * width);
        const px_y = Math.round(element.y * height);
        const px_w = Math.round(element.w * width);

        const clamped = clampTextNodeXAndWidth(px_x, px_w, width, 20);

        textNodes.push({
          id: element.id,
          field: element.id,
          text: element.content || '',
          x: clamped.x,
          y: px_y,
          fontFamily: element.font || 'Inter, system-ui, sans-serif',
          fontSize: element.size || 24,
          fill: element.color || '#ffffff',
          width: clamped.width,
          align: element.align || 'left',
          autoWidth: false,
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

    return {
      size,
      textNodes,
      imageNodes,
      bgImageUrl,
      bgColor,
      gaps,
    };
  }
}

