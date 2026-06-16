# Scope: Isaac — Vayu to Green Light Gateway

**Owner:** Isaac
**Pairs with:** Carlos (Green Light)
**Shared contract:** `a2ui-contract.md` (co-owned, the one rigid thing)
**Cadence:** joint kickoff to lock the schema, independent build, integration checkpoint midweek, demo Friday.

---

## Mission

Build the gateway: the connective tissue that lets an agent post a design into Green Light, hand it to a human for deterministic review, and get the finished artifact back. Vayu is the first and only agent in scope. The design should hold for any BYOA agent later, but do not build for that yet.

## Your surface

You own everything on the agent side of the seam:

- The **MCP server** that exposes Green Light to agents.
- The **session store** and the **state machine** (`created -> posted -> in_review -> approved_downloaded | sent_back | expired`).
- **Review URL issuance**: when an agent posts, you mint a session and a human-review link, same pattern as Chico dropping a link in Discord.
- **Returning the result** to the agent once the human acts.

The two places you touch Carlos's surface are defined in the contract: he reads a session from you (`GET /session/:id`) and writes the result to you (`POST /session/:id/result`). Serve those. Beyond that, your internals are yours.

## MCP tools to expose (names are a starting point, refine as you build)

- `create_session(tenant, agent_id, intent?)` returns `{ session_id, review_url, expires_at }`
- `post_design(session_id, design)` returns `{ ok, state }`
- `get_state(session_id)` returns `{ state, design, result? }`

Polling `get_state` is the MVP for the agent learning the human's decision. A webhook callback is a nice-to-have, not required for done.

## Definition of done (the week target)

Vayu posts a two-layer design through the MCP server, a human opens the review link, and the agent receives the final artifact back after the human downloads or sends it back. End to end, single tenant (Vayu only). State transitions are correct and observable.

Wire the **PostHog-for-agents** hook into the state machine so feature gaps get logged when an agent posts something Green Light can't yet handle. This is the instrumentation you flagged in the meeting; build it in from the start rather than bolting it on.

## Out of scope (do not build these yet)

- Multi-tenant per-client instances (Sandra / Sanding Grass). The design should not preclude it, but you are shipping Vayu only.
- BYOA support for other agents (Gemini, Grok, Claude Code).
- Unsplash or any image-source integration.
- Naming and domain decisions.

## Checkpoints

- **Kickoff (today):** with Carlos, lock the A2UI schema in the contract doc. Then stand up the MCP skeleton with stubbed tools so Carlos has something to call.
- **Midweek integration:** wire your gateway to Carlos's Green Light endpoint end to end. Both the work and the scope are open to revision here.
- **Friday:** demo the full loop.

## If you find a better way

This scope is the target, not the blueprint. If the contract should change, if there is a cleaner state model, or if something in Green Light or Vayu has already moved since this was written, raise it at kickoff or at the integration checkpoint. Do not quietly build around a stale assumption. The schema is the only thing you cannot change unilaterally, and even that is changeable with Carlos at the table.
