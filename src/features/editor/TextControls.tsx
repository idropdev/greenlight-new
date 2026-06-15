import React from 'react';
import { useFlyerStore } from '../flyer/flyerStore';
import type { TextNode } from '../flyer/flyerStore';
import { FONTS, ensureFontsLoaded } from '../../lib/fonts';

const ALIGN_OPTIONS = [
  { value: 'left', label: 'L', title: 'Align left' },
  { value: 'center', label: 'C', title: 'Align center' },
  { value: 'right', label: 'R', title: 'Align right' },
] as const;

interface TextControlsProps {
  onFontChange?: () => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ onFontChange }) => {
  const selectedNodeId = useFlyerStore((state) => state.selectedNodeId);
  const selectedNodeIds = useFlyerStore((state) => state.selectedNodeIds);
  const textNodes = useFlyerStore((state) => state.textNodes);
  const updateNode = useFlyerStore((state) => state.updateNode);

  const node = textNodes.find((n) => n.id === selectedNodeId);
  const updateSelectedNodes = (partial: Partial<TextNode>) => {
    const targetIds = selectedNodeIds.length > 1 ? selectedNodeIds : node ? [node.id] : [];
    targetIds.forEach((id) => updateNode(id, partial));
  };

  const [isShufflingFont, setIsShufflingFont] = React.useState(false);

  const handleShuffleFont = async () => {
    if (!node) return;
    setIsShufflingFont(true);
    try {
      const currentIndex = FONTS.findIndex((f) => f.family === node.fontFamily);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % FONTS.length;
      const nextFont = FONTS[nextIndex];

      await ensureFontsLoaded();

      updateSelectedNodes({ fontFamily: nextFont.family });
      onFontChange?.();
    } catch (err) {
      console.error('[FontShuffle] Failed to shuffle font:', err);
    } finally {
      setIsShufflingFont(false);
    }
  };

  // If no node is selected, render a subtle instructions card placeholder
  if (!selectedNodeId || !node) {
    return (
      <div className="w-full lg:w-80 bg-bone-light border border-graphite/10 rounded-lg p-6 flex flex-col items-center justify-center text-center text-graphite-muted min-h-[300px] border-dashed select-none shadow-sm">
        <div className="w-12 h-12 rounded-lg bg-white border border-graphite/10 flex items-center justify-center mb-4 text-nonrepro">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-graphite font-display">No Layer Selected</span>
        <p className="text-xs text-graphite-muted mt-2 max-w-[200px] leading-relaxed">
          Click a text layer on the flyer canvas to configure its content, typography, sizing, and color.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-80 bg-bone-light border border-graphite/10 rounded-lg p-6 flex flex-col gap-6 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-graphite/10">
        <div>
          <span className="text-[10px] font-bold text-pencil uppercase tracking-widest bg-pencil/10 px-2 py-0.5 rounded-full">
            Active Layer
          </span>
          <h3 className="text-base font-bold text-graphite mt-1 capitalize font-display">
            {node.field} Properties
          </h3>
        </div>
      </div>

      {/* Control: Text content */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
          Text Content
        </label>
        <textarea
          value={node.text}
          onChange={(e) => updateNode(node.id, { text: e.target.value })}
          rows={3}
          placeholder="Enter text..."
          className="w-full bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg p-3 text-base md:text-sm text-graphite placeholder-graphite-muted/50 focus:outline-none transition-all resize-none leading-relaxed min-h-[44px]"
        />
      </div>

      {/* Control: Font Family */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
          Typography
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={node.fontFamily}
              onChange={(e) => updateSelectedNodes({ fontFamily: e.target.value })}
              style={{ fontFamily: node.fontFamily }}
              className="w-full bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg py-3 px-3 md:py-2.5 md:px-3 text-base md:text-sm text-graphite focus:outline-none transition-all cursor-pointer appearance-none pr-10 min-h-[44px] md:min-h-0"
            >
              {FONTS.map((font) => (
                <option
                  key={font.family}
                  value={font.family}
                  style={{ fontFamily: font.family }}
                  className="bg-white text-graphite py-2 font-normal"
                >
                  {font.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-graphite-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <button
            type="button"
            onClick={handleShuffleFont}
            disabled={isShufflingFont}
            className="flex-shrink-0 flex items-center justify-center w-11 h-11 md:w-[38px] md:h-[38px] rounded-lg border border-graphite/15 bg-white text-graphite hover:text-pencil hover:border-pencil/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nonrepro disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="Shuffle font"
          >
            <svg className="w-5 h-5 md:w-4.5 md:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M12 12h.01" strokeWidth="4" />
              <path d="M8 8h.01" strokeWidth="4" />
              <path d="M8 16h.01" strokeWidth="4" />
              <path d="M16 8h.01" strokeWidth="4" />
              <path d="M16 16h.01" strokeWidth="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Control: Font Size */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display flex justify-between">
          <span>Font Size</span>
          <span className="font-mono text-[10px] text-graphite-muted">8px – 200px</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="8"
            max="200"
            value={node.fontSize}
            onChange={(e) => updateSelectedNodes({ fontSize: parseInt(e.target.value) || 12 })}
            className="flex-1 h-1 bg-nonrepro/20 rounded-lg appearance-none cursor-pointer py-3 md:py-1.5"
          />
          <input
            type="number"
            min="8"
            max="200"
            inputMode="numeric"
            value={node.fontSize}
            onChange={(e) => {
              const val = Math.min(200, Math.max(8, parseInt(e.target.value) || 8));
              updateSelectedNodes({ fontSize: val });
            }}
            className="w-16 bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg p-3 md:p-2.5 text-base md:text-xs text-graphite font-mono text-center focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-h-[44px] md:min-h-0"
          />
        </div>
      </div>

      {/* Control: Alignment */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
          Alignment
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ALIGN_OPTIONS.map((option) => {
            const isActive = (node.align ?? 'left') === option.value;

            return (
              <button
                key={option.value}
                type="button"
                title={option.title}
                aria-pressed={isActive}
                onClick={() => updateSelectedNodes({ align: option.value })}
                className={`h-11 md:h-9 rounded-lg border text-xs font-bold font-display transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nonrepro focus:ring-offset-2 focus:ring-offset-bone-light ${
                  isActive
                    ? 'bg-nonrepro/10 border-nonrepro text-nonrepro shadow-sm'
                    : 'bg-white border-graphite/15 text-graphite-muted hover:border-nonrepro/45 hover:text-graphite'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control: Color */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
          Text Color
        </label>
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 md:w-11 md:h-11 rounded-lg overflow-hidden border border-graphite/15 flex-shrink-0 bg-white focus-within:ring-1 focus-within:ring-nonrepro focus-within:border-nonrepro transition-all">
            <input
              type="color"
              value={node.fill}
              onChange={(e) => updateSelectedNodes({ fill: e.target.value })}
              className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 p-0"
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-graphite-muted text-sm font-mono">#</span>
            <input
              type="text"
              value={node.fill.replace('#', '')}
              onChange={(e) => {
                const hex = e.target.value;
                if (/^[0-9A-Fa-f]{0,6}$/.test(hex)) {
                  updateSelectedNodes({ fill: `#${hex}` });
                }
              }}
              placeholder="FFFFFF"
              maxLength={6}
              className="w-full bg-white border border-graphite/15 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro rounded-lg pl-8 pr-3 py-3 text-base md:text-sm font-mono text-graphite uppercase focus:outline-none transition-all min-h-[44px] md:min-h-0"
            />
          </div>
        </div>
      </div>

      {/* Control: Legibility */}
      <div className="flex flex-col gap-4">
        <label className="text-xs font-semibold text-graphite-muted uppercase tracking-wider font-display">
          Legibility
        </label>
        
        {/* Shadow Toggle */}
        <div 
          onClick={() => updateSelectedNodes({ shadowEnabled: !(node.shadowEnabled ?? true) })}
          className="flex items-center justify-between min-h-[44px] cursor-pointer select-none"
        >
          <span className="text-sm font-medium text-graphite">Drop Shadow</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateSelectedNodes({ shadowEnabled: !(node.shadowEnabled ?? true) });
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              (node.shadowEnabled ?? true) ? 'bg-nonrepro' : 'bg-graphite/20'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                (node.shadowEnabled ?? true) ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Highlight Toggle & Controls */}
        <div className="flex flex-col gap-1 p-3 bg-white border border-graphite/10 rounded-lg">
          <div 
            onClick={() => updateSelectedNodes({ highlightEnabled: !(node.highlightEnabled ?? false) })}
            className="flex items-center justify-between min-h-[44px] cursor-pointer select-none"
          >
            <span className="text-sm font-medium text-graphite">Highlight Box</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSelectedNodes({ highlightEnabled: !(node.highlightEnabled ?? false) });
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                (node.highlightEnabled ?? false) ? 'bg-nonrepro' : 'bg-graphite/20'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  (node.highlightEnabled ?? false) ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {(node.highlightEnabled ?? false) && (
            <div className="flex flex-col gap-3 pt-2 border-t border-graphite/10 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-3">
                <span className="text-xs text-graphite-muted w-12">Color</span>
                <div className="relative w-11 h-11 md:w-8 md:h-8 rounded-lg overflow-hidden border border-graphite/15 flex-shrink-0 bg-white focus-within:ring-1 focus-within:ring-nonrepro transition-all">
                  <input
                    type="color"
                    value={node.highlightColor ?? '#000000'}
                    onChange={(e) => updateSelectedNodes({ highlightColor: e.target.value })}
                    className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 p-0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-graphite-muted w-12">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={node.highlightOpacity ?? 0.5}
                  onChange={(e) => updateSelectedNodes({ highlightOpacity: parseFloat(e.target.value) })}
                  className="flex-1 h-1 bg-nonrepro/20 rounded-lg appearance-none cursor-pointer py-3 md:py-1.5"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
