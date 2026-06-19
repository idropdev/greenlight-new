# Gateway Change Log & Current State

## What Was Done

- Bootstrapped the Gateway project as an isolated Node.js and TypeScript application inside the `/gateway` directory. This ensures the backend work doesn't interfere with Carlos's root-level React app.
- Modeled the core domain using Zod schemas based precisely on the `a2ui-contract.md` (version 0.1.1).
- Built a file-backed JSON session store (`sessions.json`) to manage state securely and share data across the separate HTTP and MCP processes. The store automatically auto-seeds the mock `test-1234` session on startup if the JSON database file is missing.
- Built a state machine to handle the required session transitions: `created -> posted -> in_review -> approved_downloaded | sent_back | expired`.
- Implemented an Express HTTP API to serve Green Light's human-review endpoints.
- Implemented the Model Context Protocol (MCP) Server for the Vayu agent to interact with the Gateway.
- Set up a telemetry placeholder to log agent feature gaps.
- Set up a GitHub Actions workflow to run typechecks on the `/gateway` codebase on pushes and pull requests.
- **Successfully tested the MCP Server** locally via the official MCP Inspector. Verified that `create_session`, `post_design` (with schema validation), and `get_state` all work flawlessly.
- **Successfully tested the HTTP API** using `curl` to verify `GET` and `POST` routes properly read from and update the shared `sessions.json` database.

## Files Added and Their Purposes

- `package.json` & `tsconfig.json`: Node.js and TypeScript configurations for the standalone Gateway.
- `src/schema.ts`: Zod validation schemas enforcing the A2UI design contract. Ensures Vayu's payloads strictly match what Green Light expects.
- `src/store.ts`: Interface-driven, file-backed JSON store for session persistence. Auto-seeds a v0.1.1 mock session (`test-1234`) on first run to ensure developers can test without manual database setup. Allows both the HTTP and MCP processes to share state seamlessly.
- `src/state-machine.ts`: Logic to safely transition a session through its lifecycle. Handles expiry checks and triggers telemetry hooks.
- `src/telemetry.ts`: A placeholder object for future PostHog event instrumentation (`logFeatureGap`) without coupling the logic to the core app.
- `src/api-server.ts`: Express application listening on port `3000`. Exposes `GET /session/:id` and `POST /session/:id/result`. CORS is configured for `http://localhost:5173`.
- `src/mcp-server.ts`: MCP server operating over stdio, exposing three tools to Vayu: `create_session`, `post_design`, and `get_state`.
- `README.md`: Basic project overview, setup steps, and `curl` testing scripts for local simulation.
- `.github/workflows/gateway.yml`: CI workflow file checking TypeScript compiler health on pull requests and pushes to `gateway/`.

## Current Commands

Run these from within the `gateway` directory:

- `npm install`: Install project dependencies.
- `npm run dev:api`: Runs the HTTP API server locally on `http://localhost:3000`.
- `npm run dev:mcp`: Runs the MCP server over stdio (to be attached to Vayu).
- `npm run typecheck`: Validates TypeScript without compiling.

## Next Steps & Open Questions

- [ ] **[Open Question] Auth and Session Approach (Isaac + Carlos)**: Research whether the session sharing flow should remain a UUID-based bearer link (like Canva share links, which fits V1 well), or if we need a signed JWT token or OAuth solution for secure agent-to-human sharing.
- [ ] **Connect the Real Vayu Agent**: Add the configuration block (documented in `vayu-connection.md`) to the Vayu agent to verify it can call the tools autonomously.
- [ ] **Midweek Integration with Carlos**: Carlos needs to hook up his UI to call `http://localhost:3000/session/:id` and test the HTTP feedback loop.
- [ ] **Green Light Review Route**: Carlos needs to implement the `/review/:session_id` route in the Green Light React app so the generated URLs resolve to a real page.
- [ ] **PostHog Implementation**: Replace the placeholder in `src/telemetry.ts` with the real PostHog SDK once an API key is available.
- [ ] **Production Endpoints**: Update `GREENLIGHT_BASE_URL` and `GATEWAY_BASE_URL` environment variables with deployed URLs when moving past local testing.
