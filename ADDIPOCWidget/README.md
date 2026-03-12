# ADDIPOCWidget Documentation

## Overview

The ADDIPOCWidget is a Genesys Cloud client application that provides real-time translation capabilities for contact center agents. It integrates with both Genesys Cloud and ADDI (AI-powered translation service) to enable agents to communicate with customers who speak different languages.

**Current Version:** 0.0.0.4

## Purpose

This widget enables:
- Real-time translation of customer messages (digital channels)
- Real-time voice transcription and translation (voice channels)
- Agent-to-customer message translation before sending
- Support for 20+ languages with automatic language detection
- Integration with Genesys Cloud canned responses with automatic translation

## Architecture

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Genesys Cloud  │────▶│  ADDIPOCWidget   │────▶│   ADDI Service  │
│  (Conversations)│◀────│  (index.html)    │◀────│  (Translation)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Components

1. **Genesys Cloud Platform Client SDK** - Handles authentication and API calls to Genesys Cloud
2. **ADDI Translation Service** - External translation API for real-time language translation
3. **WebSocket Connections** - Real-time event streaming for both Genesys notifications and ADDI transcription
4. **Genesys Spark UI Components** - Consistent UI styling matching Genesys Cloud design

## Features

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Message Translation** | Translates incoming customer messages to the agent's language |
| **Outbound Translation** | Translates agent messages to the customer's language before sending |
| **Voice Transcription** | Real-time transcription and translation for voice calls (via ADDI) |
| **Language Selection** | Dynamic language selection for both customer and agent |
| **Canned Responses** | Integration with Genesys Cloud canned response libraries |
| **Placeholder Replacement** | Supports `{{AGENT_NAME}}` and `{{AGENT_ALIAS}}` placeholders in canned responses |

### Media Type Support

- **MESSAGE** - Digital messaging channels (web chat, SMS, social)
- **VOICE** - Voice calls with ADDI transcription
- **OTHER** - Fallback for unsupported media types

## Configuration

### URL Parameters

The widget is configured via URL query parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `gc_region` | Yes | Genesys Cloud region (e.g., `mypurecloud.com`, `usw2.pure.cloud`) |
| `gc_clientId` | Yes | OAuth client ID for implicit grant authentication |
| `gc_redirectUrl` | Yes | OAuth redirect URL (should point to the widget URL) |
| `gc_conversationId` | Yes | The conversation ID to load and translate |
| `gc_language` | No | Default language setting |
| `translateToken` | No | Token for legacy translation API (if used) |

### Example URL

```
https://your-host.com/ADDIPOCWidget/?gc_region=mypurecloud.com&gc_clientId=abc123&gc_redirectUrl=https://your-host.com/ADDIPOCWidget/&gc_conversationId=xyz789
```

### Session Storage

Parameters are persisted to session storage, allowing the widget to maintain state across page refreshes:
- `gc_region`
- `gc_clientId`
- `gc_redirectUrl`
- `gc_conversationId`
- `gc_language`
- `translateToken`
- `gc_channelid` (WebSocket channel ID)

## Supported Languages

The widget supports the following languages (defined in `scripts/languageDefinition.json`):

| Language | Key | Region Code | Flag |
|----------|-----|-------------|------|
| Arabic | arabic | ar-EG | eg |
| Australian | bloke | en-GB | au |
| British | brit | en-GB | gb |
| Cantonese | cantonese | yue-HK | hk |
| Colombian | columbian | es-CO | co |
| Dutch | dutch | nl-NL | nl |
| English (US) | english | en-US | us |
| Finnish | finnish | fi-FI | fi |
| French | french | fr-FR | fr |
| French Canadian | french canadian | fr-CA | ca |
| German | german | de-DE | de |
| Hindi | hindi | hi | in |
| Japanese | japanese | ja-JP | ja |
| Korean | korean | ko-KR | ko |
| Mandarin | mandarin | cmn | ch |
| Polish | polish | pl-PL | pl |
| Portuguese | portuguese | pt-BR | br |
| Slovakian | slovakian | sk-SK | sk |
| Spanish | spanish | es-ES | es |
| Tagalog | tagalog | fil-PH | ph |

## External Dependencies

### CDN Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| Genesys Spark CSS | `app.usw2.pure.cloud/spark-components/build-assets/4.88.0-373/` | UI styling |
| Genesys Spark Components | `app.usw2.pure.cloud/spark-components/build-assets/4.88.0-373/` | UI components |
| Genesys Platform Client SDK | `sdk-cdn.mypurecloud.com/javascript/latest/` | Genesys Cloud API |

### External Services

| Service | Host | Purpose |
|---------|------|---------|
| ADDI Translation API | `https://addi-dev.ttec-cloudapps.com/addi/ccaip` | Translation requests |
| ADDI WebSocket | `wss://addi-dev.ttec-cloudapps.com/addi/ccaip` | Real-time transcription |
| Genesys Streaming | `wss://streaming.{gc_region}` | Genesys notifications |

## ADDI API Integration

### Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transactions` | GET | Get all active transactions |
| `/transaction/{id}` | GET | Get specific transaction details |
| `/language/{id}` | GET | Get transaction language settings |
| `/language` | PUT | Update transaction language settings |
| `/languages` | GET | Get supported languages |
| `/profiles` | GET | Get translation profiles |
| `/translate` | POST | Translate text |
| `/speak` | POST | Send TTS message (voice) |
| `/live/{id}/ws` | WebSocket | Real-time transcription stream |

### Translation Profiles

The widget automatically selects translation profiles based on the agent and customer language combination. If no matching profile is found, a warning is displayed.

## Genesys Cloud API Integration

### APIs Used

| API | Purpose |
|-----|---------|
| **UsersApi** | Get current user information (name, image, alias) |
| **NotificationsApi** | Create and subscribe to notification channels |
| **ConversationsApi** | Get conversation details, send messages |
| **RoutingApi** | Get queue information for canned responses |
| **ResponseManagementApi** | Get canned responses from library |

### Authentication

Uses OAuth 2.0 Implicit Grant flow:
1. Widget redirects to Genesys Cloud login
2. User authenticates
3. Token returned via redirect URL hash
4. SDK manages token persistence with `_mm_` prefix

## User Interface

### Layout Structure

```
┌────────────────────────────────────────────────┐
│ Control Pane                                   │
│ [Customer Language ▼] [Agent Language ▼] [Update]│
├────────────────────────────────────────────────┤
│                                                │
│ Conversation Pane (scrollable)                 │
│                                                │
│  ┌──────────────────────┐                      │
│  │ 🇪🇸 Original text     │  ← Customer message │
│  │ ─────────────────────│                      │
│  │ 🇺🇸 Translated text   │                      │
│  └──────────────────────┘                      │
│                                                │
│                   ┌──────────────────────┐     │
│  Agent message →  │ 🇺🇸 Original text     │     │
│                   │ ─────────────────────│     │
│                   │ 🇪🇸 Translated text   │     │
│                   └──────────────────────┘     │
│                                                │
├────────────────────────────────────────────────┤
│ Message Input Footer                           │
│ [Message] [Canned Response]                    │
│ ┌──────────────────────────────────┐ ┌──────┐  │
│ │ Type message...                  │ │  ⟲   │  │
│ └──────────────────────────────────┘ └──────┘  │
├────────────────────────────────────────────────┤
│ Debug Info (collapsible accordion)             │
└────────────────────────────────────────────────┘
```

### Message Styling

| Sender | Background Color | Position |
|--------|------------------|----------|
| Customer | `#767c8d` (gray) | Left aligned |
| Agent | `#e77d1a` (orange) | Right aligned |
| Workflow/System | `#69c083` (green) | Right aligned |

### Spark UI Components Used

- `gux-dropdown` / `gux-listbox` - Language selection
- `gux-button` - Update button
- `gux-tabs` / `gux-tab-panel` - Message/Canned Response tabs
- `gux-accordion` - Debug info section
- `gux-tag` - Message metadata (timestamp, sender)
- `gux-avatar-beta` - User avatars
- `gux-flag-icon-beta` - Language flag icons
- `gux-radial-loading` - Loading indicator
- `gux-selector-card-beta` - Canned response cards

## File Structure

```
ADDIPOCWidget/
├── index.html                 # Main application file
├── style/
│   └── pane.css              # Custom CSS styling
├── scripts/
│   └── languageDefinition.json  # Language configuration
├── sandcastlerobot.jpg       # Workflow/bot avatar image
├── genesys-spark/            # Local Spark components (optional)
│   ├── dist/
│   │   ├── index.js
│   │   ├── global.css
│   │   └── reset.css
│   └── package.json
├── LG_Umbrella.png           # Logo asset
├── person-collaboration-yes.svg  # Person icon
├── testWebSocket.html        # WebSocket testing utility
├── error.html                # Error page
└── priorVersions/            # Previous versions backup
```

## Deployment

### Requirements

1. Web server capable of serving static HTML files
2. Valid SSL certificate (required for OAuth and WebSocket connections)
3. Genesys Cloud OAuth client configured with:
   - Grant type: Implicit (Browser)
   - Redirect URI matching your deployment URL
   - Required scopes: `conversations`, `users`, `notifications`, `routing`, `response-management`

### Deployment Steps

1. Copy required files to web server:
   - `index.html`
   - `style/pane.css`
   - `scripts/languageDefinition.json`
   - `sandcastlerobot.jpg`

2. Configure Genesys Cloud OAuth client

3. Access widget with required URL parameters

### Embedding in Genesys Cloud

The widget can be embedded as an interaction widget in Genesys Cloud:
1. Navigate to Admin > Integrations > Interaction Widget
2. Create new widget with the deployment URL
3. Configure URL parameters to include `{{gcConversationId}}` token

## Troubleshooting

### Debug Information

Expand the "Debug Info" accordion at the bottom of the widget to view:
- Environment (region)
- User information
- OAuth client ID
- Conversation ID
- Participant and communication IDs
- Media type
- Last utterance and translation

### Common Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Blank screen | OAuth redirect failed | Check `gc_clientId` and `gc_redirectUrl` |
| No messages appearing | Invalid conversation ID | Verify `gc_conversationId` parameter |
| Translation not working | ADDI profiles not found | Check ADDI configuration for language pair |
| WebSocket disconnects | Network issues | Widget auto-reconnects on disconnect |

### Console Logging

The widget uses color-coded console logging:
- **Green** - Successful operations
- **Yellow** - Configuration information
- **Red** - Errors and heartbeats
- **Blue** - Participant information
- **Purple** - API request bodies

## Version History

| Version | Changes |
|---------|---------|
| 0.0.0.4 | Current version - ADDI integration with ccaip endpoint |
| Prior | Legacy versions in `priorVersions/` folder |

## Security Considerations

- OAuth tokens are stored in session storage with `_mm_` prefix
- Widget uses implicit grant (tokens exposed in URL fragment)
- CORS headers required on ADDI endpoints
- No sensitive data persisted to local storage
- WebSocket connections use secure `wss://` protocol

## Contact

For issues or questions, contact the development team or raise an issue in the repository.
