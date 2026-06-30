import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { store } from './store';
import { StateMachine } from './state-machine';
import { DesignSchema, ResultSchema } from './schema';
import { z } from 'zod';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from './mcp-server';

const app = express();
const transports = new Map<string, SSEServerTransport>();
const PORT = process.env.PORT || 3000;

app.use(cors({
  // CORS origin configuration for the React dev server / production frontend
  origin: [
    process.env.GREENLIGHT_BASE_URL || 'http://localhost:5173',
    'http://localhost:5173' // Always allow local testing
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use('/session', express.json());

app.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'bad_request', detail: error.message });
    return;
  }
  next(error);
});

// Helper to determine if session is expired
const checkExpired = (expires_at: number) => expires_at < Date.now();

const CreateSessionSchema = z.object({
  tenant: z.string().min(1),
  agent_id: z.string().optional(),
  intent: z.string().optional(),
});

app.post('/session', (req: Request, res: Response): void => {
  try {
    const { tenant, agent_id, intent } = CreateSessionSchema.parse(req.body);
    const session = StateMachine.createSession(tenant, agent_id, intent);

    res.status(200).json({
      session_id: session.session_id,
      review_url: session.review_url,
      expires_at: session.expires_at
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'bad_request', detail: error.errors });
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/session/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const session = store.getSession(id);

  if (!session) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  if (checkExpired(session.expires_at) && session.state !== 'expired' && !['approved_downloaded', 'sent_back'].includes(session.state)) {
    store.updateSession(id, { state: 'expired' });
    res.status(410).json({ error: 'expired', state: 'expired' });
    return;
  }

  // If the human opens it and it's posted, transition to in_review
  if (session.state === 'posted') {
    StateMachine.transitionToInReview(id);
    session.state = 'in_review'; // update local reference for response
  }

  res.status(200).json({
    session_id: session.session_id,
    state: session.state,
    design: session.design,
    result: session.result
  });
});

app.post('/session/:id/design', (req: Request, res: Response): void => {
  const { id } = req.params;

  try {
    const design = DesignSchema.parse(req.body);
    const out = StateMachine.postDesign(id, design);

    if (!out.ok) {
      if (out.error === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (out.error === 'expired') {
        res.status(410).json({ error: 'expired', state: 'expired' });
        return;
      }
      if (out.error === 'session_closed') {
        res.status(409).json({ error: 'session_closed', state: out.state });
        return;
      }
    }

    res.status(200).json({
      ok: true,
      state: 'posted'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'bad_request', detail: error.errors });
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/session/:id/result', (req: Request, res: Response): void => {
  const { id } = req.params;
  
  try {
    // Validate request body
    const resultPayload = ResultSchema.parse(req.body);
    
    // Submit result via state machine
    const out = StateMachine.submitResult(id, resultPayload);
    
    if (!out.ok) {
      if (out.error === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (out.error === 'session_closed') {
        res.status(409).json({ error: 'session_closed', state: out.state });
        return;
      }
      if (out.error === 'expired') {
        res.status(410).json({ error: 'expired', state: 'expired' });
        return;
      }
    }
    
    res.status(200).json({
      session_id: id,
      state: out.state
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'bad_request', detail: error.errors });
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/sse', async (req: Request, res: Response) => {
  const transport = new SSEServerTransport('/message', res);
  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);
  
  transports.set(transport.sessionId, transport);
  console.log(`[SSE] New agent connected, session id: ${transport.sessionId}`);
  
  res.on('close', () => {
    console.log(`[SSE] Agent connection closed, session id: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });
});

app.post('/message', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).send("Missing sessionId parameter");
    return;
  }
  
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }
  
  console.log(`[SSE] Received message for session ${sessionId}`);
  console.log(`[SSE] Body type: ${typeof req.body}, Is undefined: ${req.body === undefined}`);
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`Gateway API server running on port ${PORT}`);
});
