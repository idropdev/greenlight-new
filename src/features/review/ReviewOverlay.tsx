import React from 'react';
import { Link } from 'react-router-dom';
import { GatewayError } from './gatewayClient';
import type { SessionEnvelope } from './gatewayClient';

interface ReviewOverlayProps {
  loading: boolean;
  session: SessionEnvelope | null;
  error: unknown;
  handleRetry: () => void;
}

export const ReviewOverlay: React.FC<ReviewOverlayProps> = ({
  loading,
  session,
  error,
  handleRetry,
}) => {
  if (!loading && !error && !session) {
    return null;
  }

  const hasActiveDesign = session?.design && (session.state === 'posted' || session.state === 'in_review');
  if (!loading && !error && hasActiveDesign) {
    return null;
  }

  // 1. Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-graphite/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6 bg-bone-light border-2 border-nonrepro/35 shadow-lg p-8 rounded-none relative">
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>

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

  // 2. Error state
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
      message = error instanceof Error ? error.message : 'Please check your internet connection and try again.';
    }

    return (
      <div className="fixed inset-0 bg-graphite/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
        <div className={`max-w-md w-full bg-bone-light border-2 ${cardBorder} shadow-lg p-8 rounded-none relative`}>
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>
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

  const state = session?.state;
  const design = session?.design;

  // 3a. Expired State
  if (state === 'expired') {
    return (
      <div className="fixed inset-0 bg-graphite/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-bone-light border-2 border-pencil/50 shadow-lg p-8 rounded-none relative">
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>
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

  // 3b. Terminal States
  if (state === 'approved_downloaded' || state === 'sent_back') {
    const isSentBack = state === 'sent_back';
    return (
      <div className="fixed inset-0 bg-graphite/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
        <div className={`max-w-md w-full bg-bone-light border-2 ${isSentBack ? 'border-nonrepro/50' : 'border-pencil/50'} shadow-lg p-8 rounded-none relative`}>
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>
          <div className={`absolute -top-3 left-6 px-3 py-1 ${isSentBack ? 'bg-nonrepro text-bone' : 'bg-pencil text-bone'} text-xs font-mono tracking-widest uppercase`}>
            {isSentBack ? 'Design Sent Back' : 'Design Approved'}
          </div>
          <div className="space-y-6 pt-4">
            <h2 className="font-display font-bold text-xl uppercase tracking-tight text-graphite">
              {isSentBack ? 'Returned to Agent' : 'Approved & Downloaded'}
            </h2>
            <p className="font-body text-sm text-graphite-muted leading-relaxed font-medium">
              {isSentBack
                ? 'The flyer design has been sent back to the agent with your feedback. The agent will review your changes and respond with a new draft.'
                : 'The flyer has been approved, the final output file was downloaded, and the result was recorded on the gateway.'}
            </p>
            {session?.result?.human_note && (
              <div className="bg-bone border border-graphite-muted/10 p-4 rounded-lg text-xs space-y-1">
                <span className="font-bold text-[10px] text-graphite font-mono uppercase tracking-wider">Your Feedback Note:</span>
                <p className="text-graphite font-body italic leading-relaxed">"{session.result.human_note}"</p>
              </div>
            )}
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
      <div className="fixed inset-0 bg-graphite/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-bone-light border-2 border-ochre/50 shadow-lg p-8 rounded-none relative">
          <div className="absolute top-6 left-6 reg-mark"></div>
          <div className="absolute top-6 right-6 reg-mark"></div>
          <div className="absolute bottom-6 left-6 reg-mark"></div>
          <div className="absolute bottom-6 right-6 reg-mark"></div>
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

  return null;
};
