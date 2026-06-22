import type { SessionEnvelope, A2uiDesign, A2uiResult } from './gatewayClient';
import { GatewayError } from './gatewayClient';

// Helper to create the default seed design
export const sampleA2uiDesign: A2uiDesign = {
  schema_version: '0.1.1',
  canvas: {
    preset: 'square',
    width: 1080,
    height: 1080,
  },
  layers: {
    background: {
      type: 'color',
      value: '#0B6E4F',
    },
    overlay: [
      {
        id: 'text_1',
        type: 'text',
        content: 'Hawaii Yoga',
        x: 0.1,
        y: 0.2,
        w: 0.8,
        font: 'Space Grotesk',
        size: 64,
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'text_2',
        type: 'text',
        content: 'Join us for a relaxing sunset yoga session',
        x: 0.15,
        y: 0.45,
        w: 0.7,
        font: 'Inter',
        size: 32,
        color: '#F2EEE3',
        align: 'center',
      },
      {
        id: 'image_1',
        type: 'image',
        value: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300',
        x: 0.35,
        y: 0.6,
        w: 0.3,
        h: 0.3,
      },
    ],
  },
  meta: {
    source_agent: 'vayu',
    tenant: 'vayu',
    intent: 'sunset yoga flyer',
  },
};

// In-memory mock database
const mockSessions: Record<string, { state: string; design: A2uiDesign | null; result: A2uiResult | null }> = {
  'test-1234': {
    state: 'posted',
    design: sampleA2uiDesign,
    result: null,
  },
  'mock-posted': {
    state: 'posted',
    design: sampleA2uiDesign,
    result: null,
  },
  'mock-created': {
    state: 'created',
    design: null,
    result: null,
  },
  'mock-in-review': {
    state: 'in_review',
    design: sampleA2uiDesign,
    result: null,
  },
};

export async function getSessionMock(id: string): Promise<SessionEnvelope> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulate specific error routes
  if (id === 'mock-expired') {
    throw new GatewayError(410, { error: 'expired', state: 'expired' });
  }
  if (id === 'mock-closed' || id === 'mock-terminal') {
    throw new GatewayError(409, { error: 'session_closed', state: 'approved_downloaded' });
  }
  if (id === 'mock-404' || id === 'mock-notfound') {
    throw new GatewayError(404, { error: 'not_found' });
  }
  if (id === 'mock-network') {
    throw new Error('Failed to fetch (mock network error)');
  }
  if (id === 'mock-badrequest') {
    throw new GatewayError(400, { error: 'bad_request', detail: 'Invalid parameters (mock)' });
  }

  const session = mockSessions[id];
  if (!session) {
    throw new GatewayError(404, { error: 'not_found' });
  }

  // Mutate posted state to in_review on read
  if (session.state === 'posted') {
    session.state = 'in_review';
    console.log(`[Mock] Session ${id} transitioned from posted -> in_review`);
  }

  return {
    session_id: id,
    state: session.state,
    design: session.design,
    result: session.result,
  };
}

export async function postResultMock(
  id: string,
  result: A2uiResult
): Promise<{ session_id: string; state: string }> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (id === 'mock-expired') {
    throw new GatewayError(410, { error: 'expired', state: 'expired' });
  }
  if (id === 'mock-closed' || id === 'mock-terminal') {
    throw new GatewayError(409, { error: 'session_closed', state: 'approved_downloaded' });
  }
  if (id === 'mock-404' || id === 'mock-notfound') {
    throw new GatewayError(404, { error: 'not_found' });
  }
  if (id === 'mock-network') {
    throw new Error('Failed to post result (mock network error)');
  }

  const session = mockSessions[id];
  if (!session) {
    throw new GatewayError(404, { error: 'not_found' });
  }

  if (session.state === 'approved_downloaded' || session.state === 'sent_back') {
    throw new GatewayError(409, { error: 'session_closed', state: session.state });
  }

  // Update in-memory state
  session.state = result.state;
  session.result = result;

  console.log(`[Mock] Result posted for ${id}. New state: ${result.state}`);

  return {
    session_id: id,
    state: session.state,
  };
}
