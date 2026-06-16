# Claude Code Seed: Vayu to Green Light Gateway (Isaac's side)

Paste this into Claude Code at the root of the gateway repo. It scaffolds Isaac's surface only. Carlos's Green Light work stays in its own repo.

---

You are scaffolding the gateway that connects the Vayu agent to Green Light, a design tool acting as a human-in-the-loop review surface. Read `a2ui-contract.md` first if it is in the repo. It is the source of truth for the schema and is co-owned, so do not change it unilaterally.

Build the gateway as an MCP server plus a thin session API. Scope is Vayu only, single tenant. Do not build multi-tenant, BYOA, or image-source integrations.

Deliver:

1. An MCP server exposing three tools:
   - `create_session(tenant, agent_id, intent?)` returns `{ session_id, review_url, expires_at }`
   - `post_design(session_id, design)` returns `{ ok, state }`
   - `get_state(session_id)` returns `{ state, design, result? }`

2. A session store and a state machine with states: `created -> posted -> in_review -> approved_downloaded | sent_back | expired`. Keep the store swappable (in-memory for now, behind an interface).

3. Two HTTP endpoints for Green Light to call:
   - `GET /session/:id` returns the current design and state.
   - `POST /session/:id/result` accepts the result object from the contract and transitions to the terminal state.

4. The design object validated against the schema in the contract: a `canvas`, a two-layer `layers` block (background plus overlay), and `meta`. Overlay coordinates are normalized 0 to 1.

5. A PostHog hook in the state machine that logs an event whenever a posted design contains something not yet supported, so we capture agent-side feature gaps.

Constraints:
- Keep it lean. One service, clear module boundaries, swappable store.
- The review URL is how a human enters Green Light for a session, same pattern as a link drop.
- Polling `get_state` is how the agent learns the outcome. A webhook is optional, not required.
- Write a short README with the run command and a curl example that walks one session from create to result.

Stop after scaffolding and a working end-to-end happy path with a stubbed render. Do not build Carlos's Green Light side.
