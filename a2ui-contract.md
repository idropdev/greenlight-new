# A2UI Contract: Vayu to Green Light Gateway

**Status:** v0.1.1 (draft — reconciled against Green Light repo schema; re-lock at integration checkpoint)
**Co-owned by:** Isaac (gateway) + Carlos (Green Light)
**Rule:** This is the one rigid thing. Neither side changes it alone. Bump the version and note the change in the changelog below, agreed by both.

> **v0.1.1 note (Carlos):** This revision reconciles the original draft (written from meeting
> notes, not the repo) against Green Light's actual data model — coordinate system, presets,
> overlay fields, and the image-overlay layer. Changes are marked in the changelog. Nothing here
> is final until Isaac and Carlos re-agree at the Wednesday integration checkpoint.

---

## What this is

The shared seam between the gateway and Green Light. An agent (Vayu first, any BYOA agent later) posts a two-layer design, a human reviews and tweaks it deterministically in Green Light, and the result returns to the agent. This doc defines the design schema, the session states, and the two integration points between Isaac's and Carlos's surfaces. Everything behind each side of this seam is that owner's call.

---

## 1. The design object

Posted by the agent, rendered by Green Light, edited by the human, returned to the agent.

```json
{
  "schema_version": "0.1.1",
  "canvas": {
    "preset": "square",
    "width": 1080,
    "height": 1080
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
        "x": 0.1,
        "y": 0.2,
        "w": 0.8,
        "font": "Inter",
        "size": 64,
        "color": "#ffffff",
        "align": "center"
      },
      {
        "id": "el_2",
        "type": "image",
        "value": "https://.../logo.png",
        "x": 0.05,
        "y": 0.05,
        "w": 0.2,
        "h": 0.2
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

### Canvas

- `canvas.preset` is one of `square | portrait | story | landscape`. These are the four presets Green Light renders. `width`/`height` are the working proportion in true pixels (always 1080-wide), **not** the final export resolution — resolution is chosen by the human in the export step.
  - `square` 1080×1080 · `portrait` 1080×1350 · `story` 1080×1920 · `landscape` 1080×566.
  - `custom` is **reserved, not supported in V1.** If an agent posts it, Green Light logs a feature gap (see §5) and falls back to `square`.

### Background

- `background.type` is one of `image | color | gradient`.
  - `image`: `value` is a URL. `fit` is `cover` (only mode supported in V1). Green Light renders the URL it is handed — it does **not** source images (no Unsplash on the human side); the agent side supplies the URL.
  - `color`: `value` is a hex string (e.g. `#0B6E4F`). **Supported in V1.**
  - `gradient`: **reserved, not rendered in V1.** If posted, Green Light logs a feature gap and falls back to a solid color (first stop, or black if unspecified).

### Overlay

`overlay` is an ordered array (array order = z-order, first = bottom). Each item is one of two types.

**Coordinates (both types):** `x`, `y`, `w` (and `h` for images) are normalized `0`–`1`, relative to the canvas. This is deliberate: it keeps placement stable across resolution presets and export sizes, so a resize never breaks a layout. **`x`/`y` is the TOP-LEFT corner of the element's box** (not the center). Green Light converts to true pixels on ingest (`px = norm * canvasDimension`) and back to normalized on send-back.

**`type: "text"`**

| field | meaning |
|---|---|
| `id` | stable element id (e.g. `el_1`). Round-trips unchanged. |
| `content` | the text string |
| `x`, `y` | top-left position, normalized |
| `w` | wrapping/box width, normalized |
| `font` | font family name |
| `size` | font size in true pixels (1080-space) |
| `color` | hex string |
| `align` | `left \| center \| right` |

> Legibility styling (drop shadow, highlight box) is **human-side only** and intentionally NOT
> in this schema. Agents post plain text; Green Light hydrates each text element with its default
> legibility treatment on ingest, and the human adjusts it in review. These properties are not
> required on the wire and are not expected back from the agent. Per-element `opacity` is likewise
> not part of V1 (Green Light does not yet render per-node opacity); it may be added in a later
> version if needed.

**`type: "image"`** (logos / overlay graphics — distinct from the background layer)

| field | meaning |
|---|---|
| `id` | stable element id |
| `value` | image URL |
| `x`, `y` | top-left position, normalized |
| `w`, `h` | width and height, normalized |

> Image overlays exist so that a logo or graphic — whether posted by the agent **or added by the
> human during review** — survives the round-trip. Without this type, a human-added logo would be
> silently dropped on send-back.

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
  "final_design": { "...": "same schema (v0.1.1), with human edits" },
  "export": {
    "url": "https://...",
    "format": "png",
    "resolution": "1080x1080"
  },
  "human_note": "made the title black, bumped the size"
}
```

`export` is present when the human downloaded. `final_design` is present when the human sent it back. Both may be present. `final_design` uses the **same schema as §1** — Green Light converts its internal pixel coordinates back to normalized, and omits the human-side-only legibility fields, so what goes back matches what can come in.

## 4. Integration points (the only two places the surfaces touch)

The gateway is the source of truth for session state. Green Light is a client of it.

1. **Green Light reads the design.** When the review URL opens with a session id, Green Light calls the gateway: `GET /session/:id` to fetch the current design and state.
2. **Green Light writes the result.** On human action (download or send back), Green Light calls the gateway: `POST /session/:id/result` with the result object above, which transitions the session to its terminal state.

Everything else (how the agent talks to the gateway, how Green Light renders and edits) is internal to each owner.

> **Open for Wednesday:** review-URL format (how the session id reaches Green Light — path param
> vs query string), and session identity without sign-in (session id as bearer capability for the
> Vayu-only V1; OAuth/BYOA deferred).

---

## Changelog

- **0.1.1** — reconciled against the Green Light repo schema (Carlos). Changes, all pending re-lock with Isaac:
  - `canvas.preset`: `custom` → replaced with `landscape` to match the four presets Green Light renders; `custom` kept as reserved/unsupported-in-V1.
  - Example canvas corrected `1000×1000` → `1080×1080` (Green Light's true-pixel space).
  - Coordinate anchor pinned: `x`/`y` is the **top-left** of the element box (was ambiguous).
  - Added `type: "image"` overlay items (`value`, `x`, `y`, `w`, `h`) so logos/graphics survive the round-trip, including human-added ones.
  - Removed per-element `opacity` from text overlay for V1 (Green Light does not render it yet); noted as possible future addition.
  - Documented that shadow/highlight legibility is human-side-only and hydrated with defaults on ingest — deliberately kept off the wire.
  - Background: clarified `color` ships in V1; `gradient` and `canvas.preset: custom` are reserved and logged as feature gaps (PostHog-for-agents) with defined fallbacks.
  - Clarified Green Light renders background URLs but does not source images (no Unsplash on the human side).
- **0.1.0** — initial draft. Lock at kickoff once Isaac and Carlos agree.