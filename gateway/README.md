# Green Light Gateway (Isaac's Surface)

This is the gateway that connects the Vayu agent to Green Light.

## Setup

```bash
cd gateway
npm install
```

## Running the Gateway

The gateway consists of two services that should be run separately (since MCP uses stdio and the API uses HTTP):

1. **HTTP API Server** (for Carlos's Green Light app)
   ```bash
   npm run dev:api
   ```
   Runs on `http://localhost:3000` by default.

2. **MCP Server** (for Vayu)
   ```bash
   npm run dev:mcp
   ```
   Runs over standard input/output.

## Testing the HTTP API with curl

Since the MCP server acts over stdio, the easiest way to test the full loop locally without an agent is to simulate it.

1. **Create a session (simulate agent calling `create_session` via MCP)**
   Currently, creating a session is only exposed via MCP. But once you have a `session_id`, you can proceed.
   *(You can temporarily add a route or hardcode a session in `store.ts` if you want to test purely HTTP)*

2. **Read Session (simulate human opening Review URL)**
   ```bash
   curl http://localhost:3000/session/<SESSION_ID>
   ```

3. **Submit Result (simulate human clicking Download or Send Back)**
   ```bash
   curl -X POST http://localhost:3000/session/<SESSION_ID>/result \
     -H "Content-Type: application/json" \
     -d '{
       "state": "sent_back",
       "human_note": "changed the title to red",
       "final_design": {
         "schema_version": "0.1.1",
         "canvas": { "preset": "square", "width": 1080, "height": 1080 },
         "layers": {
           "background": { "type": "color", "value": "#ffffff" },
           "overlay": []
         },
         "meta": { "source_agent": "vayu", "tenant": "vayu", "intent": "event flyer" }
       }
     }'
   ```
