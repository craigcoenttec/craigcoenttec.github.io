# ADDI Translation Widget - NiCE CXone Edition

A standalone variation of the V2 ADDI widget with all Genesys Cloud behavior removed.
Supports only the transaction-ID-passed-in mode, with no Genesys Platform SDK and no
Genesys Spark components. Styled with plain HTML/CSS to match the NiCE CXone chat
experience for embedding in the CXone agent client.

## Usage

```
index.html?transactionId=<ADDI_TRANSACTION_ID>&bearer=<ADDI_BEARER_TOKEN>
```

### URL Parameters

| Parameter       | Required | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| `transactionId` | Yes      | The ADDI transaction ID                                  |
| `bearer`        | Yes*     | ADDI bearer token (sent as `Authorization: Bearer ...`)  |
| `addi_host`     | No       | Override the default ADDI API host                       |

*Required if the ADDI environment enforces authentication.

All parameters are persisted to session storage, so the page survives a refresh
without needing the query string again.

## Features (parity with V2 standalone mode)

- Dynamic language loading from the ADDI `/language_maps` endpoint, with fallback
  to the static `scripts/languageDefinition.json`. The catalog is a starting
  point, not the whole list: ADDI translates pairs that `/language_maps` does
  not advertise, so any language seen on the transaction or on the live
  WebSocket is added to the dropdowns automatically.
- Languages are keyed by ADDI dialect code (`EN-US`, `JA-JP`), the one
  identifier shared by the catalog, the transaction, and the live events
- Loads the transaction's current agent/caller languages on startup, reading
  the `agent`/`caller` dialect codes. The `agent_id`/`caller_id` UUIDs are a
  separate namespace from `/language_maps` IDs and cannot be resolved to a
  language through any available endpoint, so they are only a last resort.
- Message bubbles take their languages and flags from each event's own
  `source`/`target` rather than from the dropdowns, so they stay correct
  regardless of what is selected
- Customer/Agent language selection with same-language validation, and language
  updates pushed via `PUT /transactions/{id}/languages`.
  **Known limitation:** the Update button does not currently take effect. The
  endpoint only honors the `agent_id`/`caller_id` UUID namespace, returns `200`
  while silently ignoring IDs it does not recognize, and rejects a body of
  `agent`/`caller` dialect codes with `424`. There is no endpoint that maps a
  dialect code to the UUID the write path wants, so this needs an ADDI-side
  change. Language entries carry the `/language_maps` ID as `mapId` ready for
  that fix. Display and live translation are unaffected.
- Translation profile matching via `/translation_engines` — **diagnostic only**.
  The profiles appear in the debug panel and are not used to translate: ADDI
  translates server-side (live events arrive already translated) and `/speak`
  carries no profile. A missing profile does not mean translation is down.
- Live transcription/translation via the ADDI WebSocket
  (`/live/{id}/ws?bearer=...`) with auto-reconnect
- Dual-text message bubbles showing original and translated text with flag emoji
- TTS message sending to the caller via `POST /transactions/{id}/speak`
  (Enter sends, Shift+Enter adds a newline)
- Connection status indicator and collapsible debug panel

## Differences from V2

- No Genesys Cloud OAuth, conversation loading, message subscription, canned
  responses, or Spark web components
- Flags rendered as emoji instead of `gux-flag-icon-beta`
- NiCE CXone-inspired styling: blue agent bubbles (right), gray contact bubbles
  (left), rounded composer input, Open Sans typography

## File Structure

```
NiCE/
├── index.html                       # Entry point (no external component libraries)
├── styles/main.css                  # CXone-inspired styling
└── scripts/
    ├── config.js                    # ADDI-only configuration
    ├── utils.js                     # Helpers (message objects, flag emoji, etc.)
    ├── api.js                       # ADDI REST API client
    ├── ui.js                        # Plain-DOM chat UI
    ├── websocket.js                 # ADDI transcription WebSocket
    ├── app.js                       # Application orchestration
    └── languageDefinition.json      # Static language fallback
```
