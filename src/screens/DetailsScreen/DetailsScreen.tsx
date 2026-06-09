import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFlyerStore } from '../../features/flyer/flyerStore';
import { fieldConfig } from '../../features/flyer/fieldConfig';

export const DetailsScreen: React.FC = () => {
  const navigate = useNavigate();
  const type = useFlyerStore((state) => state.type);
  const size = useFlyerStore((state) => state.size);
  const fields = useFlyerStore((state) => state.fields);
  const setField = useFlyerStore((state) => state.setField);

  const [showDebug, setShowDebug] = useState(false);

  // 4. Redirect to / if type is null
  useEffect(() => {
    if (!type) {
      navigate('/', { replace: true });
    }
  }, [type, navigate]);

  if (!type) {
    return null;
  }

  // Get configurations for selected type
  const fieldDefinitions = fieldConfig[type] || [];

  const getFriendlySizeLabel = (s: string) => {
    switch (s) {
      case 'square': return 'Square (1080x1080)';
      case 'portrait': return 'Portrait (1080x1350)';
      case 'story': return 'Story (1080x1920)';
      default: return s;
    }
  };

  return (
    <div className="min-h-screen bg-bone text-graphite flex flex-col justify-start items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Registration marks */}
      <span className="reg-mark absolute top-4 left-4 select-none pointer-events-none" />
      <span className="reg-mark absolute top-4 right-4 select-none pointer-events-none" />

      <div className="max-w-xl w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">

          <h1 id="details-title" className="text-4xl font-bold tracking-tight text-graphite font-display">
            Campaign Details
          </h1>
          <p className="text-graphite-muted text-sm max-w-md mx-auto">
            Fill in your <span className="text-pencil font-semibold capitalize">{type}</span> flyer details. All fields are optional.
          </p>
        </div>

        {/* Selected Config Info Panel */}
        <div className="p-4 rounded-lg bg-bone-light border border-graphite/10 flex items-center justify-between text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-graphite-muted">Type:</span>
            <span className="font-semibold text-nonrepro capitalize">{type}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-graphite/20" />
          <div className="flex items-center gap-2">
            <span className="text-graphite-muted">Format:</span>
            <span className="font-semibold text-nonrepro capitalize">{getFriendlySizeLabel(size)}</span>
          </div>
        </div>

        {/* Dynamic Details Form */}
        <div className="p-6 sm:p-8 rounded-lg bg-bone-light border border-graphite/10 shadow-md space-y-6">
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            {fieldDefinitions.map((field) => {
              const value = fields[field.key] || '';
              return (
                <div key={field.key} className="flex flex-col space-y-1.5">
                  <label 
                    htmlFor={`field-${field.key}`}
                    className="text-xs sm:text-sm font-semibold text-graphite transition-colors duration-200"
                  >
                    {field.label}
                  </label>
                  {field.multiline ? (
                    <textarea
                      id={`field-${field.key}`}
                      name={field.key}
                      placeholder={field.placeholder}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      rows={4}
                      className="w-full bg-white border border-graphite/15 rounded-lg px-4 py-3 text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      id={`field-${field.key}`}
                      name={field.key}
                      placeholder={field.placeholder}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full bg-white border border-graphite/15 rounded-lg px-4 py-3 text-sm text-graphite placeholder-graphite-muted/50 focus:border-nonrepro focus:ring-1 focus:ring-nonrepro transition-all duration-200 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </form>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col gap-3">
            <Link
              id="to-editor-btn"
              to="/editor"
              className="inline-flex w-full items-center justify-center px-6 py-3.5 border border-transparent text-base font-bold rounded-lg text-bone bg-pencil hover:bg-pencil/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pencil focus:ring-offset-bone transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-md shadow-pencil/15 font-display"
            >
              Continue to Editor
              <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <Link
              id="back-to-setup-btn"
              to="/"
              className="inline-flex w-full items-center justify-center px-6 py-3.5 border border-graphite/15 hover:border-graphite/25 text-sm font-semibold rounded-lg text-graphite-muted hover:text-graphite bg-transparent hover:bg-bone focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nonrepro focus:ring-offset-bone transition-all duration-200 cursor-pointer"
            >
              Back to Setup
            </Link>
          </div>
        </div>

        {/* Live Store Verification / Debug Panel */}
        <div className="rounded-lg border border-graphite/10 bg-bone-light overflow-hidden">
          <button 
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-graphite-muted hover:text-graphite transition-colors"
          >
            <span>STORE VERIFICATION PANEL (DEBUG)</span>
            <span className="font-mono">{showDebug ? '[-] Hide' : '[+] Show Store Data'}</span>
          </button>
          {showDebug && (
            <div className="p-4 border-t border-graphite/10 bg-white font-mono text-[11px] text-graphite space-y-2 max-h-60 overflow-y-auto">
              <div>
                <span className="text-graphite-muted">// useFlyerStore state details:</span>
              </div>
              <div className="flex gap-2">
                <span className="text-graphite-muted">type:</span>
                <span className="text-nonrepro">"{type}"</span>
              </div>
              <div className="flex gap-2">
                <span className="text-graphite-muted">size:</span>
                <span className="text-nonrepro">"{size}"</span>
              </div>
              <div className="space-y-1">
                <span className="text-graphite-muted">fields:</span>
                {Object.keys(fields).length === 0 ? (
                  <span className="text-graphite-muted/60"> {} (empty)</span>
                ) : (
                  <pre className="text-pencil pl-4">{JSON.stringify(fields, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
