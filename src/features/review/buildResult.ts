import type { FlyerState } from '../flyer/flyerStore';
import { FLYER_DIMENSIONS, getTextWidth, clampTextNodeXAndWidth } from '../flyer/sizes';
import type { A2uiDesign, A2uiResult } from './gatewayClient';

export function buildDesignFromState(
  state: FlyerState,
  bgColor?: string | null,
  meta?: any,
  originalOverlays?: any[]
): A2uiDesign {
  const size = state.size || 'square';
  const dimensions = FLYER_DIMENSIONS[size] || FLYER_DIMENSIONS.square;
  const { width, height } = dimensions;

  const overlaysList: any[] = [];
  const stateTextNodes = [...state.textNodes];
  const stateImageNodes = [...state.imageNodes];

  // Interleave according to original z-order if available
  if (originalOverlays && originalOverlays.length > 0) {
    for (const originalOverlay of originalOverlays) {
      if (originalOverlay.type === 'text') {
        const index = stateTextNodes.findIndex((n) => n.id === originalOverlay.id);
        if (index !== -1) {
          const node = stateTextNodes[index];
          stateTextNodes.splice(index, 1);

          const effectiveWidth = node.autoWidth !== false
            ? getTextWidth(node.text, node.fontSize, node.fontFamily)
            : node.width;
          const clamped = clampTextNodeXAndWidth(node.x, effectiveWidth, width, 20);

          overlaysList.push({
            id: node.id,
            type: 'text',
            content: node.text,
            x: clamped.x / width,
            y: node.y / height,
            w: clamped.width / width,
            font: node.fontFamily,
            size: node.fontSize,
            color: node.fill,
            align: node.align || 'left',
          });
        }
      } else if (originalOverlay.type === 'image') {
        const index = stateImageNodes.findIndex((n) => n.id === originalOverlay.id);
        if (index !== -1) {
          const node = stateImageNodes[index];
          stateImageNodes.splice(index, 1);
          overlaysList.push({
            id: node.id,
            type: 'image',
            value: node.url,
            x: node.x / width,
            y: node.y / height,
            w: node.width / width,
            h: node.height / height,
          });
        }
      }
    }
  }

  // Append remaining text nodes
  for (const node of stateTextNodes) {
    const effectiveWidth = node.autoWidth !== false
      ? getTextWidth(node.text, node.fontSize, node.fontFamily)
      : node.width;
    const clamped = clampTextNodeXAndWidth(node.x, effectiveWidth, width, 20);

    overlaysList.push({
      id: node.id,
      type: 'text',
      content: node.text,
      x: clamped.x / width,
      y: node.y / height,
      w: clamped.width / width,
      font: node.fontFamily,
      size: node.fontSize,
      color: node.fill,
      align: node.align || 'left',
    });
  }

  // Append remaining image nodes
  for (const node of stateImageNodes) {
    overlaysList.push({
      id: node.id,
      type: 'image',
      value: node.url,
      x: node.x / width,
      y: node.y / height,
      w: node.width / width,
      h: node.height / height,
    });
  }

  // Map background
  let background: { type: 'color' | 'image' | 'gradient'; value: string; fit?: 'cover' } | null = null;
  if (bgColor) {
    background = {
      type: 'color',
      value: bgColor,
    };
  } else if (state.bgImageUrl) {
    background = {
      type: 'image',
      value: state.bgImageUrl,
      fit: 'cover',
    };
  } else {
    // default white solid color background if nothing set
    background = {
      type: 'color',
      value: '#ffffff',
    };
  }

  return {
    schema_version: '0.1.1',
    canvas: {
      preset: size,
      width,
      height,
    },
    layers: {
      background,
      overlay: overlaysList,
    },
    meta: meta || {},
  };
}

export interface BuildResultParams {
  stateLabel: 'approved_downloaded' | 'sent_back';
  design?: A2uiDesign;
  exportInfo?: {
    format: string;
    resolution: string;
  };
  humanNote?: string;
}

export function buildResult({
  stateLabel,
  design,
  exportInfo,
  humanNote,
}: BuildResultParams): A2uiResult {
  const result: A2uiResult = {
    state: stateLabel,
  };

  if (design) {
    result.final_design = design;
  }

  if (humanNote !== undefined) {
    result.human_note = humanNote;
  }

  if (exportInfo && stateLabel === 'approved_downloaded') {
    result.export = {
      url: '',
      format: exportInfo.format,
      resolution: exportInfo.resolution,
    };
  }

  return result;
}
