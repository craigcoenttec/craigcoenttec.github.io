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
  to the static `scripts/languageDefinition.json`
- Loads the transaction's current agent/caller languages on startup
- Customer/Agent language selection with same-language validation, and language
  updates pushed via `PUT /transactions/{id}/languages`
- Translation profile matching via `/translation_engines`
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
