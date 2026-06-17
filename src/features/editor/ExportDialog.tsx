import React, { useState, useMemo } from 'react';
import { FLYER_SIZE_INFO } from '../flyer/sizes';
import type { SizeKey } from '../flyer/flyerStore';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  size: SizeKey;
  trueWidth: number;
  trueHeight: number;
  isGeneratingExportPreview: boolean;
  exportPreviewUrl: string | null;
  isExporting: boolean;
  exportFlyer: (width: number, height: number, format: 'png' | 'jpeg' | 'svg') => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  size,
  trueWidth,
  trueHeight,
  isGeneratingExportPreview,
  exportPreviewUrl,
  isExporting,
  exportFlyer,
}) => {
  const [widthVal, setWidthVal] = useState<string>(String(trueWidth * 2));
  const [heightVal, setHeightVal] = useState<string>(String(trueHeight * 2));
  const [format, setFormat] = useState<'png' | 'jpeg' | 'svg'>('png');

  const dimensions = useMemo(() => {
    return FLYER_SIZE_INFO.find((s) => s.key === size) || FLYER_SIZE_INFO[0];
  }, [size]);

  const ratio = trueWidth / trueHeight;


  const handleWidthChange = (val: string) => {
    setWidthVal(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const computedHeight = Math.round(parsed / ratio);
      setHeightVal(String(computedHeight));
    } else {
      setHeightVal('');
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightVal(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const computedWidth = Math.round(parsed * ratio);
      setWidthVal(String(computedWidth));
    } else {
      setWidthVal('');
    }
  };

  const handleBlur = () => {
    let w = parseInt(widthVal, 10);

    if (isNaN(w) || w <= 0) {
      w = trueWidth * 2;
    }

    // Clamp width to sane range (100 - 8000)
    let clampedW = Math.min(8000, Math.max(100, w));
    let clampedH = Math.round(clampedW / ratio);

    // If height is out of bounds after clamping width, clamp height and adjust width
    if (clampedH < 100) {
      clampedH = 100;
      clampedW = Math.round(clampedH * ratio);
    } else if (clampedH > 8000) {
      clampedH = 8000;
      clampedW = Math.round(clampedH * ratio);
    }

    // Final check for width bounds
    clampedW = Math.min(8000, Math.max(100, clampedW));
    clampedH = Math.round(clampedW / ratio);

    setWidthVal(String(clampedW));
    setHeightVal(String(clampedH));
  };

  const handleConfirmExport = async () => {
    let w = parseInt(widthVal, 10);

    if (isNaN(w) || w <= 0) {
      w = trueWidth * 2;
    }

    let clampedW = Math.min(8000, Math.max(100, w));
    let clampedH = Math.round(clampedW / ratio);

    if (clampedH < 100) {
      clampedH = 100;
      clampedW = Math.round(clampedH * ratio);
    } else if (clampedH > 8000) {
      clampedH = 8000;
      clampedW = Math.round(clampedH * ratio);
    }

    clampedW = Math.min(8000, Math.max(100, clampedW));
    clampedH = Math.round(clampedW / ratio);

    await exportFlyer(clampedW, clampedH, format);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-graphite/80 backdrop-blur-sm select-none pt-safe pb-safe pl-safe pr-safe"
      onClick={onClose}
    >
      <div
        className="relative bg-bone-light border border-nonrepro/35 rounded-2xl p-6 shadow-2xl max-w-sm md:max-w-md w-full flex flex-col gap-4 text-graphite"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-display tracking-tight text-graphite flex items-center gap-2">
            <span className="reg-mark-sm inline-block" />
            Export Flyer
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite-muted hover:text-graphite p-1 rounded-full hover:bg-graphite/5 transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
            aria-label="Close export dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="relative w-full aspect-square md:max-h-64 rounded-xl border border-graphite/10 bg-bone flex items-center justify-center overflow-hidden shadow-inner">
          {isGeneratingExportPreview ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-8 w-8 text-pencil" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs font-semibold text-graphite-muted font-display">Generating preview...</span>
            </div>
          ) : exportPreviewUrl ? (
            <img
              src={exportPreviewUrl}
              alt="Flyer thumbnail"
              className="max-w-full max-h-full object-contain p-2"
            />
          ) : (
            <span className="text-xs text-graphite-muted">Preview unavailable</span>
          )}
        </div>

        {/* Output Format Selector */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
            Output Format
          </span>
          <div className="flex gap-2 p-1 bg-graphite/5 rounded-xl border border-graphite/10">
            {(['png', 'jpeg', 'svg'] as const).map((fmt) => {
              const isSelected = format === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-graphite shadow-sm border border-graphite/10'
                      : 'text-graphite-muted hover:text-graphite border border-transparent'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resolution Inputs */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
            Dimensions (px)
          </span>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="export-width" className="text-[10px] text-graphite-muted font-semibold uppercase tracking-wider font-display">Width</label>
              <input
                id="export-width"
                type="number"
                min={100}
                max={8000}
                value={widthVal}
                onChange={(e) => handleWidthChange(e.target.value)}
                onBlur={handleBlur}
                className="w-full bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg px-3 py-2 text-sm text-graphite placeholder-graphite-muted/40 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-center mt-5 text-graphite-muted" title="Proportions locked">
              <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="export-height" className="text-[10px] text-graphite-muted font-semibold uppercase tracking-wider font-display">Height</label>
              <input
                id="export-height"
                type="number"
                min={100}
                max={8000}
                value={heightVal}
                onChange={(e) => handleHeightChange(e.target.value)}
                onBlur={handleBlur}
                className="w-full bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg px-3 py-2 text-sm text-graphite placeholder-graphite-muted/40 focus:outline-none transition-all"
              />
            </div>
          </div>

          <p className="text-[10px] text-graphite-muted leading-tight mt-0.5">
            Proportions locked to {dimensions?.aspect} ({dimensions?.label}). Range: 100px - 8000px.
          </p>
        </div>

        {/* Formats Info */}
        <div className="text-[10px] text-graphite-muted leading-snug border-t border-graphite/10 pt-3 flex flex-col gap-1">
          <div className="flex justify-between">
            <span>Export Info</span>
            <span className="font-semibold text-graphite">
              {format === 'png' && 'PNG (lossless, supports transparency)'}
              {format === 'jpeg' && 'JPEG (white background fill, no transparency)'}
              {format === 'svg' && 'SVG (vector wrapper + embedded PNG raster)'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs font-semibold border border-graphite/15 hover:border-graphite/30 rounded-lg text-graphite bg-transparent hover:bg-graphite/5 transition-all duration-200 cursor-pointer text-center min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2.5 text-xs font-bold rounded-lg text-bone bg-pencil hover:bg-pencil/90 transition-all duration-200 cursor-pointer shadow-md shadow-pencil/15 text-center min-h-[40px] flex items-center justify-center gap-1.5"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </>
            ) : (
              'Export Flyer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
