import { Design, Result } from './schema';
import fs from 'fs';
import path from 'path';

export type SessionState = 'created' | 'posted' | 'in_review' | 'approved_downloaded' | 'sent_back' | 'expired';

export interface Session {
  session_id: string;
  state: SessionState;
  design: Design | null;
  result: Result | null;
  expires_at: number;
  review_url: string;
}

export interface ISessionStore {
  createSession(session: Session): void;
  getSession(session_id: string): Session | undefined;
  updateSession(session_id: string, updates: Partial<Session>): void;
}

const DB_FILE = path.join(__dirname, '..', 'sessions.json');

export class FileSessionStore implements ISessionStore {
  private readDB(): Record<string, Session> {
    if (!fs.existsSync(DB_FILE)) {
      const seedData: Record<string, Session> = {
        "test-1234": {
          "session_id": "test-1234",
          "state": "posted",
          "design": {
            "schema_version": "0.1.2",
            "canvas": {
              "preset": "square",
              "width": 1080,
              "height": 1080
            },
            "content": {
              "flyer_type": "event",
              "fields": {
                "title": "Sunset Yoga Retreat",
                "date": "Saturday, October 14",
                "startTime": "6:00 PM",
                "endTime": "10:00 PM",
                "location": "Hawaii Beach Park",
                "description": "Join us for a relaxing sunset yoga session with experienced coaches. Light snacks and beverages are included."
              }
            },
            "layers": {
              "background": {
                "type": "image",
                "value": "https://images.unsplash.com/photo-1506126613408-eca07ce68773",
                "fit": "cover"
              },
              "overlay": [
                {
                  "id": "image_logo",
                  "type": "image",
                  "value": "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300",
                  "x": 0.4,
                  "y": 0.75,
                  "w": 0.2,
                  "h": 0.15
                }
              ]
            },
            "meta": {
              "source_agent": "vayu",
              "tenant": "vayu",
              "intent": "sunset yoga flyer"
            }
          },
          "result": null,
          "expires_at": 2000000000000,
          "review_url": "http://localhost:5173/review/test-1234"
        }
      };
      this.writeDB(seedData);
      return seedData as Record<string, Session>;
    }
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading DB:', e);
      return {};
    }
  }

  private writeDB(data: Record<string, Session>): void {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  createSession(session: Session): void {
    const db = this.readDB();
    db[session.session_id] = session;
    this.writeDB(db);
  }

  getSession(session_id: string): Session | undefined {
    const db = this.readDB();
    return db[session_id];
  }

  updateSession(session_id: string, updates: Partial<Session>): void {
    const db = this.readDB();
    const session = db[session_id];
    if (session) {
      db[session_id] = { ...session, ...updates };
      this.writeDB(db);
    }
  }
}

// Export a singleton instance using the file-based store
export const store = new FileSessionStore();
