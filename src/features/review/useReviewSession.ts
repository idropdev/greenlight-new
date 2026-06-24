import { useState, useRef, useCallback, useEffect } from 'react';
import { getSession, postResult, GatewayError } from './gatewayClient';
import type { SessionEnvelope } from './gatewayClient';
import { trackEvent } from '../../lib/analytics';
import { ingestDesign } from './ingestDesign';
import { useFlyerStore } from '../flyer/flyerStore';
import { buildDesignFromState, buildResult } from './buildResult';

export function useReviewSession(sessionId: string | undefined) {
  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [session, setSession] = useState<SessionEnvelope | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reviewBgColor, setReviewBgColor] = useState<string | null>(null);

  const [humanNote, setHumanNote] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const handleSendBack = async () => {
    if (!sessionId || !session?.design) return;
    setIsPosting(true);
    setPostError(null);
    try {
      const state = useFlyerStore.getState();
      const finalDesign = buildDesignFromState(
        state,
        reviewBgColor,
        session.design.meta,
        session.design.layers?.overlay
      );
      const resultPayload = buildResult({
        stateLabel: 'sent_back',
        design: finalDesign,
        humanNote: humanNote.trim() || undefined,
      });

      const response = await postResult(sessionId, resultPayload);

      setSession((prev) =>
        prev ? { ...prev, state: response.state, result: resultPayload } : null
      );

      trackEvent('review_sent_back', { sessionId });
    } catch (err: unknown) {
      console.error('Error posting review result:', err);
      if (err instanceof GatewayError) {
        if (err.status === 409 || err.status === 404) {
          setError(err);
        } else {
          setPostError(err.message || 'Validation error. Please check your fields.');
        }
      } else {
        setPostError(err instanceof Error ? err.message : 'Connection error. Please try again.');
      }
      throw err;
    } finally {
      setIsPosting(false);
    }
  };

  const handleReviewExport = async (format: string, resolution: string) => {
    if (!sessionId || !session?.design) return;
    setIsPosting(true);
    setPostError(null);
    try {
      const state = useFlyerStore.getState();
      const finalDesign = buildDesignFromState(
        state,
        reviewBgColor,
        session.design.meta,
        session.design.layers?.overlay
      );
      const resultPayload = buildResult({
        stateLabel: 'approved_downloaded',
        design: finalDesign,
        exportInfo: { format, resolution },
      });

      const response = await postResult(sessionId, resultPayload);

      setSession((prev) =>
        prev ? { ...prev, state: response.state, result: resultPayload } : null
      );

      trackEvent('review_downloaded', { sessionId, format, resolution });
    } catch (err: unknown) {
      console.error('Error posting review result:', err);
      if (err instanceof GatewayError) {
        if (err.status === 409 || err.status === 404) {
          setError(err);
        } else {
          setPostError(err.message || 'Validation error. Please check your fields.');
        }
      } else {
        setPostError(err instanceof Error ? err.message : 'Connection error. Please try again.');
      }
      throw err;
    } finally {
      setIsPosting(false);
    }
  };

  const fetchedSessionId = useRef<string | null>(null);

  const loadSession = useCallback(async (isRetry = false) => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    if (!isRetry && fetchedSessionId.current === sessionId) {
      return;
    }

    fetchedSessionId.current = sessionId;
    setLoading(true);
    setError(null);

    try {
      const data = await getSession(sessionId);
      setSession(data);

      if (data.design && (data.state === 'posted' || data.state === 'in_review')) {
        const ingested = ingestDesign(data.design);

        ingested.gaps.forEach((gap) => {
          trackEvent('agent_feature_gap', {
            reason: gap.reason,
            preset: data.design?.canvas?.preset,
          });
        });

        useFlyerStore.setState({
          type: null,
          size: ingested.size,
          textNodes: ingested.textNodes,
          imageNodes: ingested.imageNodes,
          bgImageUrl: ingested.bgImageUrl,
          selectedNodeId: null,
          selectedNodeIds: [],
        });

        setReviewBgColor(ingested.bgColor);
      }

      trackEvent('review_opened', {
        state: data.state,
        preset: data.design?.canvas?.preset,
      });
    } catch (err: unknown) {
      console.error('Error fetching review session:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      const handle = setTimeout(() => {
        loadSession(false);
      }, 0);
      return () => clearTimeout(handle);
    }
  }, [sessionId, loadSession]);

  const handleRetry = () => {
    loadSession(true);
  };

  return {
    loading,
    session,
    error,
    reviewBgColor,
    isPosting,
    postError,
    humanNote,
    setHumanNote,
    handleSendBack,
    handleReviewExport,
    handleRetry,
  };
}
