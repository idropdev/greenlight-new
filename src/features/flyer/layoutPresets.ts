import type { FlyerType, SizeKey, TextNode } from './flyerStore';
import { fieldConfig } from './fieldConfig';
import { getDimensionsForSize } from './sizes';
import { formatFieldValue } from '../../lib/formatters';

const PRIMARY_FIELD_KEYS: Record<FlyerType, string[]> = {
  event: ['title'],
  service: ['businessName'],
  product: ['productName'],
  sale: ['headline'],
  realEstate: ['propertyTitle'],
  hiring: ['jobTitle'],
};

const DESCRIPTION_FIELD_KEYS: Record<FlyerType, string[]> = {
  event: ['description'],
  service: ['description'],
  product: ['description'],
  sale: ['description'],
  realEstate: ['features'],
  hiring: [],
};

/**
 * Generates initial TextNode layouts for a flyer type and canvas size based on user fields.
 * Iterates fields in fieldConfig order, skipping any empty/whitespace values.
 * Places primary fields in the upper-middle, secondary fields stacked in the middle,
 * and description fields lower. Spacing adapts to the canvas height.
 */
export function buildTextNodes(
  type: FlyerType | null,
  size: SizeKey,
  fields: Record<string, string>,
  style?: Record<string, any>
): TextNode[] {
  if (!type) return [];

  const definitions = fieldConfig[type];
  if (!definitions) return [];

  const dimensions = getDimensionsForSize(size);
  const { width, height } = dimensions;

  // Filter fields: skip empty or whitespace-only values
  const activeFields = definitions.filter((def) => {
    if (type === 'event' && def.key === 'endTime') {
      return false;
    }
    if (type === 'event' && def.key === 'startTime') {
      const hasStart = fields.startTime && fields.startTime.trim() !== '';
      const hasEnd = fields.endTime && fields.endTime.trim() !== '';
      return hasStart || hasEnd;
    }
    const val = fields[def.key];
    return val && val.trim() !== '';
  });

  const nodes: TextNode[] = [];
  const heightScale = height / 1080;

  // Font sizes: scale with the flyer height
  const primaryFontSize = Math.round(64 * heightScale);
  const secondaryFontSize = Math.round(36 * heightScale);
  const descriptionFontSize = Math.round(24 * heightScale);

  // Horizontal boundaries (~80% wrapping width, centered horizontally)
  const nodeWidth = Math.round(width * 0.8);
  const nodeX = Math.round((width - nodeWidth) / 2);
  const primaryFieldKeys = PRIMARY_FIELD_KEYS[type];
  const descriptionFieldKeys = DESCRIPTION_FIELD_KEYS[type];

  // Group active fields to layout them in their respective zones
  const primaryFields = activeFields.filter((def) =>
    primaryFieldKeys.includes(def.key)
  );

  const secondaryFields = activeFields.filter((def) =>
    !primaryFieldKeys.includes(def.key) && !descriptionFieldKeys.includes(def.key)
  );

  const descriptionFields = activeFields.filter((def) =>
    descriptionFieldKeys.includes(def.key)
  );

  const resolveStyle = (fieldKey: string) => {
    const defaults = {
      fontFamily: 'Inter, system-ui, sans-serif',
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowBlur: 6,
      shadowOpacity: 0.6,
      highlightEnabled: false,
      highlightColor: '#000000',
      highlightOpacity: 0.5,
    };

    const fieldStyle = style?.[fieldKey];
    if (!fieldStyle) {
      return defaults;
    }

    return {
      fontFamily: fieldStyle.fontFamily ?? defaults.fontFamily,
      shadowEnabled: fieldStyle.shadowEnabled !== undefined ? fieldStyle.shadowEnabled : defaults.shadowEnabled,
      shadowColor: fieldStyle.shadowColor ?? defaults.shadowColor,
      shadowBlur: fieldStyle.shadowBlur !== undefined ? fieldStyle.shadowBlur : defaults.shadowBlur,
      shadowOpacity: fieldStyle.shadowOpacity !== undefined ? fieldStyle.shadowOpacity : defaults.shadowOpacity,
      highlightEnabled: fieldStyle.highlightEnabled !== undefined ? fieldStyle.highlightEnabled : defaults.highlightEnabled,
      highlightColor: fieldStyle.highlightColor ?? defaults.highlightColor,
      highlightOpacity: fieldStyle.highlightOpacity !== undefined ? fieldStyle.highlightOpacity : defaults.highlightOpacity,
    };
  };

  // 1. Primary field: upper-middle
  primaryFields.forEach((def, index) => {
    const val = fields[def.key];
    const y = Math.round(height * 0.25 + index * (primaryFontSize * 1.3));
    const s = resolveStyle(def.key);
    nodes.push({
      id: def.key,
      field: def.key,
      text: formatFieldValue(def.key, val, fields),
      x: nodeX,
      y,
      fontFamily: s.fontFamily,
      fontSize: primaryFontSize,
      fill: '#ffffff',
      width: nodeWidth,
      align: 'left',
      autoWidth: true,
      shadowEnabled: s.shadowEnabled,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
      shadowOpacity: s.shadowOpacity,
      highlightEnabled: s.highlightEnabled,
      highlightColor: s.highlightColor,
      highlightOpacity: s.highlightOpacity,
    });
  });

  // 2. Secondary fields: stack in the middle area
  secondaryFields.forEach((def, index) => {
    const val = fields[def.key];
    const y = Math.round(height * 0.48 + index * (secondaryFontSize + 30 * heightScale));
    const s = resolveStyle(def.key);
    nodes.push({
      id: def.key,
      field: def.key,
      text: formatFieldValue(def.key, val, fields),
      x: nodeX,
      y,
      fontFamily: s.fontFamily,
      fontSize: secondaryFontSize,
      fill: '#ffffff',
      width: nodeWidth,
      align: 'left',
      autoWidth: true,
      shadowEnabled: s.shadowEnabled,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
      shadowOpacity: s.shadowOpacity,
      highlightEnabled: s.highlightEnabled,
      highlightColor: s.highlightColor,
      highlightOpacity: s.highlightOpacity,
    });
  });

  // 3. Description fields: sits lower
  descriptionFields.forEach((def, index) => {
    const val = fields[def.key];
    const y = Math.round(height * 0.78 + index * (descriptionFontSize * 1.4));
    const s = resolveStyle(def.key);
    nodes.push({
      id: def.key,
      field: def.key,
      text: formatFieldValue(def.key, val, fields),
      x: nodeX,
      y,
      fontFamily: s.fontFamily,
      fontSize: descriptionFontSize,
      fill: '#ffffff',
      width: nodeWidth,
      align: 'left',
      autoWidth: true,
      shadowEnabled: s.shadowEnabled,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
      shadowOpacity: s.shadowOpacity,
      highlightEnabled: s.highlightEnabled,
      highlightColor: s.highlightColor,
      highlightOpacity: s.highlightOpacity,
    });
  });

  return nodes;
}
