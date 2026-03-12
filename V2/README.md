# ADDI POC Widget V2

A modernized, refactored version of the ADDI POC Widget for Genesys Cloud.

## Version
**2.0.0**

## Overview

This widget provides real-time translation capabilities for contact center agents using Genesys Cloud and ADDI translation services. It supports both digital messaging and voice channels.

## Key Improvements in V2

### Code Organization
- **Modular JavaScript**: Code split into separate modules with clear responsibilities
  - `config.js` - Configuration management and constants
  - `api.js` - All API interactions (Genesys Cloud & ADDI)
  - `ui.js` - DOM manipulation and UI rendering
  - `utils.js` - Helper functions and utilities
  - `websocket.js` - WebSocket connection management
  - `app.js` - Main application orchestration

### Styling
- **CSS Custom Properties**: Modern CSS with variables for easy theming
- **Cleaner Layout**: Simplified flexbox-based layout
- **Responsive Design**: Better mobile/tablet support
- **Removed Legacy Prefixes**: Cleaned up outdated vendor prefixes

### Code Quality
- **JSDoc Comments**: All functions documented
- **Consistent Naming**: camelCase throughout
- **Removed Duplicate Code**: Consolidated similar functions
- **Removed Dead Code**: Cleaned up commented/unused code

## File Structure

```
V2/
├── index.html              # Main HTML file
├── README.md               # This file
├── scripts/
│   ├── config.js           # Configuration & constants
│   ├── api.js              # API interactions
│   ├── ui.js               # UI rendering & DOM
│   ├── utils.js            # Utility functions
│   ├── websocket.js        # WebSocket management
│   ├── app.js              # Main application logic
│   └── languageDefinition.json  # Language configuration
├── styles/
│   └── main.css            # Main stylesheet
└── assets/
    └── sandcastlerobot.jpg # Workflow avatar image
```

## Configuration

### URL Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `gc_region` | Yes | Genesys Cloud region (e.g., `mypurecloud.com`) |
| `gc_clientId` | Yes | OAuth client ID |
| `gc_redirectUrl` | Yes | OAuth redirect URL |
| `gc_conversationId` | Yes | Conversation ID to load |
| `gc_language` | No | Default language setting |
| `translateToken` | No | Legacy translation token |

### Example URL

```
https://your-host.com/V2/?gc_region=mypurecloud.com&gc_clientId=abc123&gc_redirectUrl=https://your-host.com/V2/&gc_conversationId=xyz789
```

## Features

- **Real-time Translation**: Translate customer messages to agent's language
- **Outbound Translation**: Translate agent messages before sending
- **Voice Support**: Real-time transcription and translation via ADDI
- **Language Selection**: Dynamic language switching
- **Canned Responses**: Integration with Genesys Cloud response libraries
- **Placeholder Support**: `{{AGENT_NAME}}` and `{{AGENT_ALIAS}}` replacement

## Supported Languages

20+ languages including:
- English, Spanish, French, German, Portuguese
- Mandarin, Cantonese, Japanese, Korean
- Arabic, Dutch, Finnish, Polish, and more

See `scripts/languageDefinition.json` for the complete list.

## External Dependencies

### CDN Resources
- Genesys Spark Components (v4.88.0)
- Genesys Cloud Platform SDK

### External Services
- ADDI Translation API (`https://addi-dev.ttec-cloudapps.com/addi/ccaip`)
- ADDI WebSocket (`wss://addi-dev.ttec-cloudapps.com/addi/ccaip`)
- Genesys Cloud Streaming (`wss://streaming.{region}`)

## Quick Demo

To preview the UI without backend connections:

1. Open `demo.html` in your browser
2. Use the demo buttons to add sample messages:
   - 📨 Add Customer Message
   - 💬 Add Agent Message
   - 🤖 Add System Message
   - 🗑️ Clear All
   - 🐛 Toggle Debug
3. Type messages in the input and click send to see them translated

## Deployment

1. Copy the `V2` directory to your web server
2. Configure a Genesys Cloud OAuth client with:
   - Grant type: Implicit (Browser)
   - Redirect URI matching your deployment URL
   - Required scopes: `conversations`, `users`, `notifications`, `routing`, `response-management`
3. Access the widget with the required URL parameters

## Embedding in Genesys Cloud

1. Navigate to **Admin > Integrations > Interaction Widget**
2. Create a new widget with your deployment URL
3. Configure URL parameters to include `{{gcConversationId}}` token

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Differences from V1

| Aspect | V1 | V2 |
|--------|----|----|
| JavaScript | 1600+ lines inline | 6 modular files |
| CSS | 674 lines with legacy prefixes | Modern CSS variables |
| Code duplication | Multiple similar functions | Consolidated |
| Documentation | Minimal | Full JSDoc coverage |
| Error handling | Basic | Improved with logging |

## Troubleshooting

### Debug Panel
Expand the "Debug Information" accordion at the bottom to view:
- Environment and user information
- Conversation and communication IDs
- Media type and ADDI transaction

### Console Logging
Color-coded console output:
- **Green** - Successful operations
- **Blue** - Information
- **Orange** - Warnings
- **Red** - Errors

## License

Proprietary - TTEC
