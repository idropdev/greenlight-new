# A2UI Contract: Vayu to Green Light Gateway

**Status:** v0.1.0 (draft, locked at kickoff)
**Co-owned by:** Isaac (gateway) + Carlos (Green Light)
**Rule:** This is the one rigid thing. Neither side changes it alone. Bump the version and note the change in the changelog below, agreed by both.

---

## What this is

The shared seam between the gateway and Green Light. An agent (Vayu first, any BYOA agent later) posts a two-layer design, a human reviews and tweaks it deterministically in Green Light, and the result returns to the agent. This doc defines the design schema, the session states, and the two integration points between Isaac's and Carlos's surfaces. Everything behind each side of this seam is that owner's call.

---

## 1. The design object

Posted by the agent, rendered by Green Light, edited by the human, returned to the agent.

```json
{
  "schema_version": "0.1.0",
  "canvas": {
    "preset": "square",
    "width": 1000,
    "height": 1000
  },
  "layers": {
    "background": {
      "type": "image",
      "value": "https://...",
      "fit": "cover"
    },
    "overlay": [
      {
        "id": "el_1",
        "type": "text",
        "content": "Hawaii Yoga",
        "x": 0.5,
        "y": 0.2,
        "w": 0.8,
        "font": "Inter",
        "size": 64,
        "color": "#000000",
        "align": "center",
        "opacity": 1.0
      }
    ]
  },
  "meta": {
    "source_agent": "vayu",
    "tenant": "vayu",
    "intent": "event flyer"
  }
}
```

Notes:
- `background.type` is one of `image | color | gradient`. For `color`, `value` is a hex string.
- `overlay` coordinates (`x`, `y`, `w`) are normalized 0 to 1, relative to the canvas. This is deliberate: it keeps placement stable across resolution presets and export sizes, so a resize never breaks a layout.
- `canvas.preset` is one of `square | portrait | story | custom`. Width and height are the working proportion, not the final export resolution.

## 2. Session lifecycle

```
created -> posted -> in_review -> { approved_downloaded | sent_back }
```

Terminal states: `approved_downloaded`, `sent_back`, `expired`.

- `created`: gateway issued a session and review URL. No design yet.
- `posted`: agent has posted a design.
- `in_review`: human has opened the review URL in Green Light.
- `approved_downloaded`: human exported/downloaded. Terminal.
- `sent_back`: human returned the edited design to the agent. Terminal.
- `expired`: session timed out before a terminal action. Terminal.

## 3. The result object

Returned to the agent when the human acts.

```json
{
  "state": "sent_back",
  "final_design": { "...": "same schema, with human edits" },
  "export": {
    "url": "https://...",
    "format": "png",
    "resolution": "1080x1080"
  },
  "human_note": "made the title black, bumped the size"
}
```

`export` is present when the human downloaded. `final_design` is present when the human sent it back. Both may be present.

## 4. Integration points (the only two places the surfaces touch)

The gateway is the source of truth for session state. Green Light is a client of it.

1. **Green Light reads the design.** When the review URL opens with a session id, Green Light calls the gateway: `GET /session/:id` to fetch the current design and state.
2. **Green Light writes the result.** On human action (download or send back), Green Light calls the gateway: `POST /session/:id/result` with the result object above, which transitions the session to its terminal state.

Everything else (how the agent talks to the gateway, how Green Light renders and edits) is internal to each owner.

---

## Changelog

- **0.1.0** — initial draft. Lock at kickoff once Isaac and Carlos agree.
