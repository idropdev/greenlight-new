# A2UI Contract: Vayu to Green Light Gateway

**Status:** v0.1.3 (locked)
**Co-owned by:** Isaac (gateway) + Carlos (Green Light)
**Rule:** This is the one rigid thing. Neither side changes it alone. Bump the version and note the change in the changelog below, agreed by both.

> **v0.1.3 note (Carlos + Isaac):** Added optional agent control of background styling (blur, opacity) and field-specific text styling (fontFamily, shadow, highlight) with default fallbacks.

---

## What this is

The shared seam between the gateway and Green Light. An agent (Vayu first, any BYOA agent later) posts a two-layer design, a human reviews and tweaks it deterministically in Green Light, and the result returns to the agent. This doc defines the design schema, the session states, and the two integration points between Isaac's and Carlos's surfaces. Everything behind each side of this seam is that owner's call.

---

## 1. The design object

Posted by the agent, rendered by Green Light, edited by the human, returned to the agent.

```json
{
  "schema_version": "0.1.3",
  "canvas": {
    "preset": "square",
    "width": 1080,
    "height": 1080
  },
  "content": {
    "flyer_type": "event",
    "fields": {
      "title": "Hawaii Yoga",
      "date": "Saturday, October 14"
    },
    "style": {
      "title": {
        "fontFamily": "Anton",
        "shadowEnabled": true,
        "shadowBlur": 10,
        "shadowOpacity": 0.8
      }
    }
  },
  "layers": {
    "background": {
      "type": "image",
      "value": "https://...",
      "fit": "cover",
      "blur": 5,
      "opacity": 40
    },
    "overlay": [
      {
        "id": "image_logo",
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
- `background.blur`: optional number `0..20` (px), default 0. Out-of-range values will be clamped.
- `background.opacity`: optional number `0..100` (50 = true image, 100 = black), default 50. Out-of-range values will be clamped.

### Content Style (optional)

`content.style` is an optional object keyed by field name (e.g., `title`, `businessName`, `date`). Each field's style may contain the following optional properties:

| property | type | meaning | default |
|---|---|---|---|
| `fontFamily` | string | Bundled font name (e.g. `Inter`, `Montserrat`, `Playfair Display`, `Lora`, `Outfit`, `Syne`, `Anton`, `Righteous`, `JetBrains Mono`, `Cinzel`) | App default (`Inter`) |
| `shadowEnabled` | boolean | Enable drop shadow legibility treatment | `true` |
| `shadowColor` | string | Hex color of shadow | `#000000` |
| `shadowBlur` | number | Shadow blur radius | `6` |
| `shadowOpacity` | number | Shadow opacity (`0..1`) | `0.6` |
| `highlightEnabled` | boolean | Enable highlight box legibility treatment | `false` |
| `highlightColor` | string | Hex color of highlight box | `#000000` |
| `highlightOpacity` | number | Highlight box opacity (`0..1`) | `0.5` |

Omission of fields or styles defaults to the app defaults listed above.

### Overlay

`overlay` is an ordered array (array order = z-order, first = bottom). Each item is one of two types.

**Coordinates (both types):** `x`, `y`, `w` (and `h` for images) are normalized `0`–`1`, relative to the canvas. This is deliberate: it keeps placement stable across resolution presets and export sizes, so a resize never breaks a layout. **`x`/`y` is the TOP-LEFT corner of the element's box** (not the center). Green Light converts to true pixels on ingest (`px = norm * canvasDimension`) and back to normalized on send-back.

**`type: "text"`** (Legacy overlay path only. For modern/fields path, text content and options are driven by the `content` block.)

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

**`type: "image"`** (logos / overlay graphics — distinct from the background layer)

| field | meaning |
|---|---|
| `id` | stable element id |
| `value` | image URL |
| `x`, `y` | top-left position, normalized |
| `w`, `h` | width and height, normalized |

---

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
  "final_design": { "...": "same schema (v0.1.3), with human edits" },
  "export": {
    "url": "https://...",
    "format": "png",
    "resolution": "1080x1080"
  },
  "human_note": "made the title black, bumped the size"
}
```

`export` is present when the human downloaded. `final_design` is present when the human sent it back. Both may be present. `final_design` uses the **same schema as §1** — Green Light converts its internal pixel coordinates back to normalized, and preserves styling choices, so what goes back matches what can come in.

## 4. Integration points (the only two places the surfaces touch)

The gateway is the source of truth for session state. Green Light is a client of it.

1. **Green Light reads the design.** When the review URL opens with a session id, Green Light calls the gateway: `GET /session/:id` to fetch the current design and state.
2. **Green Light writes the result.** On human action (download or send back), Green Light calls the gateway: `POST /session/:id/result` with the result object above, which transitions the session to its terminal state.

Everything else (how the agent talks to the gateway, how Green Light renders and edits) is internal to each owner.

---

## Changelog

- **0.1.3** — Added optional background styling (`blur`, `opacity`) and field-specific text styling (`fontFamily`, `shadowEnabled`, `shadowColor`, `shadowBlur`, `shadowOpacity`, `highlightEnabled`, `highlightColor`, `highlightOpacity`). All are optional, falling back to app defaults. Out of range styling parameters are clamped, not rejected. Added version `0.1.3` to fields-based designs.
- **0.1.2** — Added the Fields Schema (`schema_version: '0.1.2'`) to support structured content input blocks (flyer_type and field dictionary mapping).
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