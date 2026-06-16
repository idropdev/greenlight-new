# Scope: Carlos — Green Light as the HITL Review Surface

**Owner:** Carlos
**Pairs with:** Isaac (gateway)
**Shared contract:** `a2ui-contract.md` (co-owned, the one rigid thing)
**Cadence:** joint kickoff to lock the schema, independent build, integration checkpoint midweek, demo Friday.

---

## Mission

Turn Green Light into the human-in-the-loop surface for agent work. An agent posts a two-layer design through Isaac's gateway, and Green Light is where a human opens it, tweaks it deterministically, and either downloads it or sends it back to the agent. This is the V3 agentic step, built directly on top of the V1 you already have.

## Your surface

You own everything on the human side of the seam:

- **Rendering a posted design** at the review URL from the A2UI schema: background layer plus text/overlay layer.
- The **deterministic edit experience**: the human adjusting font, color, opacity, position, the controls you have been refining for mobile.
- **Export / download** and the **send-back-to-agent** action. These two buttons are what transition the session to its terminal state.

The two places you touch Isaac's surface are in the contract: you read the design from the gateway (`GET /session/:id`) when the review URL opens, and you write the result back (`POST /session/:id/result`) when the human downloads or sends back. Everything else (your canvas, your control panel, your rendering) stays yours.

## Definition of done (the week target)

A human opens the review link, sees the agent's design rendered correctly, makes deterministic edits, and either downloads it or sends it back. On either action, Green Light posts the result to the gateway and the session reaches its terminal state. End to end, single tenant (Vayu).

## Build on what is already in flight

The mobile and editing work from the last push feeds straight into this: the compact widget overlay (font, color, opacity), the float-above-keyboard fix, and the export popup with resolution presets are exactly the deterministic controls the human needs in review mode. Land the V1 items already pending (font shuffle, resolution presets on export, social format icons) as they fit, but the gateway loop is the priority for the week.

## Out of scope (do not build these yet)

- Multi-tenant per-client instances (Sandra / Sanding Grass).
- Unsplash or any image-source integration.
- Naming and domain decisions.
- Native AI generation inside the app (that was V2, which you are skipping).

## Checkpoints

- **Kickoff (today):** with Isaac, lock the A2UI schema in the contract doc. Then expose a Green Light endpoint that accepts the schema and renders a design, so Isaac has a target to post to.
- **Midweek integration:** wire Green Light to Isaac's gateway end to end. Both the work and the scope are open to revision here.
- **Friday:** demo the full loop.

## If you find a better way

This scope is the target, not the blueprint. If the schema needs a field it does not have, if the render surface wants the data shaped differently, or if something has already moved, raise it at kickoff or at the integration checkpoint rather than building around it. The schema is the only thing you cannot change on your own, and it is changeable with Isaac at the table.
