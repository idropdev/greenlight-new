import { v4 as uuidv4 } from 'uuid';
import { store, Session } from './store';
import { Design, Result } from './schema';
import { Telemetry } from './telemetry';

const GREENLIGHT_BASE_URL = process.env.GREENLIGHT_BASE_URL || 'http://localhost:5173';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class StateMachine {
  
  static createSession(tenant: string, agent_id?: string, intent?: string): Session {
    const session_id = uuidv4();
    const review_url = `${GREENLIGHT_BASE_URL}/review/${session_id}`;
    const expires_at = Date.now() + SESSION_TTL_MS;

    const session: Session = {
      session_id,
      state: 'created',
      design: null,
      result: null,
      expires_at,
      review_url,
    };

    store.createSession(session);
    return session;
  }

  static postDesign(session_id: string, design: Design): { ok: boolean; state?: string; error?: string } {
    const session = store.getSession(session_id);
    
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (this.isTerminal(session.state) || session.state === 'expired') {
      return { ok: false, error: 'session_closed', state: session.state };
    }
    if (session.expires_at < Date.now()) {
      store.updateSession(session_id, { state: 'expired' });
      return { ok: false, error: 'expired' };
    }

    Telemetry.logFeatureGap(design, session_id);

    store.updateSession(session_id, {
      design,
      state: 'posted',
    });

    return { ok: true, state: 'posted' };
  }

  static transitionToInReview(session_id: string): void {
    const session = store.getSession(session_id);
    if (session && session.state === 'posted') {
      store.updateSession(session_id, { state: 'in_review' });
    }
  }

  static submitResult(session_id: string, result: Result): { ok: boolean; state?: string; error?: string } {
    const session = store.getSession(session_id);
    
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (this.isTerminal(session.state) || session.state === 'expired') {
      return { ok: false, error: 'session_closed', state: session.state };
    }
    if (session.expires_at < Date.now()) {
      store.updateSession(session_id, { state: 'expired' });
      return { ok: false, error: 'expired', state: 'expired' };
    }

    const newState = result.state; // 'sent_back' | 'approved_downloaded'
    
    store.updateSession(session_id, {
      result,
      state: newState,
    });

    return { ok: true, state: newState };
  }

  private static isTerminal(state: string): boolean {
    return ['approved_downloaded', 'sent_back', 'expired'].includes(state);
  }
}
