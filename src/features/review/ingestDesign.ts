import type { SizeKey, TextNode, ImageNode, FlyerType } from '../flyer/flyerStore';
import { FLYER_DIMENSIONS, clampTextNodeXAndWidth } from '../flyer/sizes';
import { fieldConfig } from '../flyer/fieldConfig';

export interface IngestedDesign {
  size: SizeKey;
  textNodes: TextNode[];
  imageNodes: ImageNode[];
  bgImageUrl: string | null;
  bgColor: string | null;
  bgBlur?: number;
  bgOpacity?: number;
  gaps: Array<{ reason: string }>;
  flyerType?: FlyerType | null;
  fields?: Record<string, string>;
  style?: Record<string, any>;
}

function normalizeDate(val: string): string | null {
  const trimmed = val.trim();
  const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmddMatch) {
    return yyyymmddMatch[0];
  }

  const timestamp = Date.parse(trimmed);
  if (!isNaN(timestamp)) {
    const date = new Date(timestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function normalizeTime(val: string): string | null {
  const trimmed = val.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) {
    return null;
  }

  let hour = parseInt(match[1], 10);
  let minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[4];

  if (isNaN(hour) || hour < 0 || hour > 23) return null;
  if (isNaN(minute) || minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'PM') {
      if (hour !== 12) {
        hour += 12;
      }
    } else if (ampm === 'AM') {
      if (hour === 12) {
        hour = 0;
      }
    }
  }

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
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

  // Parse background blur and opacity with clamping
  const bgBlurRaw = design?.layers?.background?.blur;
  const bgBlur = typeof bgBlurRaw === 'number' ? Math.max(0, Math.min(20, bgBlurRaw)) : 0;

  const bgOpacityRaw = design?.layers?.background?.opacity;
  const bgOpacity = typeof bgOpacityRaw === 'number' ? Math.max(0, Math.min(100, bgOpacityRaw)) : 50;

  // 3. Branch based on presence of content block
  const content = design?.content;
  const flyerTypeRaw = content?.flyer_type;
  const fieldsRaw = content?.fields;
  const hasContentBlock = !!(flyerTypeRaw && fieldsRaw);

  const textNodes: TextNode[] = [];
  const imageNodes: ImageNode[] = [];

  const BUNDLED_FONTS = [
    'Inter',
    'Montserrat',
    'Playfair Display',
    'Lora',
    'Outfit',
    'Syne',
    'Anton',
    'Righteous',
    'JetBrains Mono',
    'Cinzel',
  ];

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

    // Normalize date
    if (fields.date !== undefined && fields.date !== null) {
      const normalizedDate = normalizeDate(fields.date);
      if (normalizedDate !== null) {
        fields.date = normalizedDate;
      } else {
        gaps.push({ reason: `unparseable date value: '${fields.date}'` });
      }
    }

    // Normalize startTime
    if (fields.startTime !== undefined && fields.startTime !== null) {
      const normalizedStartTime = normalizeTime(fields.startTime);
      if (normalizedStartTime !== null) {
        fields.startTime = normalizedStartTime;
      } else {
        gaps.push({ reason: `unparseable startTime value: '${fields.startTime}'` });
      }
    }

    // Normalize endTime
    if (fields.endTime !== undefined && fields.endTime !== null) {
      const normalizedEndTime = normalizeTime(fields.endTime);
      if (normalizedEndTime !== null) {
        fields.endTime = normalizedEndTime;
      } else {
        gaps.push({ reason: `unparseable endTime value: '${fields.endTime}'` });
      }
    }

    const validKeys = fieldConfig[flyerType]?.map((f) => f.key) || [];
    for (const key of Object.keys(fields)) {
      if (!validKeys.includes(key)) {
        gaps.push({ reason: `unknown field key '${key}' for flyer_type '${flyerType}'` });
      }
    }

    // Parse style map and log font gaps
    const styleRaw = content?.style;
    const styleCleaned: Record<string, any> = {};

    if (styleRaw && typeof styleRaw === 'object') {
      for (const [fieldName, fieldStyle] of Object.entries(styleRaw)) {
        if (fieldStyle && typeof fieldStyle === 'object') {
          const cleanedFieldStyle: any = {};
          const fsObj = fieldStyle as any;

          if (fsObj.fontFamily !== undefined && fsObj.fontFamily !== null) {
            const font = String(fsObj.fontFamily);
            if (BUNDLED_FONTS.includes(font)) {
              cleanedFieldStyle.fontFamily = font;
            } else {
              cleanedFieldStyle.fontFamily = 'Inter';
              gaps.push({ reason: `fontFamily '${font}' for field '${fieldName}' is not a bundled font` });
            }
          }

          if (fsObj.shadowEnabled !== undefined) {
            cleanedFieldStyle.shadowEnabled = Boolean(fsObj.shadowEnabled);
          }
          if (fsObj.shadowColor !== undefined) {
            cleanedFieldStyle.shadowColor = String(fsObj.shadowColor);
          }
          if (fsObj.shadowBlur !== undefined && typeof fsObj.shadowBlur === 'number') {
            cleanedFieldStyle.shadowBlur = Math.max(0, fsObj.shadowBlur);
          }
          if (fsObj.shadowOpacity !== undefined && typeof fsObj.shadowOpacity === 'number') {
            cleanedFieldStyle.shadowOpacity = Math.max(0, Math.min(1, fsObj.shadowOpacity));
          }

          if (fsObj.highlightEnabled !== undefined) {
            cleanedFieldStyle.highlightEnabled = Boolean(fsObj.highlightEnabled);
          }
          if (fsObj.highlightColor !== undefined) {
            cleanedFieldStyle.highlightColor = String(fsObj.highlightColor);
          }
          if (fsObj.highlightOpacity !== undefined && typeof fsObj.highlightOpacity === 'number') {
            cleanedFieldStyle.highlightOpacity = Math.max(0, Math.min(1, fsObj.highlightOpacity));
          }

          styleCleaned[fieldName] = cleanedFieldStyle;
        }
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
      bgBlur,
      bgOpacity,
      gaps,
      flyerType,
      fields,
      style: styleCleaned,
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
      bgBlur,
      bgOpacity,
      gaps,
    };
  }
}

