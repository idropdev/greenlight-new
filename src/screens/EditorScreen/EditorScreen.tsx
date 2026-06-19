import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer, Rect, Group, Line } from 'react-konva';

import { useFlyerStore } from '../../features/flyer/flyerStore';
import type { FlyerType, ImageNode, SizeKey, TextNode } from '../../features/flyer/flyerStore';
import { getDimensionsForSize, FLYER_SIZE_INFO } from '../../features/flyer/sizes';
import { fieldConfig } from '../../features/flyer/fieldConfig';
import { buildTextNodes } from '../../features/flyer/layoutPresets';
import { useUnsplashSearch } from '../../features/unsplash/useUnsplashSearch';
import { TextControls } from '../../features/editor/TextControls';
import { useExport } from '../../features/editor/useExport';
import { ExportDialog } from '../../features/editor/ExportDialog';
import { PreviewOverlay } from '../../features/editor/PreviewOverlay';
import { ensureFontsLoaded, FONTS } from '../../lib/fonts';
import { formatFieldValue } from '../../lib/formatters';
import { trackEvent } from '../../lib/analytics';

const FLYER_TYPES: Array<{ key: FlyerType; label: string }> = [
  { key: 'event', label: 'Event' },
  { key: 'service', label: 'Service' },
  { key: 'product', label: 'Product' },
  { key: 'sale', label: 'Sale' },
  { key: 'realEstate', label: 'Real Estate' },
  { key: 'hiring', label: 'Hiring' },
];

const REQUIRED_FIELD_BY_TYPE: Record<FlyerType, string> = {
  event: 'title',
  service: 'businessName',
  product: 'productName',
  sale: 'headline',
  realEstate: 'propertyTitle',
  hiring: 'jobTitle',
};

type GuideLine = {
  orientation: 'H' | 'V';
  position: number;
};

type NodeBounds = {
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
};

const SNAP_THRESHOLD = 6;
const GUIDE_COLOR = '#7FA8D8';
const SNAP_GUIDE_COLOR = '#E4572E';
const TEXT_MIN_WIDTH = 40;
const TEXT_SIDE_ANCHORS = new Set(['middle-left', 'middle-right']);

function hasRequiredDetails(type: FlyerType | null, fields: Record<string, string>) {
  if (!type) return false;
  return Boolean(fields[REQUIRED_FIELD_BY_TYPE[type]]?.trim());
}

function useImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');

  useEffect(() => {
    if (!url) {
      let active = true;
      queueMicrotask(() => {
        if (active) {
          setImage(null);
          setStatus('idle');
        }
      });
      return () => {
        active = false;
      };
    }

    const img = new Image();
    if (!url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    let active = true;
    queueMicrotask(() => {
      if (active) {
        setStatus('loading');
      }
    });
    img.onload = () => {
      if (active) {
        setImage(img);
        setStatus('loaded');
      }
    };
    img.onerror = () => {
      if (active) {
        setImage(null);
        setStatus('failed');
      }
    };
    img.src = url;

    return () => {
      active = false;
    };
  }, [url]);

  return [image, status] as const;
}

function resolveNode(node: Partial<TextNode>) {
  return {
    shadowEnabled: node.shadowEnabled ?? true,
    shadowColor: node.shadowColor ?? '#000000',
    shadowBlur: node.shadowBlur ?? 6,
    shadowOpacity: node.shadowOpacity ?? 0.6,
    highlightEnabled: node.highlightEnabled ?? false,
    highlightColor: node.highlightColor ?? '#000000',
    highlightOpacity: node.highlightOpacity ?? 0.5,
  };
}

function estimateTextHeight(node: Pick<TextNode, 'text' | 'fontSize' | 'width'>) {
  const lineHeight = node.fontSize * 1.2;
  const estimatedLines = Math.max(1, Math.ceil((node.text.length * node.fontSize * 0.55) / Math.max(node.width, 1)));
  return lineHeight * estimatedLines;
}

function getTextMinWidth(node: Pick<TextNode, 'text' | 'fontFamily' | 'fontSize'>) {
  const longestWord = node.text
    .split(/\s+/)
    .reduce((longest, word) => word.length > longest.length ? word : longest, '');

  if (!longestWord) {
    return TEXT_MIN_WIDTH;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return TEXT_MIN_WIDTH;
  }

  context.font = `${node.fontSize}px ${node.fontFamily}`;
  return Math.max(TEXT_MIN_WIDTH, Math.ceil(context.measureText(longestWord).width));
}

function getTextWidth(text: string, fontSize: number, fontFamily: string) {
  if (!text) {
    return TEXT_MIN_WIDTH;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return TEXT_MIN_WIDTH;
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
  return Math.max(TEXT_MIN_WIDTH, Math.ceil(maxWidth));
}

function getNodeBounds(node: Pick<TextNode, 'x' | 'y' | 'text' | 'fontSize' | 'width'>): NodeBounds {
  const height = estimateTextHeight(node);
  return {
    left: node.x,
    centerX: node.x + node.width / 2,
    right: node.x + node.width,
    top: node.y,
    centerY: node.y + height / 2,
    bottom: node.y + height,
  };
}

function dedupePoints(points: number[]) {
  return Array.from(new Set(points.map((point) => Math.round(point * 100) / 100)));
}

function findClosestSnap(snapPoints: number[], position: number) {
  return snapPoints
    .map((snapPoint) => ({
      snapPoint,
      distance: Math.abs(position - snapPoint),
    }))
    .filter((match) => match.distance <= SNAP_THRESHOLD)
    .sort((a, b) => a.distance - b.distance)[0];
}

function nanoid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
}

type ImageNodeViewProps = {
  node: ImageNode;
  selected: boolean;
  onSelect: (event: Konva.KonvaEventObject<Event>) => void;
  onUpdate: (id: string, partial: Partial<ImageNode>) => void;
  onRemove: (id: string) => void;
  onReady: () => void;
};

const ImageNodeView: React.FC<ImageNodeViewProps> = ({ node, selected, onSelect, onUpdate, onRemove, onReady }) => {
  const [image] = useImage(node.url);

  useEffect(() => {
    if (image) {
      onReady();
    }
  }, [image, onReady]);

  if (!image) return null;

  return (
    <Group>
      <KonvaImage
        id={node.id}
        image={image}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={onSelect}
        onDragEnd={(event) => {
          onUpdate(node.id, {
            x: event.target.x(),
            y: event.target.y(),
          });
        }}
        onTransformEnd={(event) => {
          const imageNode = event.target as Konva.Image;
          const scaleX = imageNode.scaleX();
          const scaleY = imageNode.scaleY();

          imageNode.scaleX(1);
          imageNode.scaleY(1);

          onUpdate(node.id, {
            x: imageNode.x(),
            y: imageNode.y(),
            width: Math.max(20, imageNode.width() * scaleX),
            height: Math.max(20, imageNode.height() * scaleY),
          });
        }}
        onMouseEnter={(event) => {
          const stage = event.target.getStage();
          if (stage) stage.container().style.cursor = 'move';
        }}
        onMouseLeave={(event) => {
          const stage = event.target.getStage();
          if (stage) stage.container().style.cursor = 'default';
        }}
      />
      {selected && (
        <Group
          x={node.x + node.width - 12}
          y={node.y - 12}
          onClick={(event) => {
            event.cancelBubble = true;
            onRemove(node.id);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            onRemove(node.id);
          }}
          onMouseEnter={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(event) => {
            const stage = event.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
        >
          <Rect x={0} y={0} width={24} height={24} cornerRadius={12} fill="#2D2D2A" opacity={0.92} />
          <KonvaText
            text="x"
            x={0}
            y={2}
            width={24}
            height={20}
            align="center"
            verticalAlign="middle"
            fontFamily="Inter, Arial, sans-serif"
            fontSize={14}
            fill="#f5efe4"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
};

function PlatformIcon({ name }: { name: string }) {
  switch (name) {
    case 'instagram':
      return (
        <svg
          className="w-3.5 h-3.5 text-current"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'facebook':
      return (
        <svg
          className="w-3.5 h-3.5 text-current"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'threads':
      return (
        <svg
          className="w-3.5 h-3.5 text-current"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
        </svg>
      );
    case 'youtube':
      return (
        <svg
          className="w-3.5 h-3.5 text-current"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export const EditorScreen: React.FC = () => {
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const fields = useFlyerStore((state) => state.fields);
  const bgImageUrl = useFlyerStore((state) => state.bgImageUrl);
  const rawTextNodes = useFlyerStore((state) => state.textNodes);
  const textNodes = useMemo<TextNode[]>(() => {
    return rawTextNodes.map((node) => {
      const effectiveWidth = node.autoWidth !== false
        ? getTextWidth(node.text, node.fontSize, node.fontFamily)
        : node.width;
      return { ...node, width: effectiveWidth, autoWidth: node.autoWidth !== false };
    });
  }, [rawTextNodes]);
  const selectedNodeId = useFlyerStore((state) => state.selectedNodeId);
  const selectedNodeIds = useFlyerStore((state) => state.selectedNodeIds);
  const imageNodes = useFlyerStore((state) => state.imageNodes);
  const setType = useFlyerStore((state) => state.setType);
  const setSize = useFlyerStore((state) => state.setSize);
  const setField = useFlyerStore((state) => state.setField);
  const setTextNodes = useFlyerStore((state) => state.setTextNodes);
  const updateNode = useFlyerStore((state) => state.updateNode);
  const addImageNode = useFlyerStore((state) => state.addImageNode);
  const updateImageNode = useFlyerStore((state) => state.updateImageNode);
  const removeImageNode = useFlyerStore((state) => state.removeImageNode);
  const selectNodes = useFlyerStore((state) => state.selectNodes);
  const setBgImageUrl = useFlyerStore((state) => state.setBgImageUrl);
  const reset = useFlyerStore((state) => state.reset);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchKeywords, setSearchKeywords] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const [backgroundOpacity, setBackgroundOpacity] = useState(50);
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const [imageRenderVersion, setImageRenderVersion] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (selectedNodeId) {
      const isText = textNodes.some((n) => n.id === selectedNodeId);
      if (isText) return;

      const handle = setTimeout(() => {
        setIsExpanded(true);
      }, 0);
      return () => clearTimeout(handle);
    }
  }, [selectedNodeId, textNodes]);

  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.visualViewport ? window.visualViewport.height : window.innerHeight;
    }
    return 800;
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileLayout(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number;
    const handleVVChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        setViewportHeight(vv.height);

        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT'
        );

        const isHeightShrunk = vv.height < window.innerHeight - 150;
        setIsKeyboardOpen(Boolean(isInputFocused && isHeightShrunk));
      });
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVVChange);
      window.visualViewport.addEventListener('scroll', handleVVChange);
    }

    const handleFocusIn = (e: FocusEvent) => {
      setTimeout(handleVVChange, 50);
      
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    };

    const handleFocusOut = () => {
      setTimeout(handleVVChange, 100);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    handleVVChange();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVVChange);
        window.visualViewport.removeEventListener('scroll', handleVVChange);
      }
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const imageTransformerRef = useRef<Konva.Transformer | null>(null);
  const backgroundImageRef = useRef<Konva.Image | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const uploadedUrlRef = useRef<string | null>(null);
  const uploadedImageUrlsRef = useRef<Set<string>>(new Set());
  const dragStartRef = useRef<{
    draggedId: string;
    draggedX: number;
    draggedY: number;
    nodePositions: Record<string, { x: number; y: number }>;
  } | null>(null);
  const lastTextTransformAnchorRef = useRef<string | null>(null);

  const longPressTimeoutRef = useRef<Record<string, number>>({});
  const isLongPressActiveRef = useRef<Record<string, boolean>>({});
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const justLongPressedRef = useRef(false);
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialFontSize: number;
    initialX: number;
    initialY: number;
    initialMidpoint: { x: number; y: number };
    nodeId: string;
  } | null>(null);

  const { search, autoSearch, shuffle, isLoading: searchLoading, error: searchError, photos, noResults } = useUnsplashSearch();
  const [imgElement, imgStatus] = useImage(bgImageUrl);
  const { exportFlyer, isExporting, generatePreviewUrl } = useExport(stageRef, transformerRef, imageTransformerRef);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [isGeneratingExportPreview, setIsGeneratingExportPreview] = useState(false);

  const handleOpenPreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const url = await generatePreviewUrl();
      if (url) {
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [generatePreviewUrl]);

  const handleClosePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleOpenExportModal = useCallback(async () => {
    setShowExportModal(true);
    setIsGeneratingExportPreview(true);
    setExportPreviewUrl(null);
    try {
      const url = await generatePreviewUrl(1);
      if (url) {
        setExportPreviewUrl(url);
      }
    } catch (error) {
      console.error('Error generating export preview:', error);
    } finally {
      setIsGeneratingExportPreview(false);
    }
  }, [generatePreviewUrl]);

  const handleCloseExportModal = useCallback(() => {
    setShowExportModal(false);
    setExportPreviewUrl(null);
  }, []);



  // Lock body scroll when preview or export overlay is open
  useEffect(() => {
    if (previewUrl || showExportModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewUrl, showExportModal]);

  // Handle Escape key to close overlays
  useEffect(() => {
    if (!previewUrl && !showExportModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewUrl) handleClosePreview();
        if (showExportModal) handleCloseExportModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewUrl, showExportModal, handleClosePreview, handleCloseExportModal]);

  const dimensions = getDimensionsForSize(size);
  const { width: trueWidth, height: trueHeight } = dimensions;
  const currentSizeInfo = FLYER_SIZE_INFO.find((s) => s.key === size);
  const fieldDefinitions = type ? fieldConfig[type] : [];
  const canExport = Boolean(bgImageUrl || textNodes.length > 0 || imageNodes.length > 0);
  const selectedImageNode = imageNodes.find((node) => node.id === selectedNodeId);
  const selectedTextNode = textNodes.find((node) => node.id === selectedNodeId);
  const isImageLoading = Boolean(bgImageUrl && imgStatus === 'loading');
  const isFetchingOrLoading = searchLoading || isImageLoading;
  const showNoImagesMessage = noResults && !bgImageUrl;
  const isCanvasEmpty = textNodes.length === 0 && bgImageUrl === null;
  const hasDetailsForCreate = hasRequiredDetails(type, fields);
  const primaryBackgroundDisabled = isCanvasEmpty
    ? isFetchingOrLoading || !hasDetailsForCreate
    : isFetchingOrLoading || showNoImagesMessage;
  const primaryBackgroundTitle = isCanvasEmpty && !hasDetailsForCreate
    ? 'Fill in the details first'
    : showNoImagesMessage && !isCanvasEmpty
      ? 'No images to shuffle'
      : undefined;
  const primaryBackgroundLabel = isFetchingOrLoading
    ? isCanvasEmpty ? 'Creating...' : 'Shuffling...'
    : isCanvasEmpty ? 'Create Flyer' : showNoImagesMessage ? 'No images to shuffle' : 'Shuffle Background';
  const backgroundImageOpacity = Math.min(backgroundOpacity, 50) / 50;
  const backgroundDarkOverlayOpacity = Math.max(backgroundOpacity - 50, 0) / 50;

  const [scale, setScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 400, height: 400 });

  const updateSelectedTextNodes = useCallback((partial: Partial<TextNode>) => {
    const targetIds = selectedNodeIds.length > 1 ? selectedNodeIds : selectedTextNode ? [selectedTextNode.id] : [];
    targetIds.forEach((id) => updateNode(id, partial));
  }, [selectedNodeIds, selectedTextNode, updateNode]);

  const [isShufflingFont, setIsShufflingFont] = useState(false);

  const handleShuffleFont = useCallback(async () => {
    if (!selectedTextNode) return;
    setIsShufflingFont(true);
    try {
      const currentIndex = FONTS.findIndex((f) => f.family === selectedTextNode.fontFamily);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % FONTS.length;
      const nextFont = FONTS[nextIndex];

      await ensureFontsLoaded();

      updateSelectedTextNodes({ fontFamily: nextFont.family });
      stageRef.current?.batchDraw();
    } catch (err) {
      console.error('[FontShuffle] Failed to shuffle font in inline widget:', err);
    } finally {
      setIsShufflingFont(false);
    }
  }, [selectedTextNode, updateSelectedTextNodes]);

  const inlineWidgetPos = useMemo(() => {
    if (!selectedTextNode) return null;

    const textHeight = estimateTextHeight(selectedTextNode);
    
    // Scale true-pixel bounds to display space (screen coords relative to Stage)
    const nodeLeft = selectedTextNode.x * scale;
    const nodeWidth = selectedTextNode.width * scale;
    const nodeTop = selectedTextNode.y * scale;
    const nodeHeight = textHeight * scale;

    const widgetWidth = 320; // approximate width of the widget
    const widgetHeight = 44; // approximate height of the widget
    const gap = 12; // gap between node and widget

    // Preferred position: horizontally centered above the node
    let left = nodeLeft + (nodeWidth - widgetWidth) / 2;
    let top = nodeTop - widgetHeight - gap;

    // Flip below the node if it would go off the top of the Stage
    if (top < 0) {
      top = nodeTop + nodeHeight + gap;
    }

    // Clamp coordinates to stay completely within the Stage boundaries
    left = Math.max(4, Math.min(stageSize.width - widgetWidth - 4, left));
    top = Math.max(4, Math.min(stageSize.height - widgetHeight - 4, top));

    return { left, top };
  }, [selectedTextNode, scale, stageSize]);

  const transformerProps = useMemo(() => {
    const targetAnchorSize = 12 / scale;
    const targetStrokeWidth = 2 / scale;
    const targetBorderStrokeWidth = 1.2 / scale;
    return {
      anchorSize: Math.max(6, Math.min(60, Math.round(targetAnchorSize))),
      anchorStrokeWidth: Math.max(1, Math.min(4, targetStrokeWidth)),
      borderStrokeWidth: Math.max(1, Math.min(4, targetBorderStrokeWidth)),
    };
  }, [scale]);

  useEffect(() => {
    if (transformerRef.current) {
      transformerRef.current.forceUpdate();
      transformerRef.current.getLayer()?.batchDraw();
    }
    if (imageTransformerRef.current) {
      imageTransformerRef.current.forceUpdate();
      imageTransformerRef.current.getLayer()?.batchDraw();
    }
  }, [scale]);

  useEffect(() => {
    Konva.hitOnDragEnabled = true;
    let active = true;
    ensureFontsLoaded().then(() => {
      if (active) {
        setFontsLoaded(true);
        stageRef.current?.batchDraw();
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const uploadedImageUrls = uploadedImageUrlsRef.current;

    return () => {
      if (uploadedUrlRef.current) {
        URL.revokeObjectURL(uploadedUrlRef.current);
      }
      uploadedImageUrls.forEach((url) => URL.revokeObjectURL(url));
      uploadedImageUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (searchError) {
      const showTimer = window.setTimeout(() => setToastMessage(searchError), 0);
      const hideTimer = window.setTimeout(() => setToastMessage(null), 5000);
      return () => {
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
      };
    }
  }, [searchError]);

  useEffect(() => {
    if (!type || !bgImageUrl || textNodes.length > 0 || !hasRequiredDetails(type, fields)) {
      return;
    }

    const generatedNodes = buildTextNodes(type, size, fields);
    if (generatedNodes.length > 0) {
      setTextNodes(generatedNodes);
      trackEvent('flyer_created', { flyerType: type, size });
    }
  }, [type, size, fields, bgImageUrl, textNodes.length, setTextNodes]);

  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    const selectedNodes = selectedNodeIds
      .map((id) => stage?.findOne('#' + id))
      .filter((node): node is Konva.Node => Boolean(node));

    if (selectedNodes.length > 0 && transformer) {
      transformer.nodes(selectedNodes);
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedNodeIds, textNodes]);

  useEffect(() => {
    const stage = stageRef.current;
    const transformer = imageTransformerRef.current;
    const selectedImage = selectedImageNode ? stage?.findOne('#' + selectedImageNode.id) : null;

    if (selectedImage && transformer) {
      transformer.nodes([selectedImage]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    imageTransformerRef.current?.nodes([]);
    imageTransformerRef.current?.getLayer()?.batchDraw();
  }, [selectedImageNode, imageNodes, imageRenderVersion]);

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    if (isKeyboardOpen) return;
    const padding = 32;
    const containerW = Math.max(containerRef.current.clientWidth - padding, 200);
    const containerH = Math.max(containerRef.current.clientHeight - padding, 200);
    const newScale = Math.min(containerW / trueWidth, containerH / trueHeight);

    setScale(newScale);
    setStageSize({
      width: trueWidth * newScale,
      height: trueHeight * newScale,
    });
  }, [trueWidth, trueHeight, isKeyboardOpen]);

  useEffect(() => {
    if (!containerRef.current) return;
    updateScale();
    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [updateScale]);

  const cropData = useMemo(() => {
    if (!imgElement) return undefined;

    const imgWidth = imgElement.width;
    const imgHeight = imgElement.height;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = trueWidth / trueHeight;

    if (imgRatio > canvasRatio) {
      const cropWidth = imgHeight * canvasRatio;
      return {
        x: (imgWidth - cropWidth) / 2,
        y: 0,
        width: cropWidth,
        height: imgHeight,
      };
    }

    const cropHeight = imgWidth / canvasRatio;
    return {
      x: 0,
      y: (imgHeight - cropHeight) / 2,
      width: imgWidth,
      height: cropHeight,
    };
  }, [imgElement, trueWidth, trueHeight]);

  useEffect(() => {
    const imageNode = backgroundImageRef.current;
    if (!imageNode) return;

    if (backgroundBlur > 0) {
      imageNode.cache();
    } else {
      imageNode.clearCache();
    }

    imageNode.getLayer()?.batchDraw();
  }, [backgroundBlur, imgElement, cropData, trueWidth, trueHeight]);

  const gridLines = useMemo(() => {
    const spacing = 90;
    const vertical = Array.from({ length: Math.floor(trueWidth / spacing) + 1 }, (_, index) => ({
      id: `v-${index}`,
      points: [index * spacing, 0, index * spacing, trueHeight],
    }));
    const horizontal = Array.from({ length: Math.floor(trueHeight / spacing) + 1 }, (_, index) => ({
      id: `h-${index}`,
      points: [0, index * spacing, trueWidth, index * spacing],
    }));
    return [...vertical, ...horizontal];
  }, [trueWidth, trueHeight]);

  const handleSizeChange = useCallback((newSize: SizeKey) => {
    if (newSize === size) return;
    setSize(newSize);
    trackEvent('size_changed', { size: newSize });

    const clampMargin = 20;
    const newDims = getDimensionsForSize(newSize);
    textNodes.forEach((node) => {
      const clampedX = Math.max(0, Math.min(node.x, newDims.width - clampMargin));
      const clampedY = Math.max(0, Math.min(node.y, newDims.height - clampMargin));
      if (clampedX !== node.x || clampedY !== node.y) {
        updateNode(node.id, { x: clampedX, y: clampedY });
      }
    });
  }, [size, setSize, textNodes, updateNode]);

  const handleTypeChange = useCallback((newType: FlyerType) => {
    if (newType === type) return;

    setType(newType);
    trackEvent('campaign_type_selected', { flyerType: newType });
    selectNodes([]);
    setTextNodes([]);

    if (bgImageUrl && hasRequiredDetails(newType, fields)) {
      const generatedNodes = buildTextNodes(newType, size, fields);
      setTextNodes(generatedNodes);
      trackEvent('flyer_created', { flyerType: newType, size });
    }
  }, [type, setType, selectNodes, setTextNodes, bgImageUrl, fields, size]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setField(key, value);
    const updatedFields = { ...fields, [key]: value };
    const targetKey = (key === 'startTime' || key === 'endTime') ? 'startTime' : key;
    const matchingNode = textNodes.find((node) => node.field === targetKey);
    if (matchingNode) {
      updateNode(matchingNode.id, { text: formatFieldValue(targetKey, updatedFields[targetKey], updatedFields) });
    }
  }, [setField, fields, textNodes, updateNode]);

  const handleKeywordSearch = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = searchKeywords.trim();
    if (trimmed) {
      search(trimmed, type || 'flyer');
    }
  }, [searchKeywords, search, type]);

  const handleShuffle = useCallback(() => {
    if (showNoImagesMessage) {
      return;
    }

    if (photos.length > 1) {
      shuffle();
      return;
    }

    autoSearch(type, fields);
  }, [showNoImagesMessage, photos.length, shuffle, fields, type, autoSearch]);

  const handleTextSelect = useCallback((
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
    id: string
  ) => {
    event.cancelBubble = true;

    const isShiftClick = 'shiftKey' in event.evt && event.evt.shiftKey;
    if (!isShiftClick) {
      selectNodes([id]);
      return;
    }

    const current = useFlyerStore.getState();
    const alreadySelected = current.selectedNodeIds.includes(id);

    if (!alreadySelected) {
      selectNodes([...current.selectedNodeIds, id]);
      return;
    }

    const remainingIds = current.selectedNodeIds.filter((selectedId) => selectedId !== id);
    if (current.selectedNodeId === id) {
      selectNodes(remainingIds);
      return;
    }

    useFlyerStore.setState({ selectedNodeIds: remainingIds });
  }, [selectNodes]);

  const toggleNodeSelection = useCallback((id: string) => {
    const current = useFlyerStore.getState();
    const alreadySelected = current.selectedNodeIds.includes(id);

    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(50);
      } catch {
        // ignore vibration issues
      }
    }

    if (!alreadySelected) {
      selectNodes([...current.selectedNodeIds, id]);
    } else {
      const remainingIds = current.selectedNodeIds.filter((selectedId) => selectedId !== id);
      selectNodes(remainingIds);
    }
  }, [selectNodes]);

  const handleTouchStartText = useCallback((event: Konva.KonvaEventObject<TouchEvent>, node: TextNode) => {
    event.evt.preventDefault();

    const touch = event.evt.touches[0];
    if (!touch) return;

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActiveRef.current[node.id] = false;

    if (longPressTimeoutRef.current[node.id]) {
      window.clearTimeout(longPressTimeoutRef.current[node.id]);
    }

    longPressTimeoutRef.current[node.id] = window.setTimeout(() => {
      isLongPressActiveRef.current[node.id] = true;
      justLongPressedRef.current = true;
      toggleNodeSelection(node.id);
      
      setTimeout(() => {
        justLongPressedRef.current = false;
      }, 300);
    }, 450);
  }, [toggleNodeSelection]);

  const handleTouchMoveText = useCallback((event: Konva.KonvaEventObject<TouchEvent>, node: TextNode) => {
    if (touchStartPosRef.current) {
      const touch = event.evt.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartPosRef.current.x;
      const dy = touch.clientY - touchStartPosRef.current.y;

      if (Math.hypot(dx, dy) > 10) {
        if (longPressTimeoutRef.current[node.id]) {
          window.clearTimeout(longPressTimeoutRef.current[node.id]);
          delete longPressTimeoutRef.current[node.id];
        }
      }
    }
  }, []);

  const handleTouchEndText = useCallback((_event: Konva.KonvaEventObject<TouchEvent>, node: TextNode) => {
    if (longPressTimeoutRef.current[node.id]) {
      window.clearTimeout(longPressTimeoutRef.current[node.id]);
      delete longPressTimeoutRef.current[node.id];
    }
    isLongPressActiveRef.current[node.id] = false;
  }, []);

  const handleTouchStart = useCallback((event: Konva.KonvaEventObject<TouchEvent>) => {
    if (event.evt.touches.length === 2 && selectedNodeIds.length === 1) {
      const selectedId = selectedNodeIds[0];
      const node = textNodes.find((n) => n.id === selectedId);
      if (node) {
        const stage = stageRef.current;
        if (!stage) return;
        
        const rect = stage.container().getBoundingClientRect();
        const touch1 = event.evt.touches[0];
        const touch2 = event.evt.touches[1];
        
        const p1 = { x: (touch1.clientX - rect.left) / scale, y: (touch1.clientY - rect.top) / scale };
        const p2 = { x: (touch2.clientX - rect.left) / scale, y: (touch2.clientY - rect.top) / scale };
        
        const bounds = getNodeBounds(node);
        const isNearNode = (p: { x: number; y: number }) => {
          const pad = 40;
          return (
            p.x >= bounds.left - pad &&
            p.x <= bounds.right + pad &&
            p.y >= bounds.top - pad &&
            p.y <= bounds.bottom + pad
          );
        };
        
        if (isNearNode(p1) || isNearNode(p2)) {
          event.evt.preventDefault();
          const initialDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
          const initialMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          
          pinchStateRef.current = {
            initialDistance,
            initialFontSize: node.fontSize,
            initialX: node.x,
            initialY: node.y,
            initialMidpoint,
            nodeId: node.id,
          };
        }
      }
    }
  }, [selectedNodeIds, textNodes, scale]);

  const handleTouchMove = useCallback((event: Konva.KonvaEventObject<TouchEvent>) => {
    if (pinchStateRef.current) {
      event.evt.preventDefault();
      
      const touch1 = event.evt.touches[0];
      const touch2 = event.evt.touches[1];
      if (!touch1 || !touch2) return;
      
      const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const initialDistance = pinchStateRef.current.initialDistance;
      
      if (initialDistance > 0) {
        let scaleFactor = currentDistance / initialDistance;
        
        const minScale = 8 / pinchStateRef.current.initialFontSize;
        if (scaleFactor < minScale) {
          scaleFactor = minScale;
        }
        
        const stage = stageRef.current;
        const groupNode = stage?.findOne('#' + pinchStateRef.current.nodeId) as Konva.Group | undefined;
        
        if (groupNode) {
          const state = pinchStateRef.current;
          const x_new = state.initialMidpoint.x + (state.initialX - state.initialMidpoint.x) * scaleFactor;
          const y_new = state.initialMidpoint.y + (state.initialY - state.initialMidpoint.y) * scaleFactor;
          
          groupNode.scale({ x: scaleFactor, y: scaleFactor });
          groupNode.position({ x: x_new, y: y_new });
          
          if (transformerRef.current) {
            transformerRef.current.forceUpdate();
          }
          
          groupNode.getLayer()?.batchDraw();
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback((event: Konva.KonvaEventObject<TouchEvent>) => {
    if (pinchStateRef.current) {
      event.evt.preventDefault();
      
      const state = pinchStateRef.current;
      const stage = stageRef.current;
      const groupNode = stage?.findOne('#' + state.nodeId) as Konva.Group | undefined;
      
      if (groupNode) {
        const finalScale = groupNode.scaleX();
        const finalX = groupNode.x();
        const finalY = groupNode.y();
        
        groupNode.scale({ x: 1, y: 1 });
        groupNode.getLayer()?.batchDraw();
        
        const newFontSize = Math.max(8, Math.round(state.initialFontSize * finalScale));
        
        updateNode(state.nodeId, {
          x: finalX,
          y: finalY,
          fontSize: newFontSize,
        });
      }
      
      pinchStateRef.current = null;
    }
  }, [updateNode]);

  const handleTextDragStart = useCallback((node: TextNode) => {
    const current = useFlyerStore.getState();
    const selectedIds = current.selectedNodeIds.includes(node.id)
      ? current.selectedNodeIds
      : [node.id];

    if (!current.selectedNodeIds.includes(node.id)) {
      selectNodes([node.id]);
    }

    dragStartRef.current = {
      draggedId: node.id,
      draggedX: node.x,
      draggedY: node.y,
      nodePositions: Object.fromEntries(
        current.textNodes
          .filter((textNode) => selectedIds.includes(textNode.id))
          .map((textNode) => [textNode.id, { x: textNode.x, y: textNode.y }])
      ),
    };
  }, [selectNodes]);

  const handleTextDragMove = useCallback((event: Konva.KonvaEventObject<DragEvent>, node: TextNode) => {
    const draggedNode = event.target as Konva.Group;
    const draggedBounds = getNodeBounds({
      ...node,
      x: draggedNode.x(),
      y: draggedNode.y(),
    });
    const selectedIdSet = new Set(useFlyerStore.getState().selectedNodeIds);
    const otherNodeBounds = textNodes
      .filter((textNode) => textNode.id !== node.id && !selectedIdSet.has(textNode.id))
      .map(getNodeBounds);

    const verticalSnapPoints = dedupePoints([
      0,
      trueWidth / 2,
      trueWidth,
      ...otherNodeBounds.flatMap((bounds) => [bounds.left, bounds.centerX, bounds.right]),
    ]);
    const horizontalSnapPoints = dedupePoints([
      0,
      trueHeight / 2,
      trueHeight,
      ...otherNodeBounds.flatMap((bounds) => [bounds.top, bounds.centerY, bounds.bottom]),
    ]);

    let snappedX = draggedNode.x();
    let snappedY = draggedNode.y();
    const guides: GuideLine[] = [];

    const verticalMatches = [
      { position: draggedBounds.left, offset: 0 },
      { position: draggedBounds.centerX, offset: node.width / 2 },
      { position: draggedBounds.right, offset: node.width },
    ].flatMap((edge) =>
      verticalSnapPoints.map((snapPoint) => ({
        snapPoint,
        offset: edge.offset,
        distance: Math.abs(edge.position - snapPoint),
      }))
    );
    const closestVertical = verticalMatches
      .filter((match) => match.distance <= SNAP_THRESHOLD)
      .sort((a, b) => a.distance - b.distance)[0];

    if (closestVertical) {
      snappedX = closestVertical.snapPoint - closestVertical.offset;
      guides.push({ orientation: 'V', position: closestVertical.snapPoint });
    }

    const nodeHeight = estimateTextHeight(node);
    const horizontalMatches = [
      { position: draggedBounds.top, offset: 0 },
      { position: draggedBounds.centerY, offset: nodeHeight / 2 },
      { position: draggedBounds.bottom, offset: nodeHeight },
    ].flatMap((edge) =>
      horizontalSnapPoints.map((snapPoint) => ({
        snapPoint,
        offset: edge.offset,
        distance: Math.abs(edge.position - snapPoint),
      }))
    );
    const closestHorizontal = horizontalMatches
      .filter((match) => match.distance <= SNAP_THRESHOLD)
      .sort((a, b) => a.distance - b.distance)[0];

    if (closestHorizontal) {
      snappedY = closestHorizontal.snapPoint - closestHorizontal.offset;
      guides.push({ orientation: 'H', position: closestHorizontal.snapPoint });
    }

    if (snappedX !== draggedNode.x() || snappedY !== draggedNode.y()) {
      draggedNode.position({ x: snappedX, y: snappedY });
    }

    const dragStart = dragStartRef.current;
    if (dragStart && dragStart.draggedId === node.id) {
      const dx = draggedNode.x() - dragStart.draggedX;
      const dy = draggedNode.y() - dragStart.draggedY;

      Object.entries(dragStart.nodePositions).forEach(([id, position]) => {
        if (id !== node.id) {
          const stage = draggedNode.getStage();
          const otherNode = stage?.findOne('#' + id);
          if (otherNode) {
            otherNode.position({
              x: position.x + dx,
              y: position.y + dy,
            });
          }
        }
      });
    }

    setActiveGuides(guides);
    draggedNode.getLayer()?.batchDraw();
  }, [textNodes, trueWidth, trueHeight]);

  const handleTextTransform = useCallback((event: Konva.KonvaEventObject<Event>, node: TextNode) => {
    const activeAnchor = transformerRef.current?.getActiveAnchor() ?? null;
    lastTextTransformAnchorRef.current = activeAnchor;

    if (!activeAnchor || !TEXT_SIDE_ANCHORS.has(activeAnchor)) {
      setActiveGuides([]);
      return;
    }

    const transformedNode = event.target as Konva.Group;
    const textChild = transformedNode.findOne('Text') as Konva.Text | undefined;
    const currentWidth = textChild ? textChild.width() : node.width;

    const minWidth = getTextMinWidth(node);
    const scaledWidth = Math.max(minWidth, currentWidth * Math.abs(transformedNode.scaleX()));
    const resizedLeft = transformedNode.x();
    const resizedRight = resizedLeft + scaledWidth;
    const selectedIdSet = new Set(useFlyerStore.getState().selectedNodeIds);
    const otherNodeBounds = textNodes
      .filter((textNode) => textNode.id !== node.id && !selectedIdSet.has(textNode.id))
      .map(getNodeBounds);

    const verticalSnapPoints = dedupePoints([
      0,
      trueWidth / 2,
      trueWidth,
      ...otherNodeBounds.flatMap((bounds) => [bounds.left, bounds.centerX, bounds.right]),
    ]);

    let nextX = resizedLeft;
    let nextWidth = scaledWidth;
    const guides: GuideLine[] = [];

    if (activeAnchor === 'middle-right') {
      const closestRight = findClosestSnap(verticalSnapPoints, resizedRight);
      if (closestRight) {
        nextWidth = closestRight.snapPoint - nextX;
        guides.push({ orientation: 'V', position: closestRight.snapPoint });
      }
      nextWidth = Math.max(minWidth, nextWidth);
    } else {
      const closestLeft = findClosestSnap(verticalSnapPoints, resizedLeft);
      if (closestLeft) {
        nextX = closestLeft.snapPoint;
        nextWidth = resizedRight - nextX;
        guides.push({ orientation: 'V', position: closestLeft.snapPoint });
      }

      if (nextWidth < minWidth) {
        nextX = resizedRight - minWidth;
        nextWidth = minWidth;
      }
    }

    transformedNode.position({ x: nextX, y: transformedNode.y() });
    transformedNode.scaleX(1);
    transformedNode.scaleY(1);

    if (textChild) {
      textChild.width(nextWidth);
    }

    const highlightPad = 8;
    const highlightBg = transformedNode.findOne('.highlight-bg') as Konva.Rect | undefined;
    if (highlightBg) {
      const estimatedHeight = estimateTextHeight({
        text: node.text,
        fontSize: node.fontSize,
        width: nextWidth,
      });
      highlightBg.width(nextWidth + highlightPad * 2);
      highlightBg.height(estimatedHeight + highlightPad * 2);
    }

    const touchHitArea = transformedNode.findOne('.touch-hit-area') as Konva.Rect | undefined;
    if (touchHitArea) {
      const estimatedHeight = estimateTextHeight({
        text: node.text,
        fontSize: node.fontSize,
        width: nextWidth,
      });
      touchHitArea.width(nextWidth + 20);
      touchHitArea.height(estimatedHeight + 20);
    }

    setActiveGuides(guides);
    transformedNode.getLayer()?.batchDraw();
  }, [textNodes, trueWidth]);

  const addImageFileAsNode = useCallback((file: File, position?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedImageUrlsRef.current.add(objectUrl);

    const image = new Image();
    image.onload = () => {
      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      const maxWidth = trueWidth * 0.3;
      const width = Math.min(maxWidth, naturalWidth);
      const height = naturalHeight * (width / Math.max(naturalWidth, 1));
      const x = position ? position.x - width / 2 : (trueWidth - width) / 2;
      const y = position ? position.y - height / 2 : (trueHeight - height) / 2;

      addImageNode({
        id: nanoid(),
        url: objectUrl,
        x: Math.max(0, Math.min(x, trueWidth - width)),
        y: Math.max(0, Math.min(y, trueHeight - height)),
        width,
        height,
      });
      trackEvent('image_uploaded', { source: 'upload' });
    };
    image.onerror = () => {
      uploadedImageUrlsRef.current.delete(objectUrl);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  }, [addImageNode, trueWidth, trueHeight]);

  const handleImageFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addImageFileAsNode(file);

    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  }, [addImageFileAsNode]);

  const handleImageSelect = useCallback((event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    const id = event.target.id();
    useFlyerStore.setState({ selectedNodeId: id, selectedNodeIds: [] });
  }, []);

  const handleImageReady = useCallback(() => {
    setImageRenderVersion((version) => version + 1);
  }, []);

  const handleRemoveImageNode = useCallback((id: string) => {
    const node = useFlyerStore.getState().imageNodes.find((imageNode) => imageNode.id === id);
    if (node && uploadedImageUrlsRef.current.has(node.url)) {
      uploadedImageUrlsRef.current.delete(node.url);
      URL.revokeObjectURL(node.url);
    }
    removeImageNode(id);
  }, [removeImageNode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' || !selectedImageNode) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      handleRemoveImageNode(selectedImageNode.id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRemoveImageNode, selectedImageNode]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedUrlRef.current = objectUrl;
    setBgImageUrl(objectUrl);
    trackEvent('image_uploaded', { source: 'upload' });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setBgImageUrl]);

  const handleReset = useCallback(() => {
    if (!window.confirm('Start over and clear this flyer?')) return;
    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current);
      uploadedUrlRef.current = null;
    }
    uploadedImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadedImageUrlsRef.current.clear();
    selectNodes([]);
    reset();
  }, [reset, selectNodes]);

  const renderPreviewButton = (isMobile: boolean) => (
    <button
      id={isMobile ? "preview-btn-mobile" : "preview-btn"}
      onClick={handleOpenPreview}
      disabled={isCanvasEmpty || isGeneratingPreview}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg shadow-md transition-all duration-200 border border-graphite/15 font-display min-h-[44px] md:min-h-0 ${
        isCanvasEmpty || isGeneratingPreview
          ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed shadow-none border-transparent'
          : 'bg-white text-graphite hover:text-pencil hover:border-pencil/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-graphite/5'
      }`}
    >
      {isGeneratingPreview ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Preparing
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" />
          </svg>
          {isMobile ? 'Preview' : 'Full View'}
        </>
      )}
    </button>
  );

  const renderDownloadButton = (isMobile: boolean) => (
    <button
      id={isMobile ? "download-btn-mobile" : "download-btn"}
      onClick={handleOpenExportModal}
      disabled={!canExport || isExporting}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg shadow-md transition-all duration-200 border border-transparent font-display min-h-[44px] md:min-h-0 ${
        !canExport || isExporting
          ? 'bg-graphite/15 text-graphite-muted cursor-not-allowed shadow-none'
          : 'bg-pencil text-bone hover:bg-pencil/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-pencil/15'
      }`}
    >
      {isExporting ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Exporting
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </>
      )}
    </button>
  );

  return (
    <div
      style={isMobileLayout ? { height: `${viewportHeight}px` } : undefined}
      className="h-dvh bg-bone text-graphite flex flex-col md:flex-row items-stretch relative overflow-hidden"
    >
      {/* Mobile Top Bar */}
      <div className="flex md:hidden h-14 bg-bone-light border-b border-nonrepro/25 px-4 items-center justify-between flex-shrink-0 z-40 pt-safe">
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-graphite font-display leading-none">Greenlight</span>
          <span className="text-[10px] text-graphite-muted mt-0.5">Paste-up flyer editor</span>
        </div>
        <div className="flex items-center gap-2">
          {renderPreviewButton(true)}
          {renderDownloadButton(true)}
        </div>
      </div>

      {/* Desktop Download Button Container */}
      <div className="hidden md:block absolute top-4 right-4 z-40">
        <div className="flex items-center gap-2">
          {renderPreviewButton(false)}
          {renderDownloadButton(false)}
        </div>
      </div>

      <aside
        className={`w-full md:w-[22rem] lg:w-96 bg-bone-light border-t md:border-t-0 md:border-r border-nonrepro/25 z-30 flex flex-col overflow-hidden rounded-t-2xl md:rounded-t-none order-2 md:order-1 ${
          isMobileLayout
            ? 'flex-1 min-h-0 h-full rounded-t-none border-t-0'
            : 'md:h-dvh'
        }`}
      >
        {/* Mobile Drawer Header */}
        {!isMobileLayout && (
          <div 
            className="flex md:hidden items-center justify-between px-5 h-14 border-b border-nonrepro/15 cursor-pointer select-none flex-shrink-0 bg-bone-light"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-nonrepro animate-pulse" />
              <span className="text-sm font-bold tracking-tight text-graphite font-display">
                {isExpanded ? 'Collapse Editor Controls' : 'Expand Editor Controls'}
              </span>
            </div>
            <button type="button" className="text-graphite-muted focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Scrollable Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-5 editor-sidebar">
          {/* Title Section (Desktop only) */}
          <div className="hidden md:block space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-graphite font-display">Greenlight</h1>
            <p className="text-graphite-muted text-xs">Paste-up flyer editor</p>
          </div>

          {selectedTextNode ? (
            <>
              {/* On mobile, TextControls lives here inside the drawer. On desktop it lives outside. */}
              <div className="block md:hidden">
                <TextControls 
                  onFontChange={() => stageRef.current?.batchDraw()} 
                  onBack={() => selectNodes([])}
                />
              </div>
              {/* On desktop, show normal sidebar controls too. */}
              <div className="hidden md:flex flex-col gap-5">
                <section className="space-y-3">
                  <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Campaign Type</h2>
                  <div className="flex flex-wrap gap-2">
                    {FLYER_TYPES.map((flyerType) => {
                      const isActive = type === flyerType.key;
                      return (
                        <button
                          key={flyerType.key}
                          type="button"
                          onClick={() => handleTypeChange(flyerType.key)}
                          className={`flex-1 min-w-[5.75rem] px-3 py-3 md:py-2 rounded-lg text-base md:text-sm font-semibold border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nonrepro focus:ring-offset-2 focus:ring-offset-bone-light min-h-[44px] md:min-h-0 ${
                            isActive
                              ? 'bg-nonrepro/10 border-nonrepro text-nonrepro shadow-sm'
                              : 'bg-white border-nonrepro/25 text-graphite-muted hover:text-graphite hover:border-nonrepro/50'
                          }`}
                        >
                          {flyerType.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Canvas Size</h2>
                  <div className="flex gap-1.5">
                    {FLYER_SIZE_INFO.map((s) => {
                      const isActive = size === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => handleSizeChange(s.key)}
                          title={s.blurb}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 px-1.5 py-3 md:py-2.5 rounded-lg text-center transition-all duration-200 border min-h-[56px] md:min-h-[48px] ${
                            isActive
                              ? 'bg-nonrepro/10 border-nonrepro text-nonrepro ring-1 ring-nonrepro/25 shadow-sm'
                              : 'bg-white border-nonrepro/20 text-graphite-muted hover:border-nonrepro/45 hover:text-graphite'
                          }`}
                        >
                          <span className="text-[11px] font-bold font-display leading-tight">{s.label}</span>
                          <span className="text-[9px] font-mono opacity-70">{s.aspect}</span>
                          {s.platforms && (
                            <div className="flex gap-1 items-center justify-center mt-0.5 opacity-80">
                              {s.platforms.map((plat) => (
                                <PlatformIcon key={plat} name={plat} />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {currentSizeInfo && (
                    <p className="text-[10px] text-graphite-muted leading-snug">
                      {currentSizeInfo.blurb}
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Details</h2>
                  <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
                    {fieldDefinitions.map((field) => {
                      const value = fields[field.key] || '';
                      const targetKey = (type === 'event' && field.key === 'endTime') ? 'startTime' : field.key;
                      const hasTextNode = textNodes.some((n) => n.id === targetKey);

                      return (
                        <div key={field.key} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label htmlFor={`field-${field.key}`} className="text-xs font-semibold text-graphite">
                              {field.label}
                            </label>
                            {hasTextNode && (
                              <button
                                type="button"
                                onClick={() => selectNodes([targetKey])}
                                className="text-[11px] font-semibold text-pencil hover:text-pencil/80 flex items-center gap-1 cursor-pointer min-h-[30px] focus:outline-none"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Style
                              </button>
                            )}
                          </div>
                          {field.multiline ? (
                            <textarea
                              id={`field-${field.key}`}
                              name={field.key}
                              placeholder={field.placeholder}
                              value={value}
                              onChange={(event) => handleFieldChange(field.key, event.target.value)}
                              rows={3}
                              className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none resize-y min-h-[44px]"
                            />
                          ) : (
                            <input
                              type="text"
                              id={`field-${field.key}`}
                              name={field.key}
                              placeholder={field.placeholder}
                              value={value}
                              onChange={(event) => handleFieldChange(field.key, event.target.value)}
                              className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none min-h-[44px] md:min-h-0"
                            />
                          )}
                        </div>
                      );
                    })}
                  </form>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Background</h2>
                  <button
                    type="button"
                    onClick={handleShuffle}
                    disabled={primaryBackgroundDisabled}
                    title={primaryBackgroundTitle}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-base md:text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 border font-display min-h-[44px] md:min-h-0 ${
                      primaryBackgroundDisabled
                        ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed pointer-events-none border-graphite/10 shadow-none'
                        : isCanvasEmpty
                          ? 'bg-pencil text-bone border-transparent hover:bg-pencil/90 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-pencil/15'
                        : 'bg-white text-graphite border-nonrepro/25 hover:border-nonrepro hover:text-nonrepro hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                    </svg>
                    {primaryBackgroundLabel}
                  </button>
                  {isCanvasEmpty && !hasDetailsForCreate && (
                    <p className="text-[11px] leading-snug text-graphite-muted">
                      Fill in the details first.
                    </p>
                  )}

                  <form onSubmit={handleKeywordSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchKeywords}
                      onChange={(event) => setSearchKeywords(event.target.value)}
                      placeholder="Search backgrounds..."
                      className="flex-1 min-w-0 bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg px-3 py-3 md:py-2 text-base md:text-xs text-graphite placeholder-graphite-muted/50 focus:outline-none transition-all min-h-[44px] md:min-h-0"
                    />
                    <button
                      type="submit"
                      disabled={isFetchingOrLoading || !searchKeywords.trim()}
                      className={`inline-flex items-center justify-center px-4 py-3 md:px-3 md:py-2 text-base md:text-xs font-semibold rounded-lg border transition-all duration-200 font-display flex-shrink-0 min-h-[44px] md:min-h-0 ${
                        isFetchingOrLoading || !searchKeywords.trim()
                          ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed border-graphite/10'
                          : 'bg-nonrepro/10 text-nonrepro border-nonrepro/25 hover:bg-nonrepro/20 hover:border-nonrepro/40 cursor-pointer'
                      }`}
                      aria-label="Search backgrounds"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </form>

                  {showNoImagesMessage && (
                    <p className="rounded-lg border border-pencil/15 bg-pencil/5 px-3 py-2 text-[11px] leading-snug text-graphite-muted">
                      No images found &mdash; try a different keyword or upload your own.
                    </p>
                  )}

                  <div className="space-y-3 rounded-lg border border-graphite/10 bg-white/55 p-3">
                    <label className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-graphite">Background Blur</span>
                        <span className="text-[10px] font-mono text-graphite-muted">{backgroundBlur}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={backgroundBlur}
                        onChange={(event) => setBackgroundBlur(Number(event.target.value))}
                        className="w-full accent-nonrepro py-3 md:py-1.5"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-graphite">Background Opacity</span>
                        <span className="text-[10px] font-mono text-graphite-muted">{backgroundOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={backgroundOpacity}
                        onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
                        title="0 = hidden; 50 = normal; 100 = black"
                        className="w-full accent-nonrepro py-3 md:py-1.5"
                      />
                    </label>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="bg-upload-input"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-sm md:text-xs font-semibold rounded-lg border border-dashed border-nonrepro/35 text-graphite-muted hover:border-nonrepro hover:text-nonrepro hover:bg-nonrepro/5 transition-all duration-200 cursor-pointer font-display min-h-[44px] md:min-h-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Background
                  </button>

                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                    id="image-upload-input"
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-sm md:text-xs font-semibold rounded-lg border border-dashed border-pencil/35 text-graphite-muted hover:border-pencil hover:text-pencil hover:bg-pencil/5 transition-all duration-200 cursor-pointer font-display min-h-[44px] md:min-h-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Logo / Image
                  </button>
                </section>

                <div className="mt-auto pt-2">
                  <button
                    id="start-over-btn"
                    type="button"
                    onClick={handleReset}
                    className="w-full inline-flex items-center justify-center px-4 py-3 md:py-2.5 border border-graphite/15 hover:border-pencil/30 hover:text-pencil text-sm md:text-xs font-semibold rounded-lg text-graphite-muted bg-transparent hover:bg-pencil/5 transition-all duration-200 cursor-pointer min-h-[44px] md:min-h-0"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Campaign Type</h2>
                <div className="flex flex-wrap gap-2">
                  {FLYER_TYPES.map((flyerType) => {
                    const isActive = type === flyerType.key;
                    return (
                      <button
                        key={flyerType.key}
                        type="button"
                        onClick={() => handleTypeChange(flyerType.key)}
                        className={`flex-1 min-w-[5.75rem] px-3 py-3 md:py-2 rounded-lg text-base md:text-sm font-semibold border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nonrepro focus:ring-offset-2 focus:ring-offset-bone-light min-h-[44px] md:min-h-0 ${
                          isActive
                            ? 'bg-nonrepro/10 border-nonrepro text-nonrepro shadow-sm'
                            : 'bg-white border-nonrepro/25 text-graphite-muted hover:text-graphite hover:border-nonrepro/50'
                        }`}
                      >
                        {flyerType.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Canvas Size</h2>
                <div className="flex gap-1.5">
                  {FLYER_SIZE_INFO.map((s) => {
                    const isActive = size === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => handleSizeChange(s.key)}
                        title={s.blurb}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 px-1.5 py-3 md:py-2.5 rounded-lg text-center transition-all duration-200 border min-h-[56px] md:min-h-[48px] ${
                          isActive
                            ? 'bg-nonrepro/10 border-nonrepro text-nonrepro ring-1 ring-nonrepro/25 shadow-sm'
                            : 'bg-white border-nonrepro/20 text-graphite-muted hover:border-nonrepro/45 hover:text-graphite'
                        }`}
                      >
                        <span className="text-[11px] font-bold font-display leading-tight">{s.label}</span>
                        <span className="text-[9px] font-mono opacity-70">{s.aspect}</span>
                        {s.platforms && (
                          <div className="flex gap-1 items-center justify-center mt-0.5 opacity-80">
                            {s.platforms.map((plat) => (
                              <PlatformIcon key={plat} name={plat} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {currentSizeInfo && (
                  <p className="text-[10px] text-graphite-muted leading-snug">
                    {currentSizeInfo.blurb}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Details</h2>
                <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
                  {fieldDefinitions.map((field) => {
                    const value = fields[field.key] || '';
                    const targetKey = (type === 'event' && field.key === 'endTime') ? 'startTime' : field.key;
                    const hasTextNode = textNodes.some((n) => n.id === targetKey);

                    return (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor={`field-${field.key}`} className="text-xs font-semibold text-graphite">
                            {field.label}
                          </label>
                          {hasTextNode && (
                            <button
                              type="button"
                              onClick={() => selectNodes([targetKey])}
                              className="text-[11px] font-semibold text-pencil hover:text-pencil/80 flex items-center gap-1 cursor-pointer min-h-[30px] focus:outline-none"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Style
                            </button>
                          )}
                        </div>
                        {field.inputType === 'textarea' || (field.inputType === undefined && field.multiline) ? (
                          <textarea
                            id={`field-${field.key}`}
                            name={field.key}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(event) => handleFieldChange(field.key, event.target.value)}
                            rows={3}
                            className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none resize-y min-h-[44px]"
                          />
                        ) : field.inputType === 'date' ? (
                          <input
                            type="date"
                            id={`field-${field.key}`}
                            name={field.key}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(event) => handleFieldChange(field.key, event.target.value)}
                            className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none min-h-[44px] md:min-h-0"
                          />
                        ) : field.inputType === 'time' ? (
                          <input
                            type="time"
                            id={`field-${field.key}`}
                            name={field.key}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(event) => handleFieldChange(field.key, event.target.value)}
                            className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none min-h-[44px] md:min-h-0"
                          />
                        ) : (
                          <input
                            type="text"
                            id={`field-${field.key}`}
                            name={field.key}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(event) => handleFieldChange(field.key, event.target.value)}
                            className="w-full bg-white border border-graphite/15 rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none min-h-[44px] md:min-h-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </form>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">Background</h2>
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={primaryBackgroundDisabled}
                  title={primaryBackgroundTitle}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-base md:text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 border font-display min-h-[44px] md:min-h-0 ${
                    primaryBackgroundDisabled
                      ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed pointer-events-none border-graphite/10 shadow-none'
                      : isCanvasEmpty
                        ? 'bg-pencil text-bone border-transparent hover:bg-pencil/90 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-pencil/15'
                      : 'bg-white text-graphite border-nonrepro/25 hover:border-nonrepro hover:text-nonrepro hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                  </svg>
                  {primaryBackgroundLabel}
                </button>
                {isCanvasEmpty && !hasDetailsForCreate && (
                  <p className="text-[11px] leading-snug text-graphite-muted">
                    Fill in the details first.
                  </p>
                )}

                <form onSubmit={handleKeywordSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchKeywords}
                    onChange={(event) => setSearchKeywords(event.target.value)}
                    placeholder="Search backgrounds..."
                    className="flex-1 min-w-0 bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg px-3 py-3 md:py-2 text-base md:text-xs text-graphite placeholder-graphite-muted/50 focus:outline-none transition-all min-h-[44px] md:min-h-0"
                  />
                  <button
                    type="submit"
                    disabled={isFetchingOrLoading || !searchKeywords.trim()}
                    className={`inline-flex items-center justify-center px-4 py-3 md:px-3 md:py-2 text-base md:text-xs font-semibold rounded-lg border transition-all duration-200 font-display flex-shrink-0 min-h-[44px] md:min-h-0 ${
                      isFetchingOrLoading || !searchKeywords.trim()
                        ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed border-graphite/10'
                        : 'bg-nonrepro/10 text-nonrepro border-nonrepro/25 hover:bg-nonrepro/20 hover:border-nonrepro/40 cursor-pointer'
                    }`}
                    aria-label="Search backgrounds"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </form>

                {showNoImagesMessage && (
                  <p className="rounded-lg border border-pencil/15 bg-pencil/5 px-3 py-2 text-[11px] leading-snug text-graphite-muted">
                    No images found &mdash; try a different keyword or upload your own.
                  </p>
                )}

                <div className="space-y-3 rounded-lg border border-graphite/10 bg-white/55 p-3">
                  <label className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-graphite">Background Blur</span>
                      <span className="text-[10px] font-mono text-graphite-muted">{backgroundBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={backgroundBlur}
                      onChange={(event) => setBackgroundBlur(Number(event.target.value))}
                      className="w-full accent-nonrepro py-3 md:py-1.5"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-graphite">Background Opacity</span>
                      <span className="text-[10px] font-mono text-graphite-muted">{backgroundOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={backgroundOpacity}
                      onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
                      title="0 = hidden; 50 = normal; 100 = black"
                      className="w-full accent-nonrepro py-3 md:py-1.5"
                    />
                  </label>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="bg-upload-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-sm md:text-xs font-semibold rounded-lg border border-dashed border-nonrepro/35 text-graphite-muted hover:border-nonrepro hover:text-nonrepro hover:bg-nonrepro/5 transition-all duration-200 cursor-pointer font-display min-h-[44px] md:min-h-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Background
                </button>

                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                  id="image-upload-input"
                />
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-sm md:text-xs font-semibold rounded-lg border border-dashed border-pencil/35 text-graphite-muted hover:border-pencil hover:text-pencil hover:bg-pencil/5 transition-all duration-200 cursor-pointer font-display min-h-[44px] md:min-h-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Logo / Image
                </button>
              </section>

              <div className="mt-auto pt-2">
                <button
                  id="start-over-btn"
                  type="button"
                  onClick={handleReset}
                  className="w-full inline-flex items-center justify-center px-4 py-3 md:py-2.5 border border-graphite/15 hover:border-pencil/30 hover:text-pencil text-sm md:text-xs font-semibold rounded-lg text-graphite-muted bg-transparent hover:bg-pencil/5 transition-all duration-200 cursor-pointer min-h-[44px] md:min-h-0"
                >
                  Start Over
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* 
        On mobile, the live flyer canvas is hidden by default and positioned absolutely behind 
        the controls. This lets the editor open directly into the editing controls, avoiding 
        the shrunk canvas. The Konva stage still renders and executes in the background so 
        the user can preview it via PreviewOverlay and export the flyer seamlessly.
      */}
      <main
        className={`flex-1 bg-bone flex-col lg:flex-row items-center justify-center gap-4 relative overflow-hidden pasteup-grid min-h-0 p-4 md:p-6 md:pt-20 pt-4 order-1 md:order-2 ${
          isMobileLayout
            ? 'absolute opacity-0 pointer-events-none -z-50 w-full h-full'
            : 'flex'
        }`}
        style={isMobileLayout && isKeyboardOpen ? { height: '180px', flex: '0 0 180px' } : undefined}
      >
        <div className="flex-1 flex items-center justify-center w-full h-full min-h-0 min-w-0" ref={containerRef}>
          <div
            className="relative border border-nonrepro/25 rounded-lg overflow-hidden shadow-lg bg-bone-light flex items-center justify-center transition-all duration-300 touch-none"
            style={{ width: stageSize.width, height: stageSize.height, touchAction: 'none' }}
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'))) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(event) => {
              const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
              if (!file) return;

              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              addImageFileAsNode(file, {
                x: (event.clientX - bounds.left) / scale,
                y: (event.clientY - bounds.top) / scale,
              });
            }}
          >
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              scaleX={scale}
              scaleY={scale}
              style={{ touchAction: 'none' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onClick={(event) => {
                const clickedOn = event.target;
                const stage = event.target.getStage();
                if (
                  clickedOn === stage ||
                  (clickedOn.getClassName && (
                    clickedOn.getClassName() === 'Image' ||
                    (clickedOn.getClassName() === 'Rect' && clickedOn.name() !== 'highlight-bg') ||
                    clickedOn.getClassName() === 'Line'
                  ))
                ) {
                  selectNodes([]);
                }
              }}
              onTap={(event) => {
                const clickedOn = event.target;
                const stage = event.target.getStage();
                if (
                  clickedOn === stage ||
                  (clickedOn.getClassName && (
                    clickedOn.getClassName() === 'Image' ||
                    (clickedOn.getClassName() === 'Rect' && clickedOn.name() !== 'highlight-bg') ||
                    clickedOn.getClassName() === 'Line'
                  ))
                ) {
                  selectNodes([]);
                }
              }}
            >
              <Layer>
                <Rect x={0} y={0} width={trueWidth} height={trueHeight} fill="#f5efe4" />
                {showNoImagesMessage && (
                  <>
                    <Rect x={0} y={0} width={trueWidth} height={trueHeight} fill="#2D2D2A" />
                    <KonvaText
                      text="No background found"
                      x={0}
                      y={(trueHeight - 40) / 2}
                      width={trueWidth}
                      height={40}
                      align="center"
                      verticalAlign="middle"
                      fontFamily="Inter, Arial, sans-serif"
                      fontSize={28}
                      fill="rgba(245, 239, 228, 0.72)"
                      listening={false}
                    />
                  </>
                )}
                {!imgElement && !showNoImagesMessage && gridLines.map((line) => (
                  <Line
                    key={line.id}
                    points={line.points}
                    stroke="#4ea3c9"
                    strokeWidth={1}
                    opacity={0.16}
                    listening={false}
                  />
                ))}
                {imgElement && (
                  <KonvaImage
                    ref={backgroundImageRef}
                    x={0}
                    y={0}
                    width={trueWidth}
                    height={trueHeight}
                    image={imgElement}
                    crop={cropData}
                    filters={backgroundBlur > 0 ? [Konva.Filters.Blur] : []}
                    blurRadius={backgroundBlur}
                    opacity={backgroundImageOpacity}
                  />
                )}
                {imgElement && backgroundDarkOverlayOpacity > 0 && (
                  <Rect
                    x={0}
                    y={0}
                    width={trueWidth}
                    height={trueHeight}
                    fill="#000000"
                    opacity={backgroundDarkOverlayOpacity}
                    listening={false}
                  />
                )}
              </Layer>
              <Layer>
                {imageNodes.map((node) => (
                  <ImageNodeView
                    key={node.id}
                    node={node}
                    selected={selectedImageNode?.id === node.id}
                    onSelect={handleImageSelect}
                    onUpdate={updateImageNode}
                    onRemove={handleRemoveImageNode}
                    onReady={handleImageReady}
                  />
                ))}
                {!isExporting && selectedImageNode && (
                  <Transformer
                    ref={imageTransformerRef}
                    rotateEnabled={false}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    anchorSize={transformerProps.anchorSize}
                    anchorStroke="#7FA8D8"
                    anchorStrokeWidth={transformerProps.anchorStrokeWidth}
                    anchorFill="#ffffff"
                    anchorCornerRadius={Math.round(transformerProps.anchorSize / 2)}
                    borderStroke="#7FA8D8"
                    borderStrokeWidth={transformerProps.borderStrokeWidth}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                )}
              </Layer>
              {!isExporting && activeGuides.length > 0 && (
                <Layer listening={false}>
                  {activeGuides.map((guide) => (
                    <Line
                      key={`${guide.orientation}-${guide.position}`}
                      points={
                        guide.orientation === 'V'
                          ? [guide.position, 0, guide.position, trueHeight]
                          : [0, guide.position, trueWidth, guide.position]
                      }
                      stroke={SNAP_GUIDE_COLOR}
                      strokeWidth={2 / scale}
                      dash={[6 / scale, 4 / scale]}
                      listening={false}
                    />
                  ))}
                </Layer>
              )}
              <Layer>
                {textNodes.map((node) => {
                  const leg = resolveNode(node);
                  const textHeight = estimateTextHeight(node);
                  const highlightPad = 8;

                  return (
                    <Group
                      key={node.id}
                      id={node.id}
                      x={node.x}
                      y={node.y}
                      draggable
                      onClick={(event) => {
                        if (justLongPressedRef.current) {
                          event.cancelBubble = true;
                          return;
                        }
                        handleTextSelect(event, node.id);
                      }}
                      onTap={(event) => {
                        if (justLongPressedRef.current) {
                          event.cancelBubble = true;
                          return;
                        }
                        handleTextSelect(event, node.id);
                      }}
                      onTouchStart={(event: Konva.KonvaEventObject<TouchEvent>) => handleTouchStartText(event, node)}
                      onTouchMove={(event: Konva.KonvaEventObject<TouchEvent>) => handleTouchMoveText(event, node)}
                      onTouchEnd={(event: Konva.KonvaEventObject<TouchEvent>) => handleTouchEndText(event, node)}
                      onTouchCancel={(event: Konva.KonvaEventObject<TouchEvent>) => handleTouchEndText(event, node)}
                      onDragStart={() => handleTextDragStart(node)}
                      onDragMove={(event) => handleTextDragMove(event, node)}
                      onDragEnd={(event) => {
                        setActiveGuides([]);
                        const draggedNode = event.target as Konva.Group;
                        const dragStart = dragStartRef.current;
                        
                        if (dragStart && dragStart.draggedId === node.id) {
                          const dx = draggedNode.x() - dragStart.draggedX;
                          const dy = draggedNode.y() - dragStart.draggedY;

                          Object.entries(dragStart.nodePositions).forEach(([id, position]) => {
                            updateNode(id, {
                              x: position.x + dx,
                              y: position.y + dy,
                            });
                          });
                        } else {
                          updateNode(node.id, {
                            x: draggedNode.x(),
                            y: draggedNode.y(),
                          });
                        }
                        
                        dragStartRef.current = null;
                      }}
                      onTransform={(event) => handleTextTransform(event, node)}
                      onTransformEnd={(event) => {
                        const kNode = event.target as Konva.Group;
                        const activeAnchor = lastTextTransformAnchorRef.current ?? transformerRef.current?.getActiveAnchor() ?? null;

                        if (activeAnchor && TEXT_SIDE_ANCHORS.has(activeAnchor)) {
                          handleTextTransform(event, node);
                          setActiveGuides([]);
                          lastTextTransformAnchorRef.current = null;

                          const textChild = kNode.findOne('Text') as Konva.Text | undefined;
                          const finalWidth = textChild ? textChild.width() : node.width;

                          updateNode(node.id, {
                            x: kNode.x(),
                            y: kNode.y(),
                            width: finalWidth,
                            autoWidth: false,
                          });
                          return;
                        }

                        const scaleX = kNode.scaleX();

                        kNode.scaleX(1);
                        kNode.scaleY(1);

                        const textChild = kNode.findOne('Text') as Konva.Text | undefined;
                        const currentFontSize = textChild ? textChild.fontSize() : node.fontSize;
                        const newFontSize = Math.max(8, Math.round(currentFontSize * scaleX));

                        const isAutoWidth = node.autoWidth !== false;
                        const finalWidth = isAutoWidth ? node.width : Math.max(TEXT_MIN_WIDTH, node.width * scaleX);

                        updateNode(node.id, {
                          x: kNode.x(),
                          y: kNode.y(),
                          fontSize: newFontSize,
                          ...(!isAutoWidth ? { width: finalWidth } : {}),
                        });
                        setActiveGuides([]);
                        lastTextTransformAnchorRef.current = null;
                      }}
                      onMouseEnter={(event) => {
                        const stage = event.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(event) => {
                        const stage = event.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                    >
                      <Rect
                        name="touch-hit-area"
                        x={-10}
                        y={-10}
                        width={node.width + 20}
                        height={textHeight + 20}
                        fill="rgba(0,0,0,0)"
                        listening={true}
                      />
                      {leg.highlightEnabled && (
                        <Rect
                          name="highlight-bg"
                          x={-highlightPad}
                          y={-highlightPad}
                          width={node.width + highlightPad * 2}
                          height={textHeight + highlightPad * 2}
                          fill={leg.highlightColor}
                          opacity={leg.highlightOpacity}
                          cornerRadius={4}
                        />
                      )}
                      <KonvaText
                        text={node.text}
                        fontFamily={node.fontFamily}
                        fontSize={node.fontSize}
                        fill={node.fill}
                        width={node.width}
                        align={node.align ?? 'left'}
                        shadowColor={leg.shadowEnabled ? leg.shadowColor : undefined}
                        shadowBlur={leg.shadowEnabled ? leg.shadowBlur : 0}
                        shadowOpacity={leg.shadowEnabled ? leg.shadowOpacity : 0}
                        shadowOffsetX={leg.shadowEnabled ? 1 : 0}
                        shadowOffsetY={leg.shadowEnabled ? 1 : 0}
                        shadowEnabled={leg.shadowEnabled}
                      />
                    </Group>
                  );
                })}
                {!isExporting && selectedNodeIds.length > 1 && selectedNodeIds.map((id) => {
                  const node = textNodes.find((textNode) => textNode.id === id);

                  if (!node) {
                    return null;
                  }

                  const textHeight = estimateTextHeight(node);
                  const nodePadding = Math.max(4, 6 / scale);

                  return (
                    <Rect
                      key={`selection-indicator-${id}`}
                      x={node.x - nodePadding}
                      y={node.y - nodePadding}
                      width={node.width + nodePadding * 2}
                      height={textHeight + nodePadding * 2}
                      stroke={GUIDE_COLOR}
                      strokeWidth={Math.max(1, 1.5 / scale)}
                      dash={[4 / scale, 3 / scale]}
                      opacity={0.9}
                      listening={false}
                    />
                  );
                })}
                {selectedNodeIds.length > 0 && (
                  <Transformer
                    ref={transformerRef}
                    rotateEnabled={false}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
                    anchorSize={transformerProps.anchorSize}
                    anchorStroke="#7FA8D8"
                    anchorStrokeWidth={transformerProps.anchorStrokeWidth}
                    anchorFill="#ffffff"
                    anchorCornerRadius={Math.round(transformerProps.anchorSize / 2)}
                    borderStroke="#7FA8D8"
                    borderStrokeWidth={transformerProps.borderStrokeWidth}
                    boundBoxFunc={(oldBox, newBox) => {
                      const minWidth = Math.max(
                        TEXT_MIN_WIDTH,
                        ...selectedNodeIds
                          .map((id) => textNodes.find((node) => node.id === id))
                          .filter((node): node is TextNode => Boolean(node))
                          .map(getTextMinWidth)
                      );

                      if (newBox.width < minWidth) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                )}
              </Layer>
            </Stage>

            {(isFetchingOrLoading || !fontsLoaded) && (
              <div className="absolute inset-0 bg-bone/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm z-20">
                <svg className="animate-spin h-8 w-8 text-pencil" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-graphite text-sm font-semibold tracking-wide font-display">
                  {searchLoading ? 'Fetching background...' : !fontsLoaded ? 'Loading typography...' : 'Loading background...'}
                </span>
              </div>
            )}

            {isMobileLayout && !isExpanded && selectedTextNode && inlineWidgetPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${inlineWidgetPos.left}px`,
                  top: `${inlineWidgetPos.top}px`,
                  zIndex: 45,
                }}
                className="flex items-center gap-2.5 p-1.5 bg-bone-light/95 backdrop-blur-md border border-graphite/15 shadow-xl rounded-xl pointer-events-auto select-none min-h-[44px]"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* Font Family Dropdown */}
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <select
                      value={selectedTextNode.fontFamily}
                      onChange={(e) => updateSelectedTextNodes({ fontFamily: e.target.value })}
                      style={{ fontFamily: selectedTextNode.fontFamily }}
                      className="bg-white border border-graphite/15 focus:border-nonrepro rounded-lg py-1 pl-2 pr-7 text-xs font-semibold text-graphite focus:outline-none transition-all cursor-pointer appearance-none min-h-[32px] max-w-[90px] truncate"
                    >
                      {FONTS.map((font) => (
                        <option
                          key={font.family}
                          value={font.family}
                          style={{ fontFamily: font.family }}
                          className="bg-white text-graphite py-1 text-xs"
                        >
                          {font.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none text-graphite-muted">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleShuffleFont}
                    disabled={isShufflingFont}
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-graphite/15 bg-white text-graphite hover:text-pencil hover:border-pencil/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-nonrepro disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                    title="Shuffle font"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <path d="M12 12h.01" strokeWidth="4" />
                      <path d="M8 8h.01" strokeWidth="4" />
                      <path d="M8 16h.01" strokeWidth="4" />
                      <path d="M16 8h.01" strokeWidth="4" />
                      <path d="M16 16h.01" strokeWidth="4" />
                    </svg>
                  </button>
                </div>

                {/* Color Swatch */}
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-graphite/15 flex-shrink-0 bg-white shadow-sm flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                  <div
                    className="w-5 h-5 rounded-full border border-graphite/10"
                    style={{ backgroundColor: selectedTextNode.fill }}
                  />
                  <input
                    type="color"
                    value={selectedTextNode.fill}
                    onChange={(e) => updateSelectedTextNodes({ fill: e.target.value })}
                    className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                  />
                </div>

                <div className="w-[1px] h-6 bg-graphite/10" />

                {/* Opacity Slider */}
                <div className="flex items-center gap-1.5 px-0.5">
                  <svg className="w-4 h-4 text-graphite-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <title>Highlight Box Opacity</title>
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path d="M12 3a9 9 0 000 18V3z" fill="currentColor" opacity={0.5} />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedTextNode.highlightOpacity ?? 0.5}
                    onChange={(e) => updateSelectedTextNodes({ highlightOpacity: parseFloat(e.target.value), highlightEnabled: true })}
                    className="w-16 h-1 cursor-pointer accent-pencil"
                  />
                </div>

                <div className="w-[1px] h-6 bg-graphite/10" />

                {/* More Button */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-nonrepro/10 hover:bg-nonrepro/25 text-nonrepro text-xs font-bold font-display hover:scale-105 active:scale-95 transition-all flex items-center justify-center min-h-[32px] cursor-pointer"
                >
                  More
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedTextNode && (
          <div className="hidden md:flex flex-shrink-0 z-10 w-full lg:w-auto justify-center lg:overflow-y-auto lg:max-h-full">
            <TextControls onFontChange={() => stageRef.current?.batchDraw()} />
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 bg-pencil/95 border border-pencil/40 text-bone px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-bone font-display">Background Error</span>
            <span className="text-[11px] text-bone/80">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-bone/60 hover:text-bone font-bold text-xs cursor-pointer focus:outline-none"
          >
            x
          </button>
        </div>
      )}

      <PreviewOverlay previewUrl={previewUrl} onClose={handleClosePreview} />

      <ExportDialog
        key={`${size}-${showExportModal}`}
        isOpen={showExportModal}
        onClose={handleCloseExportModal}
        size={size}
        trueWidth={trueWidth}
        trueHeight={trueHeight}
        isGeneratingExportPreview={isGeneratingExportPreview}
        exportPreviewUrl={exportPreviewUrl}
        isExporting={isExporting}
        exportFlyer={exportFlyer}
      />
    </div>
  );
};
