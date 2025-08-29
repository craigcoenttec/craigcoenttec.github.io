# Agent Assist Iframe Communication Architecture

## Overview

The Agent Assist (AA) demo application serves as a bridge between Genesys Cloud contact center and the TTEC Agent Assist iframe. It captures conversation data (voice transcriptions, chat messages) and forwards them to an embedded Agent Assist iframe for AI-powered analysis and suggestions.

## Current File Structure

```
AA/
├── iframe-communication-demo.html     (HTML + embedded JS - CSS extracted)
├── iframe-communication-demo-original.html (Original with inline CSS for reference)
├── iframe-communication-wrapper.js    (2,227 lines - Core wrapper class)
├── styles.css                         (External stylesheet - extracted from demo HTML)
└── AGENT-ASSIST-ARCHITECTURE.md      (This documentation)
```

### Recent Changes: CSS Extraction (2024)

The main demo HTML file has been refactored for better maintainability:

- **CSS Separated**: All inline styles extracted from `<style>` blocks into external `styles.css`
- **External Reference**: HTML now uses `<link rel="stylesheet" href="styles.css">` 
- **Preserved Original**: `iframe-communication-demo-original.html` maintains original inline CSS for reference
- **Improved Maintainability**: CSS can now be modified independently of HTML structure
- **Better Organization**: Follows web development best practices for separation of concerns

## Architecture Components

### 1. Core Communication System
- **Technology**: HTML5 postMessage API
- **Purpose**: Secure cross-origin communication with iframe
- **Main Class**: `IframeCommunicationWrapper`
- **Key Files**: `iframe-communication-wrapper.js:13-2227`

### 2. Data Sources Integration

#### Genesys Cloud Platform SDK
- **Voice Transcription**: Real-time speech-to-text from active calls
- **Message Notifications**: Chat/messaging conversations  
- **Conversation Notifications**: Call state changes and metadata
- **Authentication**: OAuth implicit flow
- **Location**: `iframe-communication-demo.html:1420-1600`

#### AudioHook WebSocket Service
- **Purpose**: Alternative transcription service
- **Protocol**: WebSocket connection
- **URL**: Configurable endpoint (default: `wss://ttec-digital-audiohook-listener-*.run.app`)
- **Location**: `iframe-communication-wrapper.js:500-800`

### 3. Agent Assist Iframe Integration
- **Target**: `https://agent-assist.tthcslabs.com`
- **Communication**: Bidirectional postMessage
- **Message Types**:
  - `authorize` - Authentication request/response
  - `join-conversation` - Start conversation session
  - `activate-conversation` - Begin active monitoring
  - `analyze-content` - Send utterance for AI analysis
  - `leave-conversation` - End session
  - `wrap-conversation` - Conversation summary

## Communication Flow

### 1. Initialization Sequence
```
1. Load iframe with Agent Assist URL
2. Setup postMessage listeners
3. Send authorization request
4. Receive access token
5. Ready for conversation handling
```

### 2. Call/Chat Handling Workflow
```
1. Genesys Cloud conversation detected
2. Extract conversation metadata (ID, participants, media type)
3. Join Agent Assist conversation (map GC ID → AA ID)
4. Activate conversation for monitoring
5. Forward utterances/messages for analysis
6. Receive AI suggestions and notes
7. Wrap conversation at end
```

### 3. Auto-Forwarding System
- **Voice Calls**: Transcription → Content Analysis
- **Chat/Messaging**: Message events → Content Analysis  
- **Filtering**: Excludes workflow/bot messages
- **Location**: `iframe-communication-demo.html:1580-1620`

## Key Functions & Locations

### HTML File Functions (`iframe-communication-demo.html`)

#### URL Parameter Handling
- `populateFromUrlParameters()` - Lines 684-720
- Supports: gc_region, gc_clientId, gc_conversationId, audiohook_url, iframe_url

#### UI Management
- `toggleFormPanel()` - Lines 950-980
- `toggleCollapsibleSection()` - Lines 960-1000
- Logging functions - Lines 1000-1100

#### Genesys Cloud Integration
- `authenticateGenesysCloud()` - Lines 1420-1460
- `connectToTranscription()` - Lines 1464-1488
- `connectToConversationNotifications()` - Lines 1520-1540
- `connectToMessageNotifications()` - Lines 1560-1580

#### Automated Workflows
- `startNewCallSequence()` - Lines 2100-2200
- `startAutoListenSequence()` - Lines 2240-2300

### Wrapper File Functions (`iframe-communication-wrapper.js`)

#### Core Communication
- `constructor()` - Lines 35-126
- `initialize()` - Lines 132-147
- `sendMessageToIframe()` - Lines 154-175
- `handleReceivedMessage()` - Lines 181-202

#### Conversation Management
- `sendJoinConversation()` - Lines 294-306
- `sendActivateConversation()` - Lines 312-321
- `sendAnalyzeContent()` - Lines 424-436
- `sendLeaveConversation()` - Lines 327-335

#### External Service Integration
- AudioHook WebSocket - Lines 500-800
- Genesys Cloud SDK - Lines 1200-2000
- Conversation tracking - Lines 1800-2100

## Configuration Options

### URL Parameters
| Parameter | Description | Example |
|-----------|-------------|---------|
| `gc_region` | Genesys Cloud region | `usw2.pure.cloud` |
| `gc_clientId` | OAuth client ID | `your-client-id` |
| `gc_conversationId` | Specific conversation | `conv-uuid` |
| `iframe_url` | Agent Assist base URL | `https://agent-assist.tthcslabs.com` |
| `organization_id` | Org identifier | `org-uuid` |
| `audiohook_url` | AudioHook WebSocket | `wss://audiohook.example.com` |
| `AutoListen` | Auto-start listening | `true` |
| `hidePanel` | Hide control panel | `true` |

### Auto-Forwarding Settings
- **Transcription forwarding**: Enabled by default
- **AudioHook forwarding**: Enabled by default  
- **Message forwarding**: Enabled by default
- **Workflow filtering**: Enabled by default (excludes bot messages)
- **Auto call handling**: Enabled by default

## JavaScript Restructuring Recommendations

### Current Issues
1. **Monolithic HTML**: 1,800+ lines of JS embedded in HTML
2. **Large Files**: Both files exceed 2,000 lines
3. **Mixed Concerns**: UI, business logic, and integration code intermingled
4. **Maintenance Difficulty**: Hard to debug and modify

### Recommended Modular Structure
```
AA/
├── iframe-communication-demo.html    (HTML only, ~700 lines)
├── styles.css                       (External CSS, extracted)
├── js/
│   ├── main.js                      (App initialization, ~200 lines)
│   ├── iframe-wrapper.js            (Existing class, cleaned up)
│   ├── genesys-cloud-client.js      (GC SDK integration, ~600 lines)
│   ├── audiohook-client.js          (WebSocket handling, ~300 lines)
│   ├── ui-controller.js             (DOM manipulation, ~400 lines)
│   ├── config.js                    (Configuration, ~200 lines)
│   └── utilities.js                 (Shared helpers, ~200 lines)
```

**Progress Made**: CSS extraction completed as first step toward modular structure.

### Benefits of Modular Approach
- **Separation of Concerns**: Each module has single responsibility
- **Easier Testing**: Individual modules can be unit tested
- **Better Debugging**: Isolated functionality for troubleshooting
- **Maintainability**: Smaller, focused files are easier to modify
- **Code Reuse**: Modules can be imported in other projects

## Message Format Specifications

### To Iframe (Agent Assist)
```javascript
{
  topic: 'message-type',
  details: { /* message-specific data */ },
  timestamp: '2024-01-01T12:00:00.000Z',
  source: 'parent-window'
}
```

### From Iframe (Agent Assist)
```javascript
{
  topic: 'response-type',
  details: { /* response data */ },
  success: true|false,
  error: { /* error info if applicable */ },
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

## Security Considerations

### Origin Validation
- **Current**: Uses `'*'` for demo purposes
- **Production**: Should validate specific iframe origin
- **Location**: `iframe-communication-wrapper.js:185`

### Token Handling
- **Storage**: Access tokens stored in wrapper instance
- **Transmission**: Tokens passed to iframe for API calls
- **Scope**: Limited to conversation management APIs

## Debugging & Monitoring

### Logging Systems
- **Iframe Messages**: `messageLog` display
- **Genesys Cloud**: `gcTranscriptionMessageLog` and conversation logs
- **AudioHook**: `audiohookMessageLog`  
- **Message Tracking**: Detailed conversation and message tracking
- **Call Sequences**: Status updates for automated workflows

### Developer Tools
- Browser console logs for all major operations
- UI status indicators for connection states
- Detailed error reporting with context
- Message history preservation for troubleshooting

## Genesys Cloud Subscription Schemas

This section documents the exact response schemas for Genesys Cloud WebSocket notifications that the application subscribes to. These schemas are critical for understanding the data structure and implementing proper event handling.

### Transcription Notifications (`v2.conversations.{id}.transcription`)

**Topic Pattern**: `v2.conversations.{conversationId}.transcription`  
**Purpose**: Real-time speech-to-text transcription from voice calls  
**Trigger**: When speech is detected and transcribed during an active call

**Event Schema**:
```javascript
{
  "eventTime": "string",                    // ISO 8601 timestamp when transcription occurred
  "organizationId": "string",               // Genesys Cloud organization UUID
  "conversationId": "string",               // Conversation UUID from Genesys Cloud
  "communicationId": "string",              // Specific communication leg UUID
  "sessionStartTimeMs": 0,                  // When transcription session began (epoch ms)
  "transcriptionStartTimeMs": 0,            // When this transcription started (epoch ms)
  "transcripts": [                          // Array of transcript objects
    {
      "utteranceId": "string",              // Unique identifier for this utterance
      "isFinal": true,                      // Whether this is final transcription (vs interim)
      "channel": {                          // Audio channel source
        "enum": [
          "UNKNOWN",                        // Channel not determined
          "INTERNAL",                       // Internal participant (agent)
          "EXTERNAL",                       // External participant (customer)
          "BOTH"                            // Mixed/conference audio
        ]
      },
      "alternatives": [                     // Array of transcription alternatives
        {
          "confidence": 0,                  // Confidence score (0.0 - 1.0)
          "offsetMs": 0,                    // Offset from session start (ms)
          "durationMs": 0,                  // Duration of this utterance (ms)
          "transcript": "string",           // Raw transcribed text
          "words": [                        // Word-level timing and confidence
            {
              "confidence": 0,              // Word confidence (0.0 - 1.0)
              "startTimeMs": 0,             // Word start time (epoch ms)
              "offsetMs": 0,                // Offset from utterance start (ms)
              "durationMs": 0,              // Word duration (ms)
              "word": "string"              // Individual word text
            }
          ],
          "decoratedTranscript": "string",  // Formatted transcript with punctuation
          "decoratedWords": [               // Formatted word objects
            {}                              // Enhanced word objects (structure varies)
          ]
        }
      ],
      "agentAssistantId": "string",         // Agent Assist program UUID (if enabled)
      "engineProvider": "string",           // Transcription engine provider name
      "engineId": "string",                 // Specific engine identifier
      "engineName": "string",               // Human-readable engine name
      "dialect": "string",                  // Language/dialect code (e.g., "en-US")
      "speechTextAnalyticsProgramId": "string", // Analytics program UUID
      "agentAssistEnabled": true,           // Whether Agent Assist is active
      "voiceTranscriptionEnabled": true    // Whether transcription is enabled
    }
  ],
  "status": {                              // Transcription session status
    "offsetMs": 0,                         // Current offset from session start
    "status": {                            // Session state
      "enum": [
        "UNKNOWN",                         // Status not determined
        "SESSION_ONGOING",                 // Transcription active
        "SESSION_ENDED"                    // Transcription completed
      ]
    }
  }
}
```

**Key Usage Notes**:
- **isFinal**: `false` = interim transcription (may change), `true` = final transcription
- **channel**: Use to distinguish between agent (`INTERNAL`) and customer (`EXTERNAL`) speech
- **confidence**: Higher values indicate more reliable transcription
- **alternatives**: Usually contains one item, but may have multiple transcription options
- **agentAssistEnabled**: Indicates if this conversation is eligible for Agent Assist analysis
- **decoratedTranscript**: Preferred for display (includes proper punctuation and formatting)

**Implementation Location**: 
- Subscription: `genesys-cloud-client.js:240-277`
- Message Handling: `genesys-cloud-client.js:293-299`

### Conversation Call Notifications (`v2.users.{id}.conversations.calls`)

**Topic Pattern**: `v2.users.{userId}.conversations.calls`  
**Purpose**: Real-time notifications about call conversation state changes and participant updates  
**Trigger**: When conversations are created, updated, participants join/leave, or state changes occur

**Event Schema**:
```javascript
{
  "id": "string",                           // Unique conversation identifier (UUID)
  "name": "string",                         // Human-readable conversation name/description
  "participants": [                         // Array of all conversation participants
    {
      "id": "string",                       // Participant UUID
      "name": "string",                     // Participant display name
      "address": "string",                  // Phone number, email, or contact address
      "startTime": "string",                // ISO 8601 timestamp when participant joined
      "connectedTime": "string",            // ISO 8601 timestamp when participant connected
      "endTime": "string",                  // ISO 8601 timestamp when participant left
      "startHoldTime": "string",            // ISO 8601 timestamp when put on hold
      "purpose": "string",                  // Reason for participation (e.g., "agent", "customer")
      "state": {                            // Current participant state
        "enum": [
          "alerting",                       // Ringing/alerting state
          "dialing",                        // Outbound dialing in progress
          "contacting",                     // Attempting to establish connection
          "offering",                       // Call being offered to participant
          "connected",                      // Successfully connected and active
          "disconnected",                   // Disconnected but may reconnect
          "terminated",                     // Permanently ended
          "converting",                     // Converting between media types
          "uploading",                      // Uploading content
          "transmitting",                   // Transmitting data
          "scheduled",                      // Scheduled for future
          "parked",                         // Call parked
          "none"                            // No specific state
        ]
      },
      "initialState": {                     // State when participant first joined
        "enum": [                           // Same enum values as "state"
          "alerting", "dialing", "contacting", "offering", "connected",
          "disconnected", "terminated", "converting", "uploading",
          "transmitting", "scheduled", "parked", "none"
        ]
      },
      "direction": {                        // Call direction relative to this participant
        "enum": [
          "inbound",                        // Incoming call to this participant
          "outbound"                        // Outgoing call from this participant
        ]
      },
      "disconnectType": {                   // Reason for disconnection (if applicable)
        "enum": [
          "endpoint",                       // Normal endpoint disconnection
          "endpoint.dnd",                   // Endpoint in do-not-disturb
          "client",                         // Client-initiated disconnect
          "system",                         // System-initiated disconnect
          "transfer",                       // Transferred to another destination
          "timeout",                        // Connection timeout
          "transfer.conference",            // Transferred to conference
          "transfer.consult",               // Consult transfer
          "transfer.forward",               // Call forwarded
          "transfer.noanswer",              // Transfer due to no answer
          "transfer.notavailable",          // Transfer due to unavailability
          "transfer.dnd",                   // Transfer due to do-not-disturb
          "transport.failure",              // Network/transport failure
          "error",                          // Generic error condition
          "peer",                           // Peer disconnection
          "other",                          // Other/unspecified reason
          "spam",                           // Identified as spam
          "uncallable",                     // Destination uncallable
          "inactivity"                      // Disconnected due to inactivity
        ]
      },
      "held": true,                         // Whether participant is currently on hold
      "wrapupRequired": true,               // Whether post-call wrapup is required
      "wrapupPrompt": "string",             // Custom wrapup prompt text
      "user": {                             // User information (for internal participants)
        "id": "string",                     // User UUID
        "name": "string"                    // User display name
      },
      "queue": "object",                    // Queue information (if routed through queue)
      "team": "object",                     // Team information (if applicable)
      "attributes": "object",               // Custom attributes key-value pairs
      "errorInfo": {                        // Error details (if error occurred)
        "message": "string",                // Human-readable error message
        "code": "string",                   // Error code identifier
        "status": 0,                        // HTTP-style status code
        "entityId": "string",               // Related entity UUID
        "entityName": "string",             // Related entity name
        "messageWithParams": "string",      // Parameterized error message
        "messageParams": "object",          // Error message parameters
        "contextId": "string",              // Error context identifier
        "details": [                        // Detailed error information
          {
            "errorCode": "string",          // Specific error code
            "fieldName": "string",          // Field that caused error
            "entityId": "string",           // Entity UUID related to error
            "entityName": "string"          // Entity name related to error
          }
        ],
        "errors": [{}],                     // Additional error objects
        "limit": {                          // Rate limiting information (if applicable)
          "key": "string",                  // Limit key identifier
          "namespace": {                    // Service namespace
            "enum": ["agent.assistant", "analytics", "conversation", /* ... many more ... */]
          },
          "value": 0,                       // Current limit value
          "documented": true                // Whether limit is documented
        }
      },
      "script": "object",                   // Script information (if using scripts)
      "wrapupTimeoutMs": 0,                 // Wrapup timeout in milliseconds
      "wrapupSkipped": true,                // Whether wrapup was skipped
      "alertingTimeoutMs": 0,               // How long participant will alert before timeout
      "provider": "string",                 // Communication provider name
      "externalContact": "object",          // External contact information
      "externalContactInitialDivisionId": "string", // Initial division for external contact
      "externalOrganization": "object",     // External organization information
      "wrapup": {                           // Post-call wrapup information
        "code": "string",                   // Wrapup code name
        "notes": "string",                  // Agent's wrapup notes
        "tags": [{}],                       // Wrapup tags
        "durationSeconds": 0,               // Time spent in wrapup (seconds)
        "endTime": "string"                 // ISO 8601 timestamp when wrapup completed
      },
      "conversationRoutingData": {          // Routing information
        "queue": "object",                  // Target queue reference
        "language": "object",               // Language preference reference
        "priority": 0,                      // Routing priority (0-100)
        "skills": [{}],                     // Required skills for routing
        "scoredAgents": [                   // Agent scoring for routing
          {
            "agent": "object",              // Agent reference
            "score": 0                      // Agent's score (0-100)
          }
        ]
      },
      "peer": "string",                     // Peer participant identifier
      "screenRecordingState": "string",     // Screen recording state
      "flaggedReason": {                    // Reason conversation was flagged
        "enum": ["general"]
      },
      "journeyContext": {                   // Customer journey context
        "customer": {                       // Customer information
          "id": "string",                   // Customer ID in journey system
          "idType": "string"                // Type of customer ID (e.g., "cookie")
        },
        "customerSession": {                // Customer session information
          "id": "string",                   // Session ID in journey system
          "type": "string"                  // Session type (e.g., "web", "app")
        },
        "triggeringAction": {               // Action that triggered this conversation
          "id": "string",                   // Action ID from journey system
          "actionMap": {                    // Action map details
            "id": "string",                 // Action map ID
            "version": 0                    // Action map version
          }
        }
      },
      "startAcwTime": "string",             // ISO 8601 timestamp when after-call work started
      "endAcwTime": "string",               // ISO 8601 timestamp when after-call work ended
      "resumeTime": "string",               // ISO 8601 timestamp when resumed from hold/park
      "parkTime": "string",                 // ISO 8601 timestamp when parked
      "mediaRoles": [{}],                   // Media-specific roles for this participant
      "queueMediaSettings": {               // Queue-specific media settings
        "alertingTimeoutSeconds": 0,        // Alerting timeout for this media type
        "autoAnswerAlertToneSeconds": 0,    // Auto-answer alert tone duration
        "manualAnswerAlertToneSeconds": 0,  // Manual answer alert tone duration
        "enableAutoAnswer": true            // Whether auto-answer is enabled
      },
      "muted": true,                        // Whether participant audio is muted
      "confined": true,                     // Whether participant is confined (restricted)
      "recording": true,                    // Whether participant is being recorded
      "recordingState": {                   // Current recording state
        "enum": ["none", "active", "paused"]
      },
      "recordersState": {                   // State of different recorder types
        "adhocState": "string",             // Adhoc recorder state
        "customerExperienceState": "string", // Customer experience recorder state
        "agentExperienceState": "string"    // Agent experience recorder state
      },
      "securePause": true,                  // Whether secure pause is active
      "group": "object",                    // Group information (if applicable)
      "ani": "string",                      // Automatic Number Identification (caller ID)
      "dnis": "string",                     // Dialed Number Identification Service
      "documentId": "string",               // Associated document ID
      "monitoredParticipantId": "string",   // ID of participant being monitored
      "coachedParticipantId": "string",     // ID of participant being coached
      "bargedParticipantId": "string",      // ID of participant being barged
      "bargedTime": "string",               // ISO 8601 timestamp when barge started
      "consultParticipantId": "string",     // ID of consult participant
      "faxStatus": {                        // Fax transmission status (if applicable)
        "direction": "string",              // Fax direction ("inbound"/"outbound")
        "expectedPages": 0,                 // Expected number of pages
        "activePage": 0,                    // Currently transmitting page
        "linesTransmitted": 0,              // Number of lines transmitted
        "bytesTransmitted": 0,              // Number of bytes transmitted
        "dataRate": 0,                      // Current data transmission rate
        "pageErrors": 0,                    // Number of page errors
        "lineErrors": 0                     // Number of line errors
      }
    }
  ],
  "otherMediaUris": [{}],                   // URIs for other media types in conversation
  "address": "string",                      // Primary conversation address/identifier
  "utilizationLabelId": "string",           // Utilization label UUID for capacity management
  "inactivityTimeout": "string",            // ISO 8601 duration before timeout due to inactivity
  "divisions": [                            // Division information for multi-tenant scenarios
    {
      "division": {                         // Division reference
        "id": "string",                     // Division UUID
        "selfUri": "string"                 // Division API URI
      },
      "entities": [                         // Entities within this division
        {
          "id": "string",                   // Entity UUID
          "selfUri": "string",              // Entity API URI
          "dateDivisionUpdated": "string"   // ISO 8601 timestamp of last division update
        }
      ]
    }
  ],
  "recordingState": {                       // Overall conversation recording state
    "enum": ["none", "active", "paused"]
  },
  "securePause": true,                      // Whether secure pause is active for conversation
  "maxParticipants": 0                      // Maximum allowed participants in conversation
}
```

**Key Usage Notes**:
- **Participant State Changes**: Monitor `state` field transitions to track call progress
- **Agent vs Customer**: Use `purpose` and `direction` to distinguish participant roles
- **Connection Timing**: `startTime`, `connectedTime`, `endTime` provide complete timing data
- **Hold/Park Status**: Check `held` field and `holdTime` for hold state management
- **Recording Awareness**: `recording` and `recordingState` indicate if conversation is recorded
- **Wrapup Management**: `wrapupRequired` determines if agent must complete post-call work
- **Error Handling**: `errorInfo` provides detailed error context when issues occur
- **Journey Integration**: `journeyContext` links conversations to customer journey data

**Common State Transitions**:
- New Inbound: `alerting` → `connected` → `disconnected`
- New Outbound: `dialing` → `connected` → `disconnected`
- Transfer: `connected` → `terminated` (original), `alerting` → `connected` (target)
- Hold: `connected` + `held: false` → `connected` + `held: true`

**Implementation Location**: 
- Subscription: `genesys-cloud-client.js:310-347`
- Message Handling: `genesys-cloud-client.js:363-369`

### Message Notifications (`v2.users.{id}.conversations.messages`)

**Topic Pattern**: `v2.users.{userId}.conversations.messages`  
**Purpose**: Real-time notifications about messaging conversations and message events  
**Trigger**: When messaging conversations (SMS, chat, social media) receive new messages or status updates

**Event Schema**:
```javascript
{
  "id": "string",                           // Unique conversation identifier (UUID)
  "name": "string",                         // Human-readable conversation name/description
  "participants": [                         // Array of all conversation participants
    {
      "id": "string",                       // Participant UUID
      "name": "string",                     // Participant display name
      "address": "string",                  // Phone number, email, handle, or contact address
      "startTime": "string",                // ISO 8601 timestamp when participant joined
      "connectedTime": "string",            // ISO 8601 timestamp when participant connected
      "endTime": "string",                  // ISO 8601 timestamp when participant left
      "startHoldTime": "string",            // ISO 8601 timestamp when put on hold (if applicable)
      "purpose": "string",                  // Reason for participation (e.g., "agent", "customer")
      "state": {                            // Current participant state
        "enum": [
          "alerting",                       // Ringing/alerting state
          "dialing",                        // Outbound contact in progress
          "contacting",                     // Attempting to establish connection
          "offering",                       // Message being offered to participant
          "connected",                      // Successfully connected and active
          "disconnected",                   // Disconnected but may reconnect
          "terminated",                     // Permanently ended
          "converting",                     // Converting between media types
          "uploading",                      // Uploading content
          "transmitting",                   // Transmitting data
          "scheduled",                      // Scheduled for future
          "parked",                         // Conversation parked
          "none"                            // No specific state
        ]
      },
      "initialState": {                     // State when participant first joined
        "enum": [                           // Same enum values as "state"
          "alerting", "dialing", "contacting", "offering", "connected",
          "disconnected", "terminated", "converting", "uploading", 
          "transmitting", "scheduled", "parked", "none"
        ]
      },
      "direction": {                        // Message direction relative to this participant
        "enum": [
          "inbound",                        // Incoming messages to this participant
          "outbound"                        // Outgoing messages from this participant
        ]
      },
      "disconnectType": {                   // Reason for disconnection (if applicable)
        "enum": [
          "endpoint", "endpoint.dnd", "client", "system", "transfer", "timeout",
          "transfer.conference", "transfer.consult", "transfer.forward", 
          "transfer.noanswer", "transfer.notavailable", "transfer.dnd",
          "transport.failure", "error", "peer", "other", "spam", "uncallable", "inactivity"
        ]
      },
      "held": true,                         // Whether participant is currently on hold
      "wrapupRequired": true,               // Whether post-conversation wrapup is required
      "wrapupPrompt": "string",             // Custom wrapup prompt text
      "user": {                             // User information (for internal participants)
        "id": "string",                     // User UUID
        "name": "string"                    // User display name
      },
      "queue": "object",                    // Queue information (if routed through queue)
      "team": "object",                     // Team information (if applicable)
      "attributes": "object",               // Custom attributes key-value pairs
      "errorInfo": {                        // Error details (if error occurred)
        "message": "string",                // Human-readable error message
        "code": "string",                   // Error code identifier
        "status": 0,                        // HTTP-style status code
        "entityId": "string",               // Related entity UUID
        "entityName": "string",             // Related entity name
        "messageWithParams": "string",      // Parameterized error message
        "messageParams": "object",          // Error message parameters
        "contextId": "string",              // Error context identifier
        "details": [                        // Detailed error information
          {
            "errorCode": "string",          // Specific error code
            "fieldName": "string",          // Field that caused error
            "entityId": "string",           // Entity UUID related to error
            "entityName": "string"          // Entity name related to error
          }
        ],
        "errors": [{}],                     // Additional error objects
        "limit": {                          // Rate limiting information (if applicable)
          "key": "string",                  // Limit key identifier
          "namespace": {                    // Service namespace (same as calls)
            "enum": ["messaging", "web.messaging", "webchat", "sms", /* ... many more ... */]
          },
          "value": 0,                       // Current limit value
          "documented": true                // Whether limit is documented
        }
      },
      "script": "object",                   // Script information (if using scripts)
      "wrapupTimeoutMs": 0,                 // Wrapup timeout in milliseconds
      "wrapupSkipped": true,                // Whether wrapup was skipped
      "alertingTimeoutMs": 0,               // How long participant will alert before timeout
      "provider": "string",                 // Messaging provider name (e.g., "WhatsApp", "SMS")
      "externalContact": "object",          // External contact information
      "externalContactInitialDivisionId": "string", // Initial division for external contact
      "externalOrganization": "object",     // External organization information
      "wrapup": {                           // Post-conversation wrapup information
        "code": "string",                   // Wrapup code name
        "notes": "string",                  // Agent's wrapup notes
        "tags": [{}],                       // Wrapup tags
        "durationSeconds": 0,               // Time spent in wrapup (seconds)
        "endTime": "string"                 // ISO 8601 timestamp when wrapup completed
      },
      "conversationRoutingData": {          // Routing information
        "queue": "object",                  // Target queue reference
        "language": "object",               // Language preference reference
        "priority": 0,                      // Routing priority (0-100)
        "skills": [{}],                     // Required skills for routing
        "scoredAgents": [                   // Agent scoring for routing
          {
            "agent": "object",              // Agent reference
            "score": 0                      // Agent's score (0-100)
          }
        ]
      },
      "peer": "string",                     // Peer participant identifier
      "screenRecordingState": "string",     // Screen recording state
      "flaggedReason": {                    // Reason conversation was flagged
        "enum": ["general"]
      },
      "journeyContext": {                   // Customer journey context
        "customer": {                       // Customer information
          "id": "string",                   // Customer ID in journey system
          "idType": "string"                // Type of customer ID (e.g., "cookie")
        },
        "customerSession": {                // Customer session information
          "id": "string",                   // Session ID in journey system
          "type": "string"                  // Session type (e.g., "web", "app")
        },
        "triggeringAction": {               // Action that triggered this conversation
          "id": "string",                   // Action ID from journey system
          "actionMap": {                    // Action map details
            "id": "string",                 // Action map ID
            "version": 0                    // Action map version
          }
        }
      },
      "startAcwTime": "string",             // ISO 8601 timestamp when after-conversation work started
      "endAcwTime": "string",               // ISO 8601 timestamp when after-conversation work ended
      "resumeTime": "string",               // ISO 8601 timestamp when resumed from hold/park
      "parkTime": "string",                 // ISO 8601 timestamp when parked
      "mediaRoles": [{}],                   // Media-specific roles for this participant
      "queueMediaSettings": {               // Queue-specific media settings
        "alertingTimeoutSeconds": 0,        // Alerting timeout for this media type
        "autoAnswerAlertToneSeconds": 0,    // Auto-answer alert tone duration
        "manualAnswerAlertToneSeconds": 0,  // Manual answer alert tone duration
        "enableAutoAnswer": true            // Whether auto-answer is enabled
      },
      "messages": [                         // Array of messages in this conversation
        {
          "message": "object",              // The message object containing text/content
          "messageTime": "string",          // ISO 8601 timestamp when message was sent/received
          "messageSegmentCount": 0,         // Number of segments (for SMS split messages)
          "messageStatus": {                // Current status of this message
            "enum": [
              "queued",                     // Message queued for sending
              "sent",                       // Message sent from system
              "failed",                     // Message failed to send
              "received",                   // Message received by recipient
              "delivery-success",           // Confirmed delivery to recipient
              "delivery-failed",            // Failed to deliver to recipient
              "read",                       // Message read by recipient (if supported)
              "removed",                    // Message removed/deleted
              "published"                   // Message published (for social media)
            ]
          },
          "media": [                        // Attached media files
            {
              "url": "string",              // URL to access the media file
              "mediaType": "string",        // MIME type (image/jpeg, video/mp4, etc.)
              "contentLengthBytes": 0,      // File size in bytes
              "name": "string",             // Original filename
              "id": "string"                // Unique media identifier
            }
          ],
          "stickers": [                     // Sticker attachments (messaging apps)
            {
              "url": "string",              // URL to access the sticker
              "id": "string"                // Unique sticker identifier
            }
          ],
          "errorInfo": {                    // Error information for failed messages
            "status": 0,                    // HTTP status code
            "code": "string",               // Error code
            "message": "string",            // Human-readable error message
            "messageWithParams": "string",  // Parameterized error message
            "messageParams": "object",      // Error message parameters
            "contextId": "string",          // Error context identifier
            "uri": "string"                 // Related URI
          },
          "messageMetadata": {              // Message metadata and classification
            "type": "string",               // Message type classification
            "events": [                     // Event information
              {
                "eventType": "string",      // Type of event
                "subType": "string"         // Event subtype
              }
            ],
            "content": [                   // Content classification
              {
                "contentType": "string",    // Type of content
                "subType": "string"         // Content subtype
              }
            ]
          },
          "socialVisibility": {             // Visibility for social media messages
            "enum": ["private", "public"]
          }
        }
      ],
      "type": {                             // Messaging channel type
        "enum": [
          "unknown",                        // Unknown messaging type
          "sms",                            // SMS text messaging
          "twitter",                        // Twitter messages
          "facebook",                       // Facebook Messenger
          "line",                           // LINE messaging app
          "viber",                          // Viber messaging
          "wechat",                         // WeChat messaging
          "whatsapp",                       // WhatsApp messaging
          "telegram",                       // Telegram messaging
          "kakao",                          // KakaoTalk messaging
          "webmessaging",                   // Web-based messaging widget
          "open",                           // Open messaging protocol
          "instagram",                      // Instagram messaging
          "apple"                           // Apple Business Chat
        ]
      },
      "recipientCountry": "string",         // Country code of message recipient
      "recipientType": "string",            // Type of recipient (individual, business, etc.)
      "byoSmsIntegrationId": "string",      // Bring-your-own SMS integration identifier
      "monitoredParticipantId": "string"    // ID of participant being monitored
    }
  ],
  "otherMediaUris": [{}],                   // URIs for other media types in conversation
  "address": "string",                      // Primary conversation address/identifier
  "utilizationLabelId": "string",           // Utilization label UUID for capacity management
  "inactivityTimeout": "string",            // ISO 8601 duration before timeout due to inactivity
  "divisions": [                            // Division information for multi-tenant scenarios
    {
      "division": {                         // Division reference
        "id": "string",                     // Division UUID
        "selfUri": "string"                 // Division API URI
      },
      "entities": [                         // Entities within this division
        {
          "id": "string",                   // Entity UUID
          "selfUri": "string",              // Entity API URI
          "dateDivisionUpdated": "string"   // ISO 8601 timestamp of last division update
        }
      ]
    }
  ]
}
```

**Key Usage Notes**:
- **Message Status Tracking**: Monitor `messageStatus` to track delivery and read receipts
- **Media Handling**: `media` array contains attachments, images, files with full metadata
- **Channel Types**: Use `type` field to handle different messaging platforms appropriately
- **Message Segmentation**: `messageSegmentCount` helps handle SMS messages split across segments
- **Social Visibility**: `socialVisibility` important for public social media interactions
- **Multi-Channel Support**: Single schema handles SMS, WhatsApp, Facebook, Twitter, and more
- **Error Recovery**: `errorInfo` in messages provides specific failure reasons
- **Stickers/Emojis**: `stickers` array for messaging apps that support sticker content

**Message Status Flow**:
- Outbound: `queued` → `sent` → `delivery-success`/`delivery-failed` → `read` (if supported)
- Inbound: `received` → `read` (when agent views)
- Failed: Any status → `failed`

**Channel-Specific Considerations**:
- **SMS**: May be segmented, limited character count, `recipientCountry` important
- **WhatsApp**: Rich media support, read receipts available, business account features
- **Social Media**: `socialVisibility` crucial, public interactions visible to all
- **Web Messaging**: Real-time delivery, typing indicators, rich content support

**Implementation Location**: 
- Subscription: `genesys-cloud-client.js:380-417`
- Message Handling: `genesys-cloud-client.js:433-439`

### General Conversation Notifications (`v2.users.{id}.conversations`)

**Topic Pattern**: `v2.users.{userId}.conversations`  
**Purpose**: Comprehensive notifications about all conversation types and state changes for a specific user  
**Trigger**: When any conversation (calls, messages, emails, chats, etc.) involving the user is created, updated, or state changes occur

**Event Schema**:
```javascript
{
  "id": "string",                           // Unique conversation identifier (UUID)
  "maxParticipants": 0,                     // Maximum allowed participants in this conversation
  "participants": [                         // Array of all conversation participants
    {
      "id": "string",                       // Globally unique conversation identifier
      "connectedTime": "string",            // ISO 8601 timestamp when participant connected
      "endTime": "string",                  // ISO 8601 timestamp when participant disconnected
      "userId": "string",                   // User UUID (if participant is an internal user)
      "externalContactId": "string",        // External contact UUID (if participant is external contact)
      "externalContactInitialDivisionId": "string", // Initial division for external contact (immutable)
      "externalOrganizationId": "string",   // External organization UUID (if applicable)
      "name": "string",                     // Human-readable participant name
      "queueId": "string",                  // Queue UUID that conversation came through (if applicable)
      "groupId": "string",                  // Group UUID that participant represents (if applicable)
      "teamId": "string",                   // Team UUID when participant was added to conversation
      "purpose": "string",                  // Purpose/type of participant (e.g., "agent", "customer", "external")
      "consultParticipantId": "string",     // Participant UUID being consulted (if consult transfer)
      "address": "string",                  // Participant address (phone number, email, etc.)
      "wrapupRequired": true,               // Whether participant must enter wrapup
      "wrapupExpected": true,               // Whether participant expected to enter wrapup
      "wrapupPrompt": "string",             // UI wrapup prompt text
      "wrapupTimeoutMs": 0,                 // Wrapup session timeout in milliseconds
      "wrapup": {                           // Wrapup/disposition data
        "code": "string",                   // User-configured wrapup code name
        "notes": "string",                  // Agent notes about conversation/disposition
        "tags": [{}],                       // Wrapup tags
        "durationSeconds": 0,               // Time spent in after-call work (seconds)
        "endTime": "string"                 // ISO 8601 timestamp when wrapup finished
      },
      "startAcwTime": "string",             // ISO 8601 timestamp when after-call work started
      "endAcwTime": "string",               // ISO 8601 timestamp when after-call work ended
      "conversationRoutingData": {          // Routing information
        "queue": {                          // Queue reference
          "id": "string",                   // Queue UUID
          "name": "string"                  // Queue name
        },
        "language": "object",               // Language preference reference
        "priority": 0,                      // Routing priority (0-100)
        "skills": [{}],                     // Required skills for routing
        "scoredAgents": [                   // Agent scoring for routing decisions
          {
            "agent": "object",              // Agent reference
            "score": 0                      // Agent's score (0-100, higher = better)
          }
        ]
      },
      "alertingTimeoutMs": 0,               // Time before participant marked as not responding
      "monitoredParticipantId": "string",   // Participant UUID being monitored (if monitoring)
      "coachedParticipantId": "string",     // Participant UUID being coached (if coaching)
      "bargedParticipantId": "string",      // Participant UUID being barged (if barging)
      "mediaRoles": [{}],                   // Media-specific roles for this participant
      "screenRecordingState": {             // Screen recording state
        "enum": ["requested", "active", "paused", "stopped", "error", "timeout"]
      },
      "flaggedReason": "string",            // Reason conversation was flagged (if flagged)
      "attributes": "object",               // Additional custom participant attributes
      
      // Communication Type Arrays - Each participant can have multiple communication types
      "calls": [                            // Voice call communications
        {
          "id": "string",                   // Communication UUID
          "state": {                        // Current call state
            "enum": ["alerting", "dialing", "contacting", "offering", "connected", 
                     "disconnected", "terminated", "uploading", "converting", "transmitting", "none"]
          },
          "initialState": {                 // Initial state when call started
            "enum": ["alerting", "dialing", "contacting", "offering", "connected",
                     "disconnected", "terminated", "uploading", "converting", "transmitting", "none"]
          },
          "recording": true,                // Whether call is being recorded
          "recordingState": {               // Recording state
            "enum": ["none", "active", "paused"]
          },
          "recordersState": {               // State of different recorder types
            "adhocState": "string",         // Adhoc recorder state
            "customerExperienceState": "string", // Customer experience recorder state
            "agentExperienceState": "string" // Agent experience recorder state
          },
          "muted": true,                    // Whether call audio is muted
          "confined": true,                 // Whether participant hears hold music
          "held": true,                     // Whether call is held (participant hears silence)
          "securePause": true,              // Whether recording is in secure pause
          "errorInfo": {                    // Error details (if error occurred)
            "status": 0,                    // HTTP status code
            "code": "string",               // Error code
            "message": "string",            // Human-readable error message
            "messageWithParams": "string",  // Parameterized error message
            "messageParams": "object",      // Error message parameters
            "contextId": "string",          // Error context identifier
            "uri": "string"                 // Related URI
          },
          "disconnectType": {               // Reason for disconnection
            "enum": ["endpoint", "endpoint.dnd", "client", "system", "timeout", "transfer",
                     "transfer.conference", "transfer.consult", "transfer.forward", "transfer.noanswer",
                     "transfer.notavailable", "transfer.dnd", "transport.failure", "error", "peer",
                     "other", "spam", "uncallable"]
          },
          "startHoldTime": "string",        // ISO 8601 timestamp when placed on hold
          "direction": {                    // Call direction
            "enum": ["outbound", "inbound"]
          },
          "documentId": "string",           // Document UUID (if fax)
          "self": {                         // Local endpoint address/name data
            "name": "string",               // Display name (nameRaw or locality lookup)
            "nameRaw": "string",            // Name as close to wire format as possible
            "addressNormalized": "string",  // Normalized address from Address Normalization Table
            "addressRaw": "string",         // Address as close to wire format as possible
            "addressDisplayable": "string"  // Displayable address from Address Normalization Table
          },
          "other": "object",                // Remote endpoint address/name data
          "provider": "string",             // Call provider name
          "scriptId": "string",             // Script UUID (if using scripts)
          "peerId": "string",               // Peer communication UUID for matching leg
          "connectedTime": "string",        // ISO 8601 timestamp when connected
          "disconnectedTime": "string",     // ISO 8601 timestamp when disconnected
          "disconnectReasons": [            // Detailed disconnect reason information
            {
              "type": {                     // Protocol type
                "enum": ["q850", "sip"]
              },
              "code": 0,                    // Protocol-specific reason code
              "phrase": "string"            // Human-readable disconnect reason
            }
          ],
          "faxStatus": {                    // Fax transmission details (if fax call)
            "direction": "string",          // Fax direction ("send" or "receive")
            "expectedPages": 0,             // Total expected pages
            "activePage": 0,                // Currently transmitting page
            "linesTransmitted": 0,          // Lines completed
            "bytesTransmitted": 0,          // Bytes completed
            "baudRate": 0,                  // Current baud rate
            "pageErrors": 0,                // Number of page errors
            "lineErrors": 0                 // Number of line errors
          },
          "uuiData": "string",              // User-to-User Information data
          "bargedTime": "string",           // ISO 8601 timestamp when barge started
          "wrapup": "object",               // Call-specific wrapup data
          "afterCallWork": {                // After-call work information
            "state": {                      // ACW state
              "enum": ["unknown", "skipped", "pending", "complete", "notApplicable"]
            },
            "startTime": "string",          // ISO 8601 timestamp when ACW started
            "endTime": "string"             // ISO 8601 timestamp when ACW ended
          },
          "afterCallWorkRequired": true,    // Whether ACW is required
          "agentAssistantId": "string",     // Virtual agent assistant UUID
          "queueMediaSettings": {           // Queue-specific media settings
            "alertingTimeoutSeconds": 0,    // Alerting timeout
            "autoAnswerAlertToneSeconds": 0, // Auto-answer alert duration
            "manualAnswerAlertToneSeconds": 0, // Manual answer alert duration
            "enableAutoAnswer": true        // Whether auto-answer enabled
          }
        }
      ],
      
      "callbacks": [                        // Callback communications
        {
          "state": { "enum": ["alerting", "dialing", "contacting", "offering", "connected", "disconnected", "terminated", "scheduled", "uploading", "none"] },
          "initialState": { "enum": ["alerting", "dialing", "contacting", "offering", "connected", "disconnected", "terminated", "scheduled", "uploading", "none"] },
          "id": "string",                   // Communication UUID
          "direction": { "enum": ["inbound", "outbound"] },
          "held": true,                     // Whether callback is held
          "disconnectType": { "enum": ["endpoint", "endpoint.dnd", "client", "system", "timeout", "transfer", /* ... */] },
          "startHoldTime": "string",        // ISO 8601 timestamp when placed on hold
          "dialerPreview": {                // Preview dialer information
            "id": "string",                 // Preview UUID
            "contactId": "string",          // Contact UUID
            "contactListId": "string",      // Contact list UUID
            "campaignId": "string",         // Campaign UUID
            "phoneNumberColumns": [         // Phone number column mapping
              { "columnName": "string", "type": "string" }
            ]
          },
          "voicemail": {                    // Voicemail callback information
            "id": "string",                 // Voicemail UUID
            "uploadStatus": { "enum": ["pending", "complete", "failed", "timeout", "none"] }
          },
          "callbackNumbers": [{}],          // Available callback numbers
          "callbackUserName": "string",     // Name of user requesting callback
          "scriptId": "string",             // Script UUID
          "peerId": "string",               // Peer communication UUID
          "externalCampaign": true,         // Whether using external dialing
          "skipEnabled": true,              // Whether callback can be skipped
          "provider": "string",             // Callback provider
          "timeoutSeconds": 0,              // Auto-placement timeout (0 = disabled)
          "connectedTime": "string",        // ISO 8601 connection timestamp
          "disconnectedTime": "string",     // ISO 8601 disconnection timestamp
          "callbackScheduledTime": "string", // ISO 8601 scheduled time (null = immediate)
          "automatedCallbackConfigId": "string", // Auto-callback config UUID
          "wrapup": "object",               // Callback wrapup data
          "afterCallWork": "object",        // After-call work data
          "afterCallWorkRequired": true,    // Whether ACW required
          "callerId": "string",             // Caller ID (E164 format)
          "callerIdName": "string",         // Caller ID name
          "queueMediaSettings": "object"    // Queue media settings
        }
      ],
      
      "chats": [                           // Chat communications
        {
          "state": { "enum": ["alerting", "dialing", "contacting", "offering", "connected", "disconnected", "terminated", "none"] },
          "initialState": { "enum": ["alerting", "dialing", "contacting", "offering", "connected", "disconnected", "terminated", "none"] },
          "id": "string",                   // Communication UUID
          "provider": "string",             // Chat provider
          "scriptId": "string",             // Script UUID
          "peerId": "string",               // Peer communication UUID
          "roomId": "string",               // Chat room UUID
          "avatarImageUrl": "string",       // Chat avatar URL
          "held": true,                     // Whether chat is held
          "disconnectType": { "enum": ["endpoint", "endpoint.dnd", "client", "system", /* ... */] },
          "startHoldTime": "string",        // ISO 8601 hold timestamp
          "connectedTime": "string",        // ISO 8601 connection timestamp
          "disconnectedTime": "string",     // ISO 8601 disconnection timestamp
          "journeyContext": {               // Customer journey context
            "customer": { "id": "string", "idType": "string" },
            "customerSession": { "id": "string", "type": "string" },
            "triggeringAction": { "id": "string", "actionMap": { "id": "string", "version": 0 } }
          },
          "wrapup": "object",               // Chat wrapup data
          "afterCallWork": "object",        // After-call work data
          "afterCallWorkRequired": true,    // Whether ACW required
          "queueMediaSettings": "object"    // Queue media settings
        }
      ],
      
      "emails": [                          // Email communications
        {
          "id": "string",                   // Communication UUID
          "state": { "enum": ["alerting", "connected", "disconnected", "none", "transmitting", "parked"] },
          "initialState": { "enum": ["alerting", "connected", "disconnected", "none", "transmitting", "parked"] },
          "held": true,                     // Whether email is held
          "autoGenerated": true,            // Whether email was auto-generated (e.g., Out of Office)
          "subject": "string",              // Email subject line
          "provider": "string",             // Email provider
          "scriptId": "string",             // Script UUID
          "peerId": "string",               // Peer communication UUID
          "messagesSent": 0,                // Number of email messages sent
          "errorInfo": "object",            // Error information
          "disconnectType": { "enum": ["endpoint", "client", "system", "timeout", /* ... */] },
          "startHoldTime": "string",        // ISO 8601 hold timestamp
          "connectedTime": "string",        // ISO 8601 connection timestamp
          "disconnectedTime": "string",     // ISO 8601 disconnection timestamp
          "messageId": "string",            // Stored content UUID
          "direction": { "enum": ["outbound", "inbound"] },
          "draftAttachments": [             // Draft email attachments
            {
              "attachmentId": "string",     // Attachment UUID
              "name": "string",             // Attachment filename
              "contentUri": "string",       // Content URI (often public download link)
              "contentType": "string",      // File MIME type
              "contentLength": 0            // File size in bytes
            }
          ],
          "spam": true,                     // Whether marked as spam
          "wrapup": "object",               // Email wrapup data
          "afterCallWork": "object",        // After-call work data
          "afterCallWorkRequired": true,    // Whether ACW required
          "queueMediaSettings": "object",   // Queue media settings
          "resumeTime": "string",           // ISO 8601 resume time (for parked emails)
          "parkTime": "string"              // ISO 8601 park time
        }
      ],
      
      // Additional communication types: messages, internalMessages, cobrowsesessions, 
      // screenshares, socialExpressions, videos - each with similar detailed structures
      
      "workflow": {                         // Workflow information
        "workflowId": "string"              // Workflow UUID
      }
    }
  ],
  "recentTransfers": [                      // Recent transfer commands
    {
      "id": "string",                       // Transfer command UUID
      "state": {                            // Transfer state
        "enum": ["pending", "active", "complete", "canceled", "failed", "timeout", "unknown"]
      },
      "dateIssued": "string",               // ISO 8601 timestamp when transfer initiated
      "initiator": {                        // Transfer initiator information
        "userId": "string"                  // User UUID who initiated transfer
      },
      "modifiedBy": {                       // Last modifier information
        "id": "string",                     // Modifier user UUID
        "selfUri": "string"                 // Modifier API URI
      },
      "destination": {                      // Transfer destination
        "userId": "string",                 // Destination user UUID
        "address": "string"                 // Destination endpoint address
      },
      "transferType": {                     // Transfer type
        "enum": ["attended", "unattended"]
      }
    }
  ],
  "recordingState": "string",               // Overall conversation recording state
  "address": "string",                      // Primary conversation address
  "externalTag": "string",                  // External system tag
  "utilizationLabelId": "string",           // Utilization label UUID for capacity management
  "securePause": true,                      // Whether conversation is in secure pause
  "inactivityTimeout": "string",            // ISO 8601 duration before inactivity timeout
  "divisions": [                            // Division information for multi-tenant scenarios
    {
      "division": {                         // Division reference
        "id": "string",                     // Division UUID
        "selfUri": "string"                 // Division API URI
      },
      "entities": [                         // Entities within division
        {
          "id": "string",                   // Entity UUID
          "selfUri": "string",              // Entity API URI
          "dateDivisionUpdated": "string"   // ISO 8601 timestamp of last division update
        }
      ]
    }
  ]
}
```

**Key Usage Notes**:
- **Multi-Media Support**: Single participant can have calls, chats, emails, messages, videos simultaneously
- **Comprehensive State**: Covers all communication types (voice, messaging, email, chat, video, etc.)
- **Transfer Tracking**: `recentTransfers` provides detailed transfer command history
- **Advanced Features**: Screen recording, co-browse, social expressions, workflows
- **Routing Intelligence**: Complete routing data with skills, scored agents, priority
- **Journey Integration**: Links conversations to customer journey context across all media types
- **Flexible Communication**: Each media type has specific state enums and properties
- **Error Handling**: Detailed error information for each communication type

**Common Use Cases**:
- **Omnichannel Monitoring**: Track customer across all communication channels
- **Agent Productivity**: Monitor agent workload across different media types
- **Conversation Lifecycle**: Complete view of conversation from start to finish
- **Transfer Management**: Track complex transfer scenarios and outcomes
- **Compliance**: Recording states and secure pause across all communications
- **Workflow Automation**: Integration with business process workflows

**Comparison with Specific Subscriptions**:
- **More Comprehensive**: Contains all data from calls/messages subscriptions plus additional media types
- **Higher Volume**: Will generate more notifications than specific media subscriptions
- **Broader Scope**: Suitable for dashboard/monitoring use cases requiring full conversation view
- **Resource Intensive**: More data per notification, consider bandwidth implications

**Implementation Location**: 
- Not currently implemented (future use)
- Would require similar subscription pattern to existing notification types

## Future Enhancement Opportunities

1. **Error Recovery**: Auto-reconnection for dropped connections
2. **Performance**: Message queuing and batch processing  
3. **Monitoring**: Health checks and connection monitoring
4. **Configuration**: Dynamic configuration without URL params
5. **Testing**: Automated test suite for communication flows
6. **Documentation**: API documentation for iframe integration

---

*Last Updated: 2024 - Generated for development reference*