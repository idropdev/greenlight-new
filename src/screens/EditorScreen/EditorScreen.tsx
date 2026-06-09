import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Transformer, Rect, Group } from 'react-konva';
import Konva from 'konva';
import { useFlyerStore } from '../../features/flyer/flyerStore';
import { getDimensionsForSize, FLYER_SIZE_INFO } from '../../features/flyer/sizes';
import type { SizeKey } from '../../features/flyer/flyerStore';
import { useUnsplashSearch } from '../../features/unsplash/useUnsplashSearch';
import { buildTextNodes } from '../../features/flyer/layoutPresets';
import { ensureFontsLoaded } from '../../lib/fonts';
import { TextControls } from '../../features/editor/TextControls';
import { useExport } from '../../features/editor/useExport';

/**
 * Custom hook to load an image URL into an HTMLImageElement locally.
 * Skips crossOrigin for blob: URLs to avoid taint issues with uploaded files.
 */
function useImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    if (!url) {
      setImage(null);
      setStatus('failed');
      return;
    }

    setStatus('loading');
    const img = new Image();

    // Only set crossOrigin for remote URLs — blob: is same-origin and doesn't need it
    const isBlobUrl = url.startsWith('blob:');
    if (!isBlobUrl) {
      img.crossOrigin = 'anonymous';
    }

    let isMounted = true;
    img.onload = () => {
      if (isMounted) {
        setImage(img);
        setStatus('loaded');
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setImage(null);
        setStatus('failed');
      }
    };
    img.src = url;

    return () => {
      isMounted = false;
    };
  }, [url]);

  return [image, status] as const;
}

/** Safe defaults for nodes that may lack legibility fields (backwards compat). */
function resolveNode(node: any) {
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

export const EditorScreen: React.FC = () => {
  const navigate = useNavigate();
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const fields = useFlyerStore((state) => state.fields);
  const bgImageUrl = useFlyerStore((state) => state.bgImageUrl);
  const textNodes = useFlyerStore((state) => state.textNodes);
  const setTextNodes = useFlyerStore((state) => state.setTextNodes);
  const selectedNodeId = useFlyerStore((state) => state.selectedNodeId);
  const selectNode = useFlyerStore((state) => state.selectNode);
  const updateNode = useFlyerStore((state) => state.updateNode);
  const setSize = useFlyerStore((state) => state.setSize);
  const setBgImageUrl = useFlyerStore((state) => state.setBgImageUrl);
  const reset = useFlyerStore((state) => state.reset);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchKeywords, setSearchKeywords] = useState('');

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedUrlRef = useRef<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load web fonts on mount
  useEffect(() => {
    let active = true;
    ensureFontsLoaded().then(() => {
      if (active) {
        setFontsLoaded(true);
        if (stageRef.current) {
          stageRef.current.batchDraw();
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Cleanup uploaded object URL on unmount
  useEffect(() => {
    return () => {
      if (uploadedUrlRef.current) {
        URL.revokeObjectURL(uploadedUrlRef.current);
      }
    };
  }, []);

  // Synchronize transformer nodes with selection
  useEffect(() => {
    if (selectedNodeId) {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      if (stage && transformer) {
        const selectedNode = stage.findOne('#' + selectedNodeId);
        if (selectedNode) {
          transformer.nodes([selectedNode]);
          transformer.getLayer()?.batchDraw();
          return;
        }
      }
    }
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedNodeId, textNodes]);

  // 1. Route guard: Redirect if type is null
  useEffect(() => {
    if (!type) {
      navigate('/', { replace: true });
    }
  }, [type, navigate]);

  // Expose store to window for console debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__store = useFlyerStore;
    }
  }, []);



  // Get physical sizes
  const dimensions = getDimensionsForSize(size);
  const { width: trueWidth, height: trueHeight } = dimensions;

  // 2. Fetch and manage Unsplash background search
  const { search, shuffle, isLoading: searchLoading, error: searchError, photos, currentIndex } = useUnsplashSearch();

  // Show error toast on fetch fail
  useEffect(() => {
    if (searchError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToastMessage(searchError);
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchError]);

  const searchInitiated = useRef(false);

  useEffect(() => {
    if (searchInitiated.current) return;
    searchInitiated.current = true;

    // Derive initial search query: title/businessName/productName -> fallback to flyer type
    const query = fields.title || fields.businessName || fields.productName || type || 'flyer';
    search(query);
  }, [type, fields, search]);

  // 2b. Initialize TextNodes from fields once if currently empty
  useEffect(() => {
    if (type && textNodes.length === 0) {
      const generatedNodes = buildTextNodes(type, size, fields);
      if (generatedNodes.length > 0) {
        setTextNodes(generatedNodes);
      }
    }
  }, [type, size, fields, textNodes.length, setTextNodes]);

  // Load the current image
  const [imgElement, imgStatus] = useImage(bgImageUrl);
  const isImageLoading = !!(bgImageUrl && imgStatus === 'loading');
  const isFetchingOrLoading = searchLoading || isImageLoading;

  // 3. Scale canvas to fit viewport container dynamically
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 400, height: 400 });

  // Custom export hook
  const { exportFlyer, isExporting } = useExport(stageRef, transformerRef);

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const padding = 32;
    const containerW = Math.max(containerRef.current.clientWidth - padding, 200);
    const containerH = Math.max(containerRef.current.clientHeight - padding, 200);

    const newScale = Math.min(containerW / trueWidth, containerH / trueHeight);
    setScale(newScale);
    setStageSize({
      width: trueWidth * newScale,
      height: trueHeight * newScale,
    });
  }, [trueWidth, trueHeight]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
    };
  }, [updateScale]);

  // ── Feature 1: Size change handler with text node clamping ──
  const handleSizeChange = useCallback((newSize: SizeKey) => {
    if (newSize === size) return;
    setSize(newSize);

    const CLAMP_MARGIN = 20;
    const newDims = getDimensionsForSize(newSize);
    textNodes.forEach((node) => {
      const clampedX = Math.max(0, Math.min(node.x, newDims.width - CLAMP_MARGIN));
      const clampedY = Math.max(0, Math.min(node.y, newDims.height - CLAMP_MARGIN));
      if (clampedX !== node.x || clampedY !== node.y) {
        updateNode(node.id, { x: clampedX, y: clampedY });
      }
    });
  }, [size, setSize, textNodes, updateNode]);

  // ── Feature 2b: File upload handler ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous uploaded object URL
    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedUrlRef.current = objectUrl;
    setBgImageUrl(objectUrl);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setBgImageUrl]);

  // ── Feature 2a: Keyword search handler ──
  const handleKeywordSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchKeywords.trim();
    if (!trimmed) return;
    search(trimmed);
  }, [searchKeywords, search]);

  if (!type) {
    return null;
  }

  // 4. Calculate cover crop coordinates for Konva Image
  let cropData = undefined;
  if (imgElement) {
    const imgWidth = imgElement.width;
    const imgHeight = imgElement.height;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = trueWidth / trueHeight;

    let cropX = 0;
    let cropY = 0;
    let cropWidth = imgWidth;
    let cropHeight = imgHeight;

    if (imgRatio > canvasRatio) {
      cropWidth = imgHeight * canvasRatio;
      cropX = (imgWidth - cropWidth) / 2;
    } else {
      cropHeight = imgWidth / canvasRatio;
      cropY = (imgHeight - cropHeight) / 2;
    }

    cropData = {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    };
  }

  const queryUsed = fields.title || fields.businessName || fields.productName || type;
  const currentSizeInfo = FLYER_SIZE_INFO.find((s) => s.key === size);

  return (
    <div className="h-dvh bg-bone text-graphite flex flex-col md:flex-row relative overflow-hidden">
      {/* Registration marks */}
      <span className="reg-mark absolute top-3 right-3 select-none pointer-events-none z-30" />
      <span className="reg-mark absolute bottom-3 right-3 select-none pointer-events-none z-30" />

      {/* Control Sidebar — scrolls internally on desktop */}
      <div className="w-full md:w-80 bg-bone-light border-b md:border-b-0 md:border-r border-graphite/10 p-6 flex flex-col gap-5 z-10 flex-shrink-0 md:overflow-y-auto md:h-dvh editor-sidebar">
        <div className="space-y-2">
          <h1 id="editor-title" className="text-2xl font-bold tracking-tight text-graphite font-display">
            Design Editor
          </h1>
          <p className="text-graphite-muted text-xs">
            Review size ratios, background layout, and cycle through assets.
          </p>
        </div>

        <hr className="border-graphite/10" />

        {/* ── Feature 1: Size Switcher ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display flex items-center">
            <span className="reg-mark-sm" />
            Canvas Size
          </h2>
          <div className="flex gap-1.5">
            {FLYER_SIZE_INFO.map((s) => {
              const isActive = size === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleSizeChange(s.key)}
                  title={s.blurb}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg text-center transition-all duration-200 cursor-pointer border ${
                    isActive
                      ? 'bg-nonrepro/10 border-nonrepro/40 text-nonrepro ring-1 ring-nonrepro/25 shadow-sm'
                      : 'bg-white border-graphite/10 text-graphite-muted hover:border-graphite/20 hover:text-graphite'
                  }`}
                >
                  <span className={`text-[11px] font-bold font-display leading-tight ${isActive ? 'text-nonrepro' : ''}`}>
                    {s.label}
                  </span>
                  <span className="text-[9px] font-mono opacity-70">{s.aspect}</span>
                </button>
              );
            })}
          </div>
          {currentSizeInfo && (
            <p className="text-[10px] text-graphite-muted leading-snug pl-0.5">
              <span className="font-mono text-graphite/60">{currentSizeInfo.dimensions}</span>
              <span className="mx-1.5">—</span>
              {currentSizeInfo.blurb}
            </p>
          )}
        </div>

        <hr className="border-graphite/10" />

        {/* Campaign Info */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display flex items-center">
            <span className="reg-mark-sm" />
            Flyer Parameters
          </h2>
          <div className="space-y-2.5 bg-white p-3.5 rounded-lg border border-graphite/10 text-sm shadow-sm">
            <div className="flex justify-between">
              <span className="text-graphite-muted">Format:</span>
              <span className="font-semibold text-nonrepro capitalize">{currentSizeInfo?.label ?? size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-graphite-muted">Type:</span>
              <span className="font-semibold text-nonrepro capitalize">{type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-graphite-muted">Resolution:</span>
              <span className="font-mono text-xs text-graphite">{trueWidth} × {trueHeight} px</span>
            </div>
          </div>
        </div>

        {/* Selected Text Node Details */}
        {selectedNodeId && (() => {
          const selectedNode = textNodes.find((n) => n.id === selectedNodeId);
          if (!selectedNode) return null;
          return (
            <div className="space-y-3 animate-in fade-in duration-200">
              <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display flex items-center">
                <span className="reg-mark-sm" />
                Selected Text Node
              </h2>
              <div className="space-y-2.5 bg-white p-3.5 rounded-lg border border-graphite/10 text-sm shadow-sm">
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Field:</span>
                  <span className="font-semibold text-pencil">{selectedNode.field}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Position (X, Y):</span>
                  <span className="font-mono text-xs text-graphite">{Math.round(selectedNode.x)}, {Math.round(selectedNode.y)} px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Width:</span>
                  <span className="font-mono text-xs text-graphite">{Math.round(selectedNode.width)} px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Font Size:</span>
                  <span className="font-mono text-xs text-graphite">{selectedNode.fontSize} px</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Background Asset Section ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display flex items-center">
            <span className="reg-mark-sm" />
            Background Asset
          </h2>
          <div className="space-y-2.5 bg-white p-3.5 rounded-lg border border-graphite/10 text-sm shadow-sm">
            <div className="flex justify-between">
              <span className="text-graphite-muted">Search Query:</span>
              <span className="font-semibold text-ochre truncate max-w-[140px]" title={queryUsed}>"{queryUsed}"</span>
            </div>
            <div className="flex justify-between">
              <span className="text-graphite-muted">Available:</span>
              <span className="font-medium text-graphite">{photos.length} photos</span>
            </div>
            {photos.length > 0 && (
              <div className="flex justify-between">
                <span className="text-graphite-muted">Index:</span>
                <span className="font-mono text-xs text-graphite">{currentIndex + 1} of {photos.length}</span>
              </div>
            )}
          </div>

          {/* Shuffle Button */}
          <button
            onClick={() => {
              if (photos.length > 1) {
                shuffle();
              } else {
                const query = fields.title || fields.businessName || fields.productName || type;
                search(query);
              }
            }}
            disabled={isFetchingOrLoading}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 border font-display ${
              isFetchingOrLoading
                ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed border-graphite/10 shadow-none'
                : 'bg-white text-graphite border-graphite/15 hover:border-nonrepro hover:text-nonrepro hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
            </svg>
            Shuffle Background
          </button>

          {/* ── Feature 2a: Keyword Search ── */}
          <form onSubmit={handleKeywordSearch} className="flex gap-2">
            <input
              type="text"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              placeholder="Search backgrounds…"
              className="flex-1 min-w-0 bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg px-3 py-2 text-xs text-graphite placeholder-graphite-muted/50 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={isFetchingOrLoading || !searchKeywords.trim()}
              className={`inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 font-display flex-shrink-0 ${
                isFetchingOrLoading || !searchKeywords.trim()
                  ? 'bg-graphite/10 text-graphite-muted cursor-not-allowed border-graphite/10'
                  : 'bg-nonrepro/10 text-nonrepro border-nonrepro/25 hover:bg-nonrepro/20 hover:border-nonrepro/40 cursor-pointer'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>

          {/* ── Feature 2b: Image Upload ── */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="bg-upload-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-dashed border-graphite/20 text-graphite-muted hover:border-nonrepro hover:text-nonrepro hover:bg-nonrepro/5 transition-all duration-200 cursor-pointer font-display"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Your Own Image
          </button>
        </div>

        {/* Bottom actions — pushed to bottom */}
        <div className="mt-auto space-y-2 pt-2">
          <button
            id="download-btn"
            onClick={exportFlyer}
            disabled={isExporting}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg shadow-md transition-all duration-200 border border-transparent font-display ${
              isExporting
                ? 'bg-graphite/15 text-graphite-muted cursor-not-allowed shadow-none'
                : 'bg-pencil text-bone hover:bg-pencil/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-pencil/15'
            }`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-graphite-muted" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Preparing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Flyer
              </>
            )}
          </button>

          <Link
            id="to-details-btn"
            to="/details"
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-graphite/15 hover:border-graphite/25 text-xs font-semibold rounded-lg text-graphite-muted hover:text-graphite bg-transparent hover:bg-bone transition-all duration-200 cursor-pointer"
          >
            ← Back to Details
          </Link>
          <button
            id="start-over-btn"
            onClick={() => {
              if (window.confirm('Are you sure you want to start over? This will wipe your design and details.')) {
                reset();
                navigate('/', { replace: true });
              }
            }}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-graphite/15 hover:border-pencil/30 hover:text-pencil text-xs font-semibold rounded-lg text-graphite-muted bg-transparent hover:bg-pencil/5 transition-all duration-200 cursor-pointer"
          >
            Start Over
          </button>
        </div>
      </div>

      {/* Canvas Workspace — non-repro grid background */}
      <div className="flex-1 bg-bone flex flex-col lg:flex-row items-center justify-center gap-4 relative overflow-hidden pasteup-grid min-h-0 p-4 md:p-6">
        
        {/* Canvas Area Container */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full h-full min-h-0 min-w-0">
          
          {/* Canvas Scaling Wrapper */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0" ref={containerRef}>
            {/* Dynamic Canvas Container */}
            <div 
              className="relative border border-graphite/15 rounded-lg overflow-hidden shadow-lg bg-bone-light flex items-center justify-center transition-all duration-300"
              style={{ width: stageSize.width, height: stageSize.height }}
            >
              {/* Konva Stage */}
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={scale}
                scaleY={scale}
                onClick={(e) => {
                  const clickedOn = e.target;
                  const stage = e.target.getStage();
                  // Don't deselect when clicking highlight-bg rects (they belong to text groups)
                  if (
                    clickedOn === stage || 
                    (clickedOn.getClassName && (
                      clickedOn.getClassName() === 'Image' || 
                      (clickedOn.getClassName() === 'Rect' && clickedOn.name() !== 'highlight-bg')
                    ))
                  ) {
                    selectNode(null);
                  }
                }}
                onTap={(e) => {
                  const clickedOn = e.target;
                  const stage = e.target.getStage();
                  if (
                    clickedOn === stage || 
                    (clickedOn.getClassName && (
                      clickedOn.getClassName() === 'Image' || 
                      (clickedOn.getClassName() === 'Rect' && clickedOn.name() !== 'highlight-bg')
                    ))
                  ) {
                    selectNode(null);
                  }
                }}
              >
                <Layer>
                  {/* Fallback solid background color */}
                  <Rect
                    x={0}
                    y={0}
                    width={trueWidth}
                    height={trueHeight}
                    fill="#1e293b"
                  />
                  {imgElement && (
                    <KonvaImage
                      x={0}
                      y={0}
                      width={trueWidth}
                      height={trueHeight}
                      image={imgElement}
                      crop={cropData}
                    />
                  )}
                  {textNodes.map((node) => {
                    const leg = resolveNode(node);
                    // Compute approximate text height for highlight rect
                    // Konva Text wraps within node.width, so estimate lines
                    const lineHeight = node.fontSize * 1.2;
                    const estimatedLines = Math.max(1, Math.ceil((node.text.length * node.fontSize * 0.55) / Math.max(node.width, 1)));
                    const textHeight = lineHeight * estimatedLines;
                    const hlPad = 8;
                    return (
                      <Group
                        key={node.id}
                        id={node.id}
                        x={node.x}
                        y={node.y}
                        draggable
                        onClick={(e) => {
                          e.cancelBubble = true;
                          selectNode(node.id);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          selectNode(node.id);
                        }}
                        onDragEnd={(e) => {
                          updateNode(node.id, {
                            x: e.target.x(),
                            y: e.target.y(),
                          });
                        }}
                        onTransformEnd={(e) => {
                          const kNode = e.target as any;
                          const scaleX = kNode.scaleX();

                          kNode.scaleX(1);
                          kNode.scaleY(1);

                          // Find the text child to read current width/fontSize
                          const textChild = kNode.findOne('Text');
                          const currentWidth = textChild ? textChild.width() : node.width;
                          const currentFontSize = textChild ? textChild.fontSize() : node.fontSize;

                          const newWidth = Math.max(40, currentWidth * scaleX);
                          const newFontSize = Math.max(8, Math.round(currentFontSize * scaleX));

                          updateNode(node.id, {
                            x: kNode.x(),
                            y: kNode.y(),
                            width: newWidth,
                            fontSize: newFontSize,
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'move';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                      >
                        {/* Highlight background rect (rendered behind text) */}
                        {leg.highlightEnabled && (
                          <Rect
                            name="highlight-bg"
                            x={-hlPad}
                            y={-hlPad}
                            width={node.width + hlPad * 2}
                            height={textHeight + hlPad * 2}
                            fill={leg.highlightColor}
                            opacity={leg.highlightOpacity}
                            cornerRadius={4}
                            listening={true}
                          />
                        )}
                        <KonvaText
                          text={node.text}
                          fontFamily={node.fontFamily}
                          fontSize={node.fontSize}
                          fill={node.fill}
                          width={node.width}
                          align="center"
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
                  {selectedNodeId && (
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled={false}
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                      boundBoxFunc={(oldBox, newBox) => {
                        // Limit resize width to at least 40px
                        if (newBox.width < 40) {
                          return oldBox;
                        }
                        return newBox;
                      }}
                    />
                  )}
                </Layer>
              </Stage>

              {/* Loading Overlay */}
              {(isFetchingOrLoading || !fontsLoaded) && (
                <div className="absolute inset-0 bg-bone/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm z-20">
                  <svg className="animate-spin h-8 w-8 text-pencil" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-graphite text-sm font-semibold tracking-wide font-display">
                    {searchLoading 
                      ? 'Fetching from Unsplash…' 
                      : !fontsLoaded 
                      ? 'Loading typography assets…' 
                      : 'Loading background image…'}
                  </span>
                </div>
              )}

              {/* Empty Details Hint Overlay */}
              {!isFetchingOrLoading && textNodes.length === 0 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-bone-light/95 border border-ochre/30 text-graphite px-4 py-2 rounded-lg shadow-md flex items-center gap-2 backdrop-blur-md pointer-events-none z-10 animate-pulse">
                  <span className="text-ochre text-base">💡</span>
                  <span className="text-xs font-semibold">Add details to see text on your flyer</span>
                </div>
              )}
            </div>
          </div>

          {/* Friendly search empty / warning message below canvas */}
          {!bgImageUrl && !isFetchingOrLoading && (
            <div className="text-center max-w-sm bg-bone-light border border-graphite/10 px-4 py-2.5 rounded-lg shadow-sm z-10 animate-in fade-in duration-200 flex-shrink-0">
              <p className="text-graphite text-xs font-semibold flex items-center justify-center gap-1.5">
                <span>⚠️</span>
                {photos.length === 0 
                  ? "No background images found — try editing your details or shuffle again"
                  : "No background image loaded"}
              </p>
              {!import.meta.env.VITE_UNSPLASH_ACCESS_KEY && (
                <p className="text-graphite-muted text-[10px] mt-0.5">
                  Add VITE_UNSPLASH_ACCESS_KEY to your local .env file to enable automated background searches.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Text Node Properties Panel */}
        <div className="flex-shrink-0 z-10 w-full lg:w-auto flex justify-center lg:overflow-y-auto lg:max-h-full">
          <TextControls />
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 bg-pencil/95 border border-pencil/40 text-bone px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-md">
          <span className="text-bone/80 text-base">⚠️</span>
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-bone font-display">Unsplash Error</span>
            <span className="text-[11px] text-bone/80">{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-bone/60 hover:text-bone font-bold text-xs cursor-pointer focus:outline-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
