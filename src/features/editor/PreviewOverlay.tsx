import React from 'react';

interface PreviewOverlayProps {
  previewUrl: string | null;
  onClose: () => void;
}

export const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  previewUrl,
  onClose,
}) => {
  if (!previewUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 bg-graphite/90 backdrop-blur-sm select-none pt-safe pb-safe pl-safe pr-safe animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button: visible ✕ button (top corner, finger-sized >= 44px) */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/25 focus:outline-none"
        aria-label="Close preview"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Centered Image Wrapper */}
      <div
        className="relative max-w-full max-h-[85vh] md:max-h-[90vh] flex items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={previewUrl}
          alt="Flyer preview"
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-graphite/10"
        />
      </div>
    </div>
  );
};
