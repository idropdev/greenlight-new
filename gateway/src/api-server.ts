import express, { Request, Response } from 'express';
import cors from 'cors';
import { store } from './store';
import { StateMachine } from './state-machine';
import { ResultSchema } from './schema';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  // CORS origin configuration for the React dev server / production frontend
  origin: process.env.GREENLIGHT_BASE_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Helper to determine if session is expired
const checkExpired = (expires_at: number) => expires_at < Date.now();

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

app.listen(PORT, () => {
  console.log(`Gateway API server running on port ${PORT}`);
});
