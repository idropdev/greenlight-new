# Gateway Testing & Verification Results

**Date:** June 19, 2026
**Component:** Green Light Gateway (Isaac's Surface)

## Overview
This document records the testing of the Gateway's MCP Server and HTTP API. Since the MCP server runs over `stdio` instead of HTTP, we utilized the official Model Context Protocol (MCP) Inspector to manually invoke the tools exactly as the Vayu agent would. The HTTP API was tested using `curl` to simulate the React UI client.

All payloads and outputs are verified against the **v0.1.1** A2UI contract.

## Test Environment Setup
- **Tool:** `@modelcontextprotocol/inspector` (v0.22.0)
- **Execution Command:** `npx tsx src/mcp-server.ts`
- **Result:** The inspector successfully connected to the stdio stream. The server successfully initialized and broadcasted: `Gateway MCP Server running on stdio`.

---

## Test 1: `create_session` (MCP)

**Objective:** Verify the gateway can mint a new session and generate a valid human review URL pointing to Carlos's Green Light React app.

**Input Payload:**
```json
{
  "tenant": "vayu",
  "agent_id": "test-agent",
  "intent": "event flyer"
}
```

**Output Result (Success):**
```json
{
  "session_id": "d8d34abf-1d1e-41de-93fe-f568bd2a5044",
  "review_url": "http://localhost:5173/review/d8d34abf-1d1e-41de-93fe-f568bd2a5044",
  "expires_at": 1781940381246
}
```

**Verification:**
- A unique UUID was generated.
- The `review_url` correctly targeted `GREENLIGHT_BASE_URL` (`http://localhost:5173`) with the dynamic path variable.
- The session was successfully saved into the JSON store (`sessions.json`) with the state `"created"`.

---

## Test 2: `post_design` (MCP)

**Objective:** Verify that the gateway correctly parses and validates a submitted A2UI design object against the Zod schema (`v0.1.1`), including text and image overlay items and standard `1080×1080` canvas settings.

**Input Payload:**
```json
{
  "session_id": "d8d34abf-1d1e-41de-93fe-f568bd2a5044",
  "design": {
    "schema_version": "0.1.1",
    "canvas": {
      "preset": "square",
      "width": 1080,
      "height": 1080
    },
    "layers": {
      "background": {
        "type": "image",
        "value": "https://images.unsplash.com/photo-1506126613408-eca07ce68773",
        "fit": "cover"
      },
      "overlay": [
        {
          "id": "el_1",
          "type": "text",
          "content": "Hawaii Yoga Retreat",
          "x": 0.1,
          "y": 0.25,
          "w": 0.8,
          "font": "Inter",
          "size": 64,
          "color": "#ffffff",
          "align": "center"
        },
        {
          "id": "el_2",
          "type": "image",
          "value": "https://greenlight.app/logo.png",
          "x": 0.4,
          "y": 0.75,
          "w": 0.2,
          "h": 0.1
        }
      ]
    },
    "meta": {
      "source_agent": "vayu",
      "tenant": "vayu",
      "intent": "event flyer"
    }
  }
}
```

**Output Result (Success):**
```json
{
  "ok": true,
  "state": "posted"
}
```

**Verification:**
- The JSON object passed Zod's strict union-based overlay schema validation check.
- The `state-machine.ts` verified that the session existed and hadn't expired.
- The session was successfully updated in the file-backed store with the submitted design, and the state was transitioned to `"posted"`.

---

## Test 3: `get_state` (MCP)

**Objective:** Verify that the gateway correctly returns the updated session state and the full design object so the agent can poll for the human's decision.

**Input Payload:**
```json
{
  "session_id": "d8d34abf-1d1e-41de-93fe-f568bd2a5044"
}
```

**Output Result (Success):**
```json
{
  "state": "posted",
  "design": {
    "schema_version": "0.1.1",
    "canvas": {
      "preset": "square",
      "width": 1080,
      "height": 1080
    },
    "layers": {
      "background": {
        "type": "image",
        "value": "https://images.unsplash.com/photo-1506126613408-eca07ce68773",
        "fit": "cover"
      },
      "overlay": [
        {
          "id": "el_1",
          "type": "text",
          "content": "Hawaii Yoga Retreat",
          "x": 0.1,
          "y": 0.25,
          "w": 0.8,
          "font": "Inter",
          "size": 64,
          "color": "#ffffff",
          "align": "center"
        },
        {
          "id": "el_2",
          "type": "image",
          "value": "https://greenlight.app/logo.png",
          "x": 0.4,
          "y": 0.75,
          "w": 0.2,
          "h": 0.1
        }
      ]
    },
    "meta": {
      "source_agent": "vayu",
      "tenant": "vayu",
      "intent": "event flyer"
    }
  },
  "result": null
}
```

**Verification:**
- The correct state `"posted"` was returned.
- The `design` object matches exactly what was posted in Test 2.
- The `result` remains `null` since no human has completed the review in Green Light yet.

---

## Test 4: HTTP API `GET /session/:id`

**Objective:** Verify that Carlos's React app can successfully read the session state and fetch the design object via standard HTTP.

**Input Command:**
```bash
curl -s http://localhost:3000/session/d8d34abf-1d1e-41de-93fe-f568bd2a5044
```

**Output Result (Success):**
```json
{
  "session_id": "d8d34abf-1d1e-41de-93fe-f568bd2a5044",
  "state": "in_review",
  "design": {
    "schema_version": "0.1.1",
    "canvas": {
      "preset": "square",
      "width": 1080,
      "height": 1080
    },
    "layers": {
      "background": {
        "type": "image",
        "value": "https://images.unsplash.com/photo-1506126613408-eca07ce68773",
        "fit": "cover"
      },
      "overlay": [
        {
          "id": "el_1",
          "type": "text",
          "content": "Hawaii Yoga Retreat",
          "x": 0.1,
          "y": 0.25,
          "w": 0.8,
          "font": "Inter",
          "size": 64,
          "color": "#ffffff",
          "align": "center"
        },
        {
          "id": "el_2",
          "type": "image",
          "value": "https://greenlight.app/logo.png",
          "x": 0.4,
          "y": 0.75,
          "w": 0.2,
          "h": 0.1
        }
      ]
    },
    "meta": {
      "source_agent": "vayu",
      "tenant": "vayu",
      "intent": "event flyer"
    }
  },
  "result": null
}
```

**Verification:**
- The HTTP server successfully read the exact session data from the file-backed `sessions.json` database.
- Accessing the endpoint successfully transitioned the state from `"posted"` to `"in_review"`, as required by the state machine lifecycle rules.

---

## Test 5: HTTP API `POST /session/:id/result`

**Objective:** Verify that Carlos's React app can successfully submit a final decision payload, validate it against the Zod schema, and transition the session to its terminal state.

**Input Command:**
```bash
curl -s -X POST http://localhost:3000/session/d8d34abf-1d1e-41de-93fe-f568bd2a5044/result \
  -H "Content-Type: application/json" \
  -d '{
    "state": "sent_back",
    "human_note": "looks awesome, Carlos approved",
    "final_design": {
      "schema_version": "0.1.1",
      "canvas": { "preset": "square", "width": 1080, "height": 1080 },
      "layers": {
        "background": { "type": "image", "value": "https://images.unsplash.com/photo-1506126613408-eca07ce68773", "fit": "cover" },
        "overlay": [
          {
            "id": "el_1",
            "type": "text",
            "content": "Hawaii Yoga Retreat (Edited)",
            "x": 0.1,
            "y": 0.25,
            "w": 0.8,
            "font": "Inter",
            "size": 72,
            "color": "#ff0000",
            "align": "center"
          },
          {
            "id": "el_2",
            "type": "image",
            "value": "https://greenlight.app/logo.png",
            "x": 0.4,
            "y": 0.75,
            "w": 0.2,
            "h": 0.1
          }
        ]
      },
      "meta": { "source_agent": "vayu", "tenant": "vayu", "intent": "event flyer" }
    }
  }'
```

**Output Result (Success):**
```json
{
  "session_id": "d8d34abf-1d1e-41de-93fe-f568bd2a5044",
  "state": "sent_back"
}
```

**Verification:**
- The payload passed schema validation, handling the updated union of overlay types perfectly.
- The `state` was successfully transitioned to the terminal `"sent_back"` state.
- Reading the state now returns the submitted result.

---

## Conclusion
The Gateway loop works flawlessly. Both the MCP process and the HTTP Express API have been verified end-to-end against the updated **v0.1.1** contract details.
