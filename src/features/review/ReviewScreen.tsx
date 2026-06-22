import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, GatewayError } from './gatewayClient';
import type { SessionEnvelope } from './gatewayClient';
import { trackEvent } from '../../lib/analytics';

// ── Stub Boundaries for Next Prompts ──
export function ingestDesign(design: any) {
  // TODO: Ingest A2UI design -> FlyerState
  console.log('[TODO: Ingest Design Boundary] Ingesting design:', design);
}

export function buildResult(state: 'approved_downloaded' | 'sent_back'): any {
  // TODO: Build FlyerState -> result
  console.log('[TODO: Build Result Boundary] Building result for state:', state);
  return null;
}

export default function ReviewScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<SessionEnvelope | null>(null);
  const [error, setError] = useState<any>(null);

  // StrictMode and re-render guard tracking the active sessionId
  const fetchedSessionId = useRef<string | null>(null);

  const loadSession = useCallback(async (isRetry = false) => {
    if (!sessionId) {
      setError(new Error('No session ID provided in the URL.'));
      setLoading(false);
      return;
    }

    // Guard so we do not double GET the same session on mount/re-render.
    // GET has side effects on the server (transitions posted -> in_review).
    if (!isRetry && fetchedSessionId.current === sessionId) {
      return;
    }

    fetchedSessionId.current = sessionId;
    setLoading(true);
    setError(null);

    try {
      const data = await getSession(sessionId);
      setSession(data);

      // Track event in PostHog
      trackEvent('review_opened', {
        state: data.state,
        preset: data.design?.canvas?.preset,
      });
    } catch (err: any) {
      console.error('Error fetching review session:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession(false);
  }, [loadSession]);

  const handleRetry = () => {
    loadSession(true);
  };

  // ── 1. LOADING STATE ──
  if (loading) {
    return (
      <div className="min-h-screen bg-bone pasteup-grid flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Decorative corner crosshairs */}
        <div className="absolute top-6 left-6 reg-mark"></div>
        <div className="absolute top-6 right-6 reg-mark"></div>
        <div className="absolute bottom-6 left-6 reg-mark"></div>
        <div className="absolute bottom-6 right-6 reg-mark"></div>

        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
          {/* Animated spinner designed as rotating draft alignment marks */}
          <div className="w-16 h-16 border-4 border-nonrepro/35 border-t-pencil rounded-full animate-spin flex items-center justify-center">
            <span className="text-pencil font-mono font-bold text-xl select-none">+</span>
          </div>
          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl tracking-tight text-graphite uppercase">
              Preparing Review Desk
            </h2>
            <p className="font-body text-sm text-graphite-muted">
              Fetching capabilities and workspace parameters...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. ERROR STATE RENDERER ──
  if (error) {
    let title = 'Connection Error';
    let message = 'Something went wrong while loading the review session.';
    let isRetryable = true;
    let cardBorder = 'border-pencil/50';
    let accentBg = 'bg-pencil/10';
    let accentText = 'text-pencil';

    if (error instanceof GatewayError) {
      if (error.status === 404) {
        title = 'Session Not Found';
        message = 'The review session URL is invalid or the session has been deleted.';
        isRetryable = false;
        cardBorder = 'border-graphite-muted/40';
        accentBg = 'bg-graphite/5';
        accentText = 'text-graphite-muted';
      } else if (error.status === 410) {
        title = 'Session Expired';
        message = 'This review session has expired and can no longer be accessed.';
        isRetryable = false;
        cardBorder = 'border-pencil/50';
        accentBg = 'bg-pencil/10';
        accentText = 'text-pencil';
      } else if (error.status === 409) {
        title = 'Session Closed';
        message = 'This session is already closed. The design was approved or returned to the agent.';
        isRetryable = false;
        cardBorder = 'border-nonrepro/50';
        accentBg = 'bg-nonrepro/15';
        accentText = 'text-nonrepro';
      }
    } else {
      // General network error
      message = error.message || 'Please check your internet connection and try again.';
    }

    return (
      <div className="min-h-screen bg-bone pasteup-grid flex flex-col items-center justify-center p-6 select-none relative">
        <div className="absolute top-6 left-6 reg-mark"></div>
        <div className="absolute top-6 right-6 reg-mark"></div>
        <div className="absolute bottom-6 left-6 reg-mark"></div>
        <div className="absolute bottom-6 right-6 reg-mark"></div>

        <div className={`max-w-md w-full bg-bone-light border-2 ${cardBorder} shadow-lg p-8 rounded-none relative`}>
          {/* Header ribbon */}
          <div className="absolute -top-3 left-6 px-3 py-1 bg-graphite text-bone text-xs font-mono tracking-widest uppercase">
            System Notice
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-none ${accentBg} ${accentText} font-mono font-bold text-lg select-none`}>
                !
              </div>
              <div className="space-y-1">
                <h2 className="font-display font-bold text-xl uppercase tracking-tight text-graphite">
                  {title}
                </h2>
                <p className="font-body text-sm text-graphite-muted leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {isRetryable && (
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 bg-pencil text-bone-light font-display font-semibold text-sm tracking-wider uppercase hover:bg-pencil/95 active:translate-y-[1px] transition-all cursor-pointer shadow-sm"
                >
                  Retry Connection
                </button>
              )}
              <Link
                to="/"
                className="px-6 py-2.5 border-2 border-graphite text-graphite font-display font-semibold text-sm tracking-wider uppercase text-center hover:bg-graphite hover:text-bone-light active:translate-y-[1px] transition-all cursor-pointer"
              >
                Go to Editor
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. SESSION STATE RENDERERS (NO ERROR, SESSION LOADED) ──
  const state = session?.state;
  const design = session?.design;

  // 3a. Expired State (state === 'expired')
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-bone pasteup-grid flex flex-col items-center justify-center p-6 select-none relative">
        <div className="absolute top-6 left-6 reg-mark"></div>
        <div className="absolute top-6 right-6 reg-mark"></div>
        <div className="absolute bottom-6 left-6 reg-mark"></div>
        <div className="absolute bottom-6 right-6 reg-mark"></div>

        <div className="max-w-md w-full bg-bone-light border-2 border-pencil/50 shadow-lg p-8 rounded-none relative">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-pencil text-bone-light text-xs font-mono tracking-widest uppercase">
            Session Expired
          </div>
          <div className="space-y-6 pt-4">
            <p className="font-body text-base text-graphite leading-relaxed font-medium">
              This review session has expired.
            </p>
            <p className="font-body text-sm text-graphite-muted leading-relaxed">
              Session tokens are temporary. Please request a new review capability from the agent gateway.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-block px-6 py-2.5 border-2 border-graphite text-graphite font-display font-semibold text-sm tracking-wider uppercase hover:bg-graphite hover:text-bone-light active:translate-y-[1px] transition-all"
              >
                Return to Editor
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3b. Terminal States (state === 'approved_downloaded' || state === 'sent_back')
  if (state === 'approved_downloaded' || state === 'sent_back') {
    return (
      <div className="min-h-screen bg-bone pasteup-grid flex flex-col items-center justify-center p-6 select-none relative">
        <div className="absolute top-6 left-6 reg-mark"></div>
        <div className="absolute top-6 right-6 reg-mark"></div>
        <div className="absolute bottom-6 left-6 reg-mark"></div>
        <div className="absolute bottom-6 right-6 reg-mark"></div>

        <div className="max-w-md w-full bg-bone-light border-2 border-nonrepro/50 shadow-lg p-8 rounded-none relative">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-graphite text-bone text-xs font-mono tracking-widest uppercase">
            Closed Workspace
          </div>
          <div className="space-y-6 pt-4">
            <p className="font-body text-base text-graphite leading-relaxed font-medium">
              This session is already closed.
            </p>
            <p className="font-body text-sm text-graphite-muted leading-relaxed">
              No further edits can be written. The design state is permanently recorded as{' '}
              <span className="font-mono bg-nonrepro/15 px-1.5 py-0.5 rounded text-graphite">
                {state}
              </span>
              .
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-block px-6 py-2.5 border-2 border-graphite text-graphite font-display font-semibold text-sm tracking-wider uppercase hover:bg-graphite hover:text-bone-light active:translate-y-[1px] transition-all"
              >
                Go to Editor
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3c. Created State (state === 'created' or design is null)
  if (state === 'created' || !design) {
    return (
      <div className="min-h-screen bg-bone pasteup-grid flex flex-col items-center justify-center p-6 select-none relative">
        <div className="absolute top-6 left-6 reg-mark"></div>
        <div className="absolute top-6 right-6 reg-mark"></div>
        <div className="absolute bottom-6 left-6 reg-mark"></div>
        <div className="absolute bottom-6 right-6 reg-mark"></div>

        <div className="max-w-md w-full bg-bone-light border-2 border-ochre/50 shadow-lg p-8 rounded-none relative">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-ochre text-graphite text-xs font-mono tracking-widest uppercase font-bold">
            Awaiting Design
          </div>
          <div className="space-y-6 pt-4 text-center">
            <div className="w-12 h-12 border-2 border-dashed border-ochre rounded-full animate-pulse mx-auto flex items-center justify-center">
              <span className="text-ochre font-mono">+</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg text-graphite uppercase">
                Waiting for the agent's design
              </h3>
              <p className="font-body text-sm text-graphite-muted leading-relaxed">
                The session has been initialized by the gateway, but no layouts have been posted by the agent.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleRetry}
                className="px-6 py-2.5 bg-graphite text-bone font-display font-semibold text-sm tracking-wider uppercase hover:bg-graphite/90 transition-all cursor-pointer"
              >
                Poll Gateway
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3d. Active States (state === 'posted' || state === 'in_review')
  // We render the layout preview desk placeholder showing preset + overlay count.
  const overlays = design.layers?.overlay || [];

  return (
    <div className="min-h-screen bg-bone flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-bone-light border-b border-graphite-muted/15 px-6 py-4 flex items-center justify-between select-none shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <span className="reg-mark-sm"></span>
          <h1 className="font-display font-extrabold text-lg tracking-wider text-graphite uppercase">
            Greenlight <span className="font-mono text-xs text-pencil tracking-widest ml-2 bg-pencil/10 px-2 py-0.5 font-normal">REVIEW DESK</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <span className="font-mono text-xs text-graphite-muted hidden md:inline">
            SESSION: {sessionId}
          </span>
          <div className="px-3 py-1 bg-nonrepro text-bone text-xs font-mono uppercase tracking-wider rounded-none font-bold">
            {state}
          </div>
        </div>
      </header>

      {/* Main Workspace Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Drafting Board Placeholder for Konva Canvas */}
        <div className="flex-1 bg-bone pasteup-grid p-6 md:p-12 overflow-y-auto flex items-center justify-center relative">
          {/* Corner Marks */}
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>

          {/* Canvas Blueprint Container */}
          <div className="max-w-2xl w-full bg-bone-light border-2 border-dashed border-nonrepro shadow-md p-8 relative flex flex-col justify-between aspect-square max-h-[70vh]">
            <div className="absolute top-2 left-3 font-mono text-[10px] text-nonrepro uppercase select-none">
              Canvas Outline Draft
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-4">
              <div className="p-4 bg-nonrepro/10 rounded-none border border-nonrepro text-nonrepro inline-block">
                <svg className="w-12 h-12 stroke-current" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-xl text-graphite uppercase tracking-tight">
                  Design Preview
                </h3>
                <p className="font-body text-sm text-graphite-muted max-w-md mx-auto">
                  A2UI representation loaded successfully. The interactive canvas will render here upon boundary execution.
                </p>
              </div>

              {/* Design Spec Summary Table */}
              <div className="w-full max-w-sm border border-graphite-muted/10 bg-bone p-4 rounded-none font-mono text-xs text-left space-y-2 text-graphite shadow-inner">
                <div className="font-bold border-b border-graphite-muted/15 pb-1 text-graphite uppercase">
                  Design Properties:
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Preset:</span>
                  <span className="font-bold text-pencil uppercase">{design.canvas?.preset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Dimensions:</span>
                  <span>{design.canvas?.width}px × {design.canvas?.height}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Background:</span>
                  <span className="truncate max-w-[200px]" title={design.layers?.background?.value}>
                    {design.layers?.background?.type} ({design.layers?.background?.value})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite-muted">Overlays:</span>
                  <span>{overlays.length} element(s)</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <span className="inline-block px-3 py-1 bg-nonrepro text-bone text-[10px] font-mono tracking-widest uppercase">
                [Stub Boundary: Ingest design & render canvas]
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Control Panel / Details Sidebar */}
        <aside className="w-full md:w-80 bg-bone-light border-t md:border-t-0 md:border-l border-graphite-muted/15 flex flex-col shrink-0 overflow-y-auto editor-sidebar select-none">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-display font-bold text-sm tracking-wider uppercase text-graphite mb-3">
                Review Context
              </h2>
              <div className="bg-bone border border-graphite-muted/10 p-4 space-y-3 font-mono text-xs text-graphite shadow-sm">
                <div>
                  <div className="text-graphite-muted text-[10px] uppercase">Session ID</div>
                  <div className="truncate font-bold" title={sessionId}>{sessionId}</div>
                </div>
                <div>
                  <div className="text-graphite-muted text-[10px] uppercase">Source Agent</div>
                  <div className="font-bold uppercase text-pencil">{design.meta?.source_agent || 'Unknown'}</div>
                </div>
                {design.meta?.intent && (
                  <div>
                    <div className="text-graphite-muted text-[10px] uppercase">Intent</div>
                    <div className="font-bold">{design.meta?.intent}</div>
                  </div>
                )}
                <div>
                  <div className="text-graphite-muted text-[10px] uppercase">Schema Version</div>
                  <div>{design.schema_version}</div>
                </div>
              </div>
            </div>

            {/* Overlays List Blueprint */}
            <div>
              <h2 className="font-display font-bold text-sm tracking-wider uppercase text-graphite mb-3">
                Overlays Schema Details
              </h2>
              <div className="space-y-3">
                {overlays.map((node: any, idx: number) => (
                  <div key={node.id || idx} className="bg-bone border border-graphite-muted/10 p-3 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between items-center border-b border-graphite-muted/10 pb-1">
                      <span className="font-bold text-graphite text-[10px]">#{idx + 1} {node.id}</span>
                      <span className={`px-1.5 py-0.5 text-[8px] uppercase tracking-wider ${node.type === 'text' ? 'bg-pencil/10 text-pencil' : 'bg-nonrepro/15 text-nonrepro'}`}>
                        {node.type}
                      </span>
                    </div>

                    {node.type === 'text' ? (
                      <div className="space-y-1 text-graphite-muted text-[10px]">
                        <div className="text-graphite font-body text-xs font-semibold mb-1 truncate bg-bone-light p-1">
                          "{node.content}"
                        </div>
                        <div className="flex justify-between">
                          <span>Font:</span>
                          <span className="text-graphite">{node.font} ({node.size}px)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Color:</span>
                          <span className="font-bold" style={{ color: node.color }}>{node.color}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Box (x, y, w):</span>
                          <span className="text-graphite">({node.x.toFixed(2)}, {node.y.toFixed(2)}, {node.w.toFixed(2)})</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-graphite-muted text-[10px]">
                        <div className="truncate bg-bone-light p-1 text-[8px]" title={node.value}>
                          URL: {node.value}
                        </div>
                        <div className="flex justify-between">
                          <span>Box (x,y):</span>
                          <span className="text-graphite">({node.x.toFixed(2)}, {node.y.toFixed(2)})</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size (w,h):</span>
                          <span className="text-graphite">({node.w.toFixed(2)}, {node.h.toFixed(2)})</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {overlays.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-graphite-muted/15 text-xs text-graphite-muted font-body">
                    No overlays present in design
                  </div>
                )}
              </div>
            </div>

            {/* TODO / Next Steps stub warnings */}
            <div className="border border-ochre/30 bg-ochre/5 p-4 space-y-2 select-none">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ochre">
                Integration Checklist
              </h3>
              <ul className="list-disc pl-4 space-y-1 font-body text-[11px] text-graphite-muted">
                <li>A2UI Design Ingestion</li>
                <li>Konva Canvas Rendering</li>
                <li>Responsive Action Controls</li>
                <li>Gateway POST Results Integration</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
