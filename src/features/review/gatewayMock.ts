import type { SessionEnvelope, A2uiDesign, A2uiResult } from './gatewayClient';
import { GatewayError } from './gatewayClient';

// Helper to create the default seed design
export const sampleA2uiDesign: A2uiDesign = {
  schema_version: '0.1.2',
  canvas: {
    preset: 'square',
    width: 1080,
    height: 1080,
  },
  content: {
    flyer_type: 'event',
    fields: {
      title: 'Sunset Yoga Retreat',
      date: 'Saturday, October 14',
      startTime: '6:00 PM',
      endTime: '10:00 PM',
      location: 'Hawaii Beach Park',
      description: 'Join us for a relaxing sunset yoga session with experienced coaches. Light snacks and beverages are included.'
    }
  },
  layers: {
    background: {
      type: 'image',
      value: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
      fit: 'cover',
    },
    overlay: [
      {
        id: 'image_logo',
        type: 'image',
        value: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300',
        x: 0.4,
        y: 0.75,
        w: 0.2,
        h: 0.15,
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
