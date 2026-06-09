import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlyerStore } from '../../features/flyer/flyerStore';
import { FLYER_SIZE_INFO } from '../../features/flyer/sizes';

const FLYER_TYPES = [
  {
    key: 'event' as const,
    title: 'Event',
    description: 'Promote a concert, party, festival, or gathering.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    badge: 'Popular',
  },
  {
    key: 'service' as const,
    title: 'Service',
    description: 'Advertise coaching, consulting, design, or local trades.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'product' as const,
    title: 'Product',
    description: 'Showcase clothing, food, digital goods, or retail items.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
];

// Size data is imported from FLYER_SIZE_INFO (single source of truth)

export const SetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const setType = useFlyerStore((state) => state.setType);
  const setSize = useFlyerStore((state) => state.setSize);

  // Continue disabled until both a type and size are chosen
  const isContinueDisabled = !type || !size;

  return (
    <div className="min-h-screen bg-bone text-graphite flex flex-col items-center justify-start py-12 px-4 sm:px-6 lg:px-8 pasteup-grid relative">
      {/* Registration marks in corners */}
      <span className="reg-mark absolute top-4 left-4 select-none pointer-events-none" />
      <span className="reg-mark absolute top-4 right-4 select-none pointer-events-none" />
      <span className="reg-mark absolute bottom-4 left-4 select-none pointer-events-none" />
      <span className="reg-mark absolute bottom-4 right-4 select-none pointer-events-none" />

      <div className="max-w-4xl w-full space-y-12 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">

          <h1 id="setup-title" className="text-4xl sm:text-5xl font-bold tracking-tight text-graphite font-display">
            Create Your Flyer
          </h1>
          <p className="text-graphite-muted max-w-md mx-auto text-base">
            Select a campaign type and output format to set up your layout.
          </p>
        </div>

        {/* Section 1: Flyer Type */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-graphite font-display flex items-center gap-2">
            <span className="reg-mark-sm" />
            Campaign Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FLYER_TYPES.map((t) => {
              const isSelected = type === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`group relative flex flex-col text-left p-6 rounded-lg border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-nonrepro focus:ring-offset-2 focus:ring-offset-bone ${
                    isSelected
                      ? 'border-nonrepro bg-nonrepro/8 text-graphite ring-1 ring-nonrepro/40 shadow-md'
                      : 'border-graphite/12 bg-bone-light hover:bg-bone-light/80 text-graphite hover:border-graphite/20 shadow-sm'
                  }`}
                >
                  {t.badge && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-ochre/15 text-ochre border border-ochre/25">
                      {t.badge}
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-200 ${
                    isSelected
                      ? 'bg-nonrepro/15 text-nonrepro border border-nonrepro/30'
                      : 'bg-bone text-graphite-muted group-hover:text-graphite border border-graphite/10'
                  }`}>
                    {t.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-1 font-display group-hover:text-graphite transition-colors duration-200">
                    {t.title}
                  </h3>
                  <p className="text-sm text-graphite-muted leading-relaxed group-hover:text-graphite/70 transition-colors duration-200">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Output Size */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-graphite font-display flex items-center gap-2">
            <span className="reg-mark-sm" />
            Flyer Size
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FLYER_SIZE_INFO.map((s) => {
              const isSelected = size === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSize(s.key)}
                  className={`group relative flex flex-col text-left p-6 rounded-lg border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-nonrepro focus:ring-offset-2 focus:ring-offset-bone ${
                    isSelected
                      ? 'border-nonrepro bg-nonrepro/8 text-graphite ring-1 ring-nonrepro/40 shadow-md'
                      : 'border-graphite/12 bg-bone-light hover:bg-bone-light/80 text-graphite hover:border-graphite/20 shadow-sm'
                  }`}
                >
                  {/* Aspect Ratio Box Visual Representation */}
                  <div className="h-24 flex items-center justify-center mb-4 bg-bone rounded-lg border border-graphite/8 p-2">
                    <div className={`rounded border-2 transition-all duration-200 flex items-center justify-center ${s.ratioClass} ${
                      isSelected
                        ? 'border-nonrepro bg-nonrepro/10 text-nonrepro shadow-inner'
                        : 'border-graphite/20 bg-bone-light text-graphite-muted group-hover:border-graphite/30'
                    }`}>
                      <span className="text-[10px] font-mono font-bold tracking-tight">{s.aspect}</span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="text-lg font-bold font-display group-hover:text-graphite transition-colors duration-200">
                      {s.label}
                    </h3>
                    <span className="text-xs font-mono font-medium text-graphite-muted group-hover:text-graphite/60">
                      {s.dimensions}
                    </span>
                  </div>
                  <p className="text-sm text-graphite-muted leading-relaxed group-hover:text-graphite/70 transition-colors duration-200">
                    {s.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Button */}
        <div className="pt-6 flex justify-center">
          <button
            id="to-details-btn"
            disabled={isContinueDisabled}
            onClick={() => navigate('/details')}
            className={`group relative inline-flex items-center justify-center px-12 py-4 border border-transparent text-lg font-bold rounded-lg shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pencil focus:ring-offset-bone font-display ${
              isContinueDisabled
                ? 'bg-graphite/15 text-graphite-muted cursor-not-allowed shadow-none'
                : 'bg-pencil text-bone hover:bg-pencil/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-pencil/20'
            }`}
          >
            {isContinueDisabled ? (
              <span className="flex items-center gap-2">
                Make your selections
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue to Details
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
