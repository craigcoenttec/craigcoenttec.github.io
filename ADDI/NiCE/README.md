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
- Languages are keyed by ADDI dialect code (`EN-US`, `JA-JP`), the one
  identifier shared by the catalog, the transaction, and the live events
- Dropdowns are grouped by `/translation_pairs` into combinations ADDI is
  configured to translate and combinations it is not. Selecting one side
  re-groups the other. Grouping rather than filtering is deliberate — see
  *Tenant scoping* below.
- Loads the transaction's current agent/caller languages on startup, reading
  the `agent`/`caller` dialect codes, with `agent_id`/`caller_id` as a
  fallback. Both resolve: the `*_id` fields are `/language_maps` IDs.
- Message bubbles take their languages and flags from each event's own
  `source`/`target` rather than from the dropdowns, so they stay correct
  regardless of what is selected
- Customer/Agent language selection with same-language validation, and language
  updates pushed via `PUT /transactions/{id}/languages`. The request sends
  `/language_maps` IDs (carried on each entry as `mapId`), not dialect codes —
  the endpoint rejects codes with `424`. A language absent from the catalog has
  no `mapId`, and Update reports that instead of sending a request that cannot
  succeed.
- Translation profile matching via `/translation_engines` — **diagnostic only**.
  The profiles appear in the debug panel and are not used to translate: ADDI
  translates server-side (live events arrive already translated) and `/speak`
  carries no profile.
- Live transcription/translation via the ADDI WebSocket
  (`/live/{id}/ws?bearer=...`) with auto-reconnect
- Dual-text message bubbles showing original and translated text with flag emoji
- TTS message sending to the caller via `POST /transactions/{id}/speak`
  (Enter sends, Shift+Enter adds a newline)
- Connection status indicator and collapsible debug panel

## Tenant scoping

The bearer selects an ADDI **subclient**, and nothing else in the widget's
inputs says which one. Every `/language_maps` entry carries its `client_id` and
`subclient_id`, so the widget reads the subclient off the catalog and shows it
in the debug panel.

This matters because a bearer and a transaction can belong to different
subclients, and the symptom is confusing: the transaction's languages are
absent from the catalog, so the dropdowns cannot represent the call, profile
matching finds nothing, and Update has no `mapId` to send. Nothing reports an
error — each endpoint returns `200` for its own tenant.

The widget therefore treats a language that is live on the transaction but
missing from `/language_maps` as a **misconfiguration signal**: the language is
still added so the transcript stays readable, and a banner points at the likely
bearer/transaction mismatch. This is also why the dropdowns group by
`/translation_pairs` instead of filtering on it — filtering would hide exactly
the language that reveals the problem.

Verified against a live `JA-JP` → `EN-US` call: its `agent_id`/`caller_id`
resolved cleanly to `/language_maps` entries in its own subclient and matched
nothing in another's, and the live WebSocket events carried `source: JA-JP` /
`target: EN-US` matching the transaction exactly.

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
