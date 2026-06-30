import { getSessionMock, postResultMock } from './gatewayMock';

export interface A2uiDesign {
  schema_version: string;
  canvas: {
    preset: string; // 'square' | 'portrait' | 'story' | 'landscape'
    width: number;
    height: number;
  };
  layers: {
    background: {
      type: 'image' | 'color' | 'gradient';
      value: string;
      fit?: 'cover';
      blur?: number;
      opacity?: number;
    };
    overlay: Array<any>;
  };
  content?: {
    flyer_type: string;
    fields: Record<string, string>;
    style?: Record<string, any>;
  };
  meta?: {
    source_agent?: string;
    tenant?: string;
    intent?: string;
    [key: string]: any;
  };
}

export interface A2uiResult {
  state: 'approved_downloaded' | 'sent_back';
  final_design?: A2uiDesign;
  export?: {
    url: string;
    format: string;
    resolution: string;
  };
  human_note?: string;
}

export interface SessionEnvelope {
  session_id: string;
  state: string; // 'created' | 'posted' | 'in_review' | 'approved_downloaded' | 'sent_back' | 'expired'
  design: A2uiDesign | null;
  result: A2uiResult | null;
}

export class GatewayError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    super(body?.error || `Gateway error with status ${status}`);
    this.name = 'GatewayError';
    this.status = status;
    this.body = body;
  }
}

export function isMockEnabled(): boolean {
  const useMockEnv = import.meta.env.VITE_USE_GATEWAY_MOCK;
  const baseUrlEnv = import.meta.env.VITE_GATEWAY_BASE_URL;
  return useMockEnv === 'true' || !baseUrlEnv;
}

export const getBaseUrl = (): string => {
  return import.meta.env.VITE_GATEWAY_BASE_URL || 'http://localhost:3000';
};

export async function getSession(id: string): Promise<SessionEnvelope> {
  if (isMockEnabled()) {
    return getSessionMock(id);
  }

  const base = getBaseUrl();
  const url = `${base}/session/${id}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      let body;
      try {
        body = await response.json();
      } catch (e) {
        body = { error: 'unknown_error' };
      }
      throw new GatewayError(response.status, body);
    }

    return (await response.json()) as SessionEnvelope;
  } catch (error) {
    if (error instanceof GatewayError) {
      throw error;
    }
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }
}

export async function postResult(
  id: string,
  result: A2uiResult
): Promise<{ session_id: string; state: string }> {
  if (isMockEnabled()) {
    return postResultMock(id, result);
  }

  const base = getBaseUrl();
  const url = `${base}/session/${id}/result`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      let body;
      try {
        body = await response.json();
      } catch (e) {
        body = { error: 'unknown_error' };
      }
      throw new GatewayError(response.status, body);
    }

    return (await response.json()) as { session_id: string; state: string };
  } catch (error) {
    if (error instanceof GatewayError) {
      throw error;
    }
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }
}
