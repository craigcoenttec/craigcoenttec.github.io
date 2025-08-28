/**
 * Iframe Communication Wrapper - Learning Demo
 * 
 * This class demonstrates how to communicate with an iframe using the postMessage API,
 * similar to how the AA (Agent Assist) application communicates with its embedded iframe.
 * 
 * Key Concepts:
 * - postMessage: Secure way to send data between windows/frames
 * - Origin validation: Security feature to verify message source
 * - Event listeners: Handle incoming messages from iframe
 * - Structured messaging: Consistent message format with topic and details
 */
class IframeCommunicationWrapper {
    
    /**
     * Constructor - Sets up the communication wrapper
     * @param {Object} config - Configuration object
     * @param {string} config.targetOrigin - Target origin for security (use '*' for demo, specific domain in production)
     * @param {Function} config.onMessageReceived - Callback when message received from iframe
     * @param {Function} config.onConnectionEstablished - Callback when connection is established
     * @param {Function} config.onConversationIdChanged - Callback when conversation ID changes
     * @param {Function} config.onAudiohookMessage - Callback when AudioHook message received
     * @param {Function} config.onAudiohookStatusChanged - Callback when AudioHook connection status changes
     * @param {Function} config.onGcTranscriptionMessage - Callback when Genesys Cloud transcription message received
     * @param {Function} config.onGcAuthStatusChanged - Callback when Genesys Cloud auth status changes
     * @param {Function} config.onGcTranscriptionStatusChanged - Callback when Genesys Cloud transcription status changes
     * @param {Function} config.onGcConversationNotification - Callback when Genesys Cloud conversation notification received
     * @param {Function} config.onGcConversationStatusChanged - Callback when Genesys Cloud conversation notifications status changes
     * @param {Function} config.onGcMessageStatusChanged - Callback when Genesys Cloud message notifications status changes
     * @param {Function} config.onConversationTrackingUpdate - Callback when tracked conversations list changes
     * @param {Function} config.onActiveConversationChanged - Callback when the most recent active conversation changes
     * @param {Function} config.onNewNotesReceived - Callback when new notes are received from iframe
     * @param {Function} config.onMessageTracked - Callback when a new message is tracked
     */
    constructor(config) {
        // Store configuration
        this.targetOrigin = config.targetOrigin || '*';
        this.onMessageReceived = config.onMessageReceived || function() {};
        this.onConnectionEstablished = config.onConnectionEstablished || function() {};
        this.onConversationIdChanged = config.onConversationIdChanged || function() {};
        this.onAudiohookMessage = config.onAudiohookMessage || function() {};
        this.onAudiohookStatusChanged = config.onAudiohookStatusChanged || function() {};
        this.onGcTranscriptionMessage = config.onGcTranscriptionMessage || function() {};
        this.onGcAuthStatusChanged = config.onGcAuthStatusChanged || function() {};
        this.onGcTranscriptionStatusChanged = config.onGcTranscriptionStatusChanged || function() {};
        this.onGcConversationNotification = config.onGcConversationNotification || function() {};
        this.onGcConversationStatusChanged = config.onGcConversationStatusChanged || function() {};
        this.onGcMessageStatusChanged = config.onGcMessageStatusChanged || function() {};
        this.onConversationTrackingUpdate = config.onConversationTrackingUpdate || function() {};
        this.onActiveConversationChanged = config.onActiveConversationChanged || function() {};
        this.onNewNotesReceived = config.onNewNotesReceived || function() {};
        this.onMessageTracked = config.onMessageTracked || function() {};
        
        // Internal state
        this.iframeElement = null;
        this.isConnected = false;
        this.accessToken = null;
        this.currentConversationId = null;
        this.contactCenterConversationId = null;
        
        // AudioHook WebSocket state
        this.audiohookWebSocket = null;
        this.audiohookUrl = null;
        this.audiohookInitConversationId = null; // Store conversation ID for init message
        this.audiohookConnected = false;
        this.audiohookReconnectAttempts = 0;
        this.maxAudiohookReconnectAttempts = 5;
        this.audiohookReconnectDelay = 5000; // 5 seconds
        this.audiohookPingInterval = null;
        this.audiohookManualDisconnect = false; // Track if disconnect was manual
        
        // Genesys Cloud state
        this.gcPlatformClient = null;
        this.gcClient = null;
        this.gcNotificationsApi = null;
        this.gcUsersApi = null;
        this.gcAuthenticated = false;
        this.gcChannelId = null;
        this.gcWebSocket = null; // Single WebSocket for all GC notifications
        this.gcWebSocketConnected = false;
        this.gcSubscribedTopics = new Set(); // Track which topics are subscribed
        this.gcTranscriptionConnected = false; // Track if transcription is actively wanted
        this.gcRegion = null;
        this.gcClientId = null;
        this.gcRedirectUrl = null;
        this.gcConversationId = null;
        this.gcUserId = null;
        
        // Conversation notifications state
        this.gcConversationNotificationsConnected = false;
        this.gcConversationNotificationsUserId = null;
        
        // Message notifications state
        this.gcMessageNotificationsConnected = false;
        this.gcMessageNotificationsUserId = null;
        
        // Conversation tracking
        this.trackedConversations = new Map(); // conversationId -> conversation object
        this.mostRecentActiveConversationId = null; // Track the most recent active conversation
        
        // Message tracking
        this.trackedMessages = new Map(); // messageId -> message details
        this.messageTrackingCallback = null; // Callback for UI updates
        this.lastWorkflowMessageTime = new Map(); // conversationId -> timestamp of last workflow message
        
        // Auto-forwarding settings
        this.autoForwardTranscription = true; // Default to enabled
        this.autoForwardAudiohook = true; // Default to enabled
        this.autoForwardMessages = true; // Default to enabled
        
        // Message filtering settings
        this.filterWorkflowMessages = true; // Default to enabled (exclude workflow messages)
        
        // Automated call handling settings
        this.autoHandleIncomingCalls = true; // Default to enabled
        this.autoCallSequenceInProgress = false; // Track if auto sequence is running
        
        // Bind the message handlers to preserve 'this' context
        this.handleReceivedMessage = this.handleReceivedMessage.bind(this);
        this.handleAudiohookMessage = this.handleAudiohookMessage.bind(this);
        this.handleAudiohookOpen = this.handleAudiohookOpen.bind(this);
        this.handleAudiohookClose = this.handleAudiohookClose.bind(this);
        this.handleAudiohookError = this.handleAudiohookError.bind(this);
        
        console.log('IframeCommunicationWrapper created with config:', config);
    }
    
    /**
     * Initialize the wrapper with an iframe element
     * @param {HTMLIFrameElement} iframeElement - The iframe to communicate with
     */
    initialize(iframeElement) {
        console.log('Initializing iframe communication...');
        
        this.iframeElement = iframeElement;
        
        // Set up message listener for messages from iframe
        window.addEventListener('message', this.handleReceivedMessage);
        
        // Wait for iframe to load before considering connection established
        iframeElement.addEventListener('load', () => {
            this.isConnected = true;
            this.onConnectionEstablished();
        });
        
        console.log('Iframe communication initialized');
    }
    
    /**
     * Send a structured message to the iframe
     * @param {string} messageType - The type of message (topic)
     * @param {Object} messageDetails - The data to send with the message
     */
    sendMessageToIframe(messageType, messageDetails = null) {
        console.log('Sending message to iframe:', messageType, messageDetails);
        
        // Check if iframe is available
        if (!this.iframeElement || !this.iframeElement.contentWindow) {
            console.warn('Iframe or iframe.contentWindow is not available');
            return;
        }
        
        // Create the structured message
        const messageToSend = {
            topic: messageType,
            details: messageDetails,
            timestamp: new Date().toISOString(),
            source: 'parent-window'
        };
        
        // Send the message using postMessage
        this.iframeElement.contentWindow.postMessage(messageToSend, this.targetOrigin);
        
        console.log('Message sent successfully');
    }
    
    /**
     * Handle messages received from the iframe
     * @param {MessageEvent} messageEvent - The message event from iframe
     */
    handleReceivedMessage(messageEvent) {
        console.log('Message received from iframe:', messageEvent.data);
        
        // Basic origin validation (in production, use specific domain)
        if (this.targetOrigin !== '*' && messageEvent.origin !== this.targetOrigin) {
            console.warn('Origin mismatch. Expected:', this.targetOrigin, 'Received:', messageEvent.origin);
            return;
        }
        
        // Extract message data
        const receivedMessage = messageEvent.data;
        
        // Handle different message types
        if (receivedMessage && typeof receivedMessage === 'object' && receivedMessage.topic) {
            this.processIncomingMessage(receivedMessage);
        } else {
            console.log('Received non-structured message:', receivedMessage);
        }
        
        // Call the user-provided callback
        this.onMessageReceived(receivedMessage);
    }
    
    /**
     * Process different types of incoming messages from iframe
     * @param {Object} message - The structured message from iframe
     */
    processIncomingMessage(message) {
        const messageType = message.topic;
        const messageDetails = message.details;
        const isSuccess = message.success;
        const errorInfo = message.error;
        
        switch (messageType) {
            case 'authorized':
                this.handleAuthorizationResponse(messageDetails, isSuccess, errorInfo);
                break;
                
            case 'conversation-joined':
                this.handleConversationJoinedResponse(messageDetails, isSuccess, errorInfo);
                break;
                
            case 'conversation-left':
                this.handleConversationLeftResponse(messageDetails, isSuccess, errorInfo);
                break;
                
            case 'content-analyzed':
                this.handleContentAnalyzedResponse(messageDetails, isSuccess, errorInfo);
                break;
                
            case 'new-notes-received':
                this.handleNewNotesReceived(messageDetails, isSuccess, errorInfo);
                break;
                
            default:
                console.log('Unknown message type received:', messageType);
        }
    }
    
    // ==============================================
    // AUTHORIZATION FUNCTIONS
    // ==============================================
    
    /**
     * Send authorization request to iframe
     */
    sendAuthorizationRequest() {
        console.log('Requesting authorization from iframe...');
        
        const authRequestDetails = {
            requestId: 'auth-' + Date.now(),
            clientId: 'demo-client-123',
            organizationId: 'demo-org-456'
        };
        
        this.sendMessageToIframe('authorize', authRequestDetails);
    }
    
    /**
     * Handle authorization response from iframe
     * @param {Object} responseDetails - Authorization response details
     * @param {boolean} isSuccess - Whether authorization was successful
     * @param {Object} errorInfo - Error information if authorization failed
     */
    handleAuthorizationResponse(responseDetails, isSuccess, errorInfo) {
        console.log('Processing authorization response...');
        
        if (!isSuccess) {
            console.error('Authorization failed:', errorInfo);
            return;
        }
        
        // Extract and store the access token
        if (responseDetails && responseDetails.sso && responseDetails.sso.access_token) {
            this.accessToken = responseDetails.sso.access_token;
            console.log('Access token received and stored');
        }
        
        console.log('Authorization successful');
    }
    
    // ==============================================
    // CONVERSATION MANAGEMENT FUNCTIONS
    // ==============================================
    
    /**
     * Send join conversation request to iframe
     * @param {string} conversationId - The conversation ID to join
     * @param {string} conversationProfileId - The conversation profile ID
     * @param {string} contactName - The contact's name
     * @param {string} contactEmail - The contact's email address
     * @param {string} contactPhone - The contact's phone number
     */
    sendJoinConversation(conversationId, conversationProfileId, contactName, contactEmail, contactPhone) {
        console.log('Requesting to join conversation:', conversationId);
        
        const joinDetails = {
            contact_center_conversation_id: conversationId,
            conversation_profile_id: conversationProfileId,
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone
        };
        
        this.sendMessageToIframe('join-conversation', joinDetails);
    }
    
    /**
     * Send activate conversation request to iframe
     * @param {string} conversationId - The conversation ID to activate
     */
    sendActivateConversation(conversationId) {
        console.log('Requesting to activate conversation:', conversationId);
        
        const activateDetails = {
            conversation_id: conversationId,
            requestId: 'activate-' + Date.now()
        };
        
        this.sendMessageToIframe('activate-conversation', activateDetails);
    }
    
    /**
     * Send leave conversation request to iframe
     * @param {string} conversationId - The conversation ID to leave (from iframe join response)
     */
    sendLeaveConversation(conversationId) {
        console.log('Requesting to leave conversation:', conversationId);
        
        const leaveDetails = {
            conversation_id: conversationId
        };
        
        this.sendMessageToIframe('leave-conversation', leaveDetails);
    }
    
    /**
     * Handle conversation joined response from iframe
     * @param {Object} responseDetails - Join conversation response details
     * @param {boolean} isSuccess - Whether joining was successful
     * @param {Object} errorInfo - Error information if joining failed
     */
    handleConversationJoinedResponse(responseDetails, isSuccess, errorInfo) {
        console.log('Processing conversation joined response...');
        
        if (!isSuccess) {
            console.error('Conversation join failed:', errorInfo);
            return;
        }
        
        // Extract conversation info from the response
        // Expected format: { conversation: { id: "0198e63c-a5ee-73dc-9a91-e8b6ab58b61e", contact_center_conversation_id: "qrvn6sjly4a74x07" } }
        if (responseDetails && responseDetails.conversation) {
            this.currentConversationId = responseDetails.conversation.id;
            this.contactCenterConversationId = responseDetails.conversation.contact_center_conversation_id;
            
            console.log('Successfully joined conversation:');
            console.log('  - AA Conversation ID:', this.currentConversationId);
            console.log('  - GC Contact Center ID:', this.contactCenterConversationId);
            
            // Associate the AA conversation ID with the most recent active GC conversation
            const activeGcConversationId = this.getMostRecentActiveConversationId();
            if (activeGcConversationId) {
                console.log(`Associating AA conversation ${this.currentConversationId} with active GC conversation ${activeGcConversationId}`);
                this.associateAgentAssistConversation(activeGcConversationId, this.currentConversationId);
            } else {
                console.warn('No active GC conversation found to associate with AA conversation:', this.currentConversationId);
            }
            
            // Notify the UI about the conversation ID change
            this.onConversationIdChanged(this.currentConversationId);
            
            // Automatically activate the conversation after joining
            this.sendActivateConversation(this.currentConversationId);
        } else {
            console.warn('No conversation object found in join response:', responseDetails);
        }
    }
    
    /**
     * Handle conversation left response from iframe
     * @param {Object} responseDetails - Leave conversation response details
     * @param {boolean} isSuccess - Whether leaving was successful
     * @param {Object} errorInfo - Error information if leaving failed
     */
    handleConversationLeftResponse(responseDetails, isSuccess, errorInfo) {
        console.log('Processing conversation left response...');
        
        if (!isSuccess) {
            console.error('Conversation leave failed:', errorInfo);
            return;
        }
        
        // Find and remove Agent Assist association from any tracked GC conversations
        if (this.currentConversationId) {
            const associatedConversation = this.findConversationByAAId(this.currentConversationId);
            if (associatedConversation) {
                console.log(`Removing AA association from GC conversation ${associatedConversation.id}`);
                this.removeAgentAssistConversation(associatedConversation.id);
            }
        }
        
        // Clear current conversation info
        this.currentConversationId = null;
        this.contactCenterConversationId = null;
        
        // Notify the UI about the conversation ID change (cleared)
        this.onConversationIdChanged(null);
        
        console.log('Successfully left conversation');
        console.log('Leave response details:', responseDetails);
    }
    
    // ==============================================
    // CONTENT ANALYSIS FUNCTIONS
    // ==============================================
    
    /**
     * Send analyze content request to iframe
     * @param {string} conversationId - The conversation ID
     * @param {string} messageContent - The message content to analyze
     * @param {string} speakerType - Who spoke: 'HUMAN_AGENT' or 'END_USER'
     */
    sendAnalyzeContent(conversationId, messageContent, speakerType) {
        console.log('Requesting content analysis for message:', messageContent);
        
        const analyzeDetails = {
            conversationId: conversationId,
            participantType: speakerType,
            textInput: {
                text: messageContent
            }
        };
        
        this.sendMessageToIframe('analyze-content', analyzeDetails);
    }
    
    /**
     * Handle content analyzed response from iframe
     * @param {Object} responseDetails - Content analysis response details
     * @param {boolean} isSuccess - Whether analysis was successful
     * @param {Object} errorInfo - Error information if analysis failed
     */
    handleContentAnalyzedResponse(responseDetails, isSuccess, errorInfo) {
        console.log('Processing content analysis response...');
        
        if (!isSuccess) {
            console.error('Content analysis failed:', errorInfo);
            return;
        }
        
        console.log('Content analysis completed successfully');
        console.log('Analysis response details:', responseDetails);
        // In a real app, you might display suggestions, insights, etc.
    }
    
    /**
     * Handle new notes received from iframe
     * @param {Object} responseDetails - New notes response details
     * @param {boolean} isSuccess - Whether receiving notes was successful
     * @param {Object} errorInfo - Error information if notes failed
     */
    handleNewNotesReceived(responseDetails, isSuccess, errorInfo) {
        console.log('Processing new notes received...');
        
        if (!isSuccess) {
            console.error('New notes reception failed:', errorInfo);
            return;
        }
        
        console.log('New notes received successfully');
        console.log('Notes details:', responseDetails);
        
        // Call the callback to update the UI
        this.onNewNotesReceived(responseDetails);
    }
    
    // ==============================================
    // CONVERSATION WRAP-UP FUNCTIONS
    // ==============================================
    
    /**
     * Send wrap conversation request to iframe
     * @param {string} conversationId - The conversation ID to wrap up (from iframe join response)
     */
    sendWrapConversation(conversationId) {
        console.log('Requesting to wrap conversation:', conversationId);
        
        const wrapDetails = {
            conversation_id: conversationId
        };
        
        this.sendMessageToIframe('wrap-conversation', wrapDetails);
    }
    
    // ==============================================
    // AUDIOHOOK WEBSOCKET FUNCTIONS
    // ==============================================
    
    /**
     * Connect to AudioHook WebSocket service
     * @param {string} audiohookUrl - The AudioHook WebSocket URL to connect to
     * @param {string} conversationId - The conversation ID to initialize AudioHook with
     */
    connectToAudiohook(audiohookUrl, conversationId = null) {
        console.log('Connecting to AudioHook WebSocket:', audiohookUrl, 'with conversation ID:', conversationId);
        
        // Store the URL and conversation ID for reconnection attempts
        this.audiohookUrl = audiohookUrl;
        this.audiohookInitConversationId = conversationId; // Store for init message
        
        // Reset manual disconnect flag since this is an intentional connect
        this.audiohookManualDisconnect = false;
        
        // Close existing connection if any (non-manual since we're reconnecting)
        if (this.audiohookWebSocket) {
            this.disconnectFromAudiohook(false);
        }
        
        try {
            // Create new WebSocket connection
            this.audiohookWebSocket = new WebSocket(audiohookUrl);
            
            // Set up event handlers
            this.audiohookWebSocket.onopen = this.handleAudiohookOpen;
            this.audiohookWebSocket.onmessage = this.handleAudiohookMessage;
            this.audiohookWebSocket.onclose = this.handleAudiohookClose;
            this.audiohookWebSocket.onerror = this.handleAudiohookError;
            
            // Update status
            this.onAudiohookStatusChanged('Connecting...');
            
        } catch (error) {
            console.error('Failed to create AudioHook WebSocket connection:', error);
            this.onAudiohookStatusChanged('Connection Failed');
        }
    }
    
    /**
     * Disconnect from AudioHook WebSocket service
     * @param {boolean} isManual - Whether this is a manual disconnect (prevents reconnection)
     */
    disconnectFromAudiohook(isManual = true) {
        console.log('Disconnecting from AudioHook WebSocket...');
        
        // Set manual disconnect flag to prevent reconnection
        if (isManual) {
            this.audiohookManualDisconnect = true;
        }
        
        if (this.audiohookWebSocket) {
            // Clear ping interval
            if (this.audiohookPingInterval) {
                clearInterval(this.audiohookPingInterval);
                this.audiohookPingInterval = null;
            }
            
            // Close WebSocket connection with normal closure code
            this.audiohookWebSocket.close(1000, 'Manual disconnect');
            this.audiohookWebSocket = null;
        }
        
        // Reset connection state
        this.audiohookConnected = false;
        this.audiohookReconnectAttempts = 0;
        this.onAudiohookStatusChanged('Disconnected');
        
        console.log('AudioHook WebSocket disconnected');
    }
    
    /**
     * Handle AudioHook WebSocket connection opened
     * @param {Event} event - WebSocket open event
     */
    handleAudiohookOpen(event) {
        console.log('AudioHook WebSocket connection opened');
        
        // Update connection state
        this.audiohookConnected = true;
        this.audiohookReconnectAttempts = 0;
        this.onAudiohookStatusChanged('Connected');
        
        // Send initialization message if we have a conversation ID (prioritize the init ID from connect)
        const conversationIdToUse = this.audiohookInitConversationId || this.contactCenterConversationId;
        if (conversationIdToUse) {
            const initMessage = {
                type: 'init',
                targetConvId: conversationIdToUse
            };
            
            console.log('Sending AudioHook init message:', initMessage);
            this.audiohookWebSocket.send(JSON.stringify(initMessage));
        } else {
            console.log('No conversation ID available for AudioHook initialization');
        }
        
        // Set up ping interval to keep connection alive
        this.audiohookPingInterval = setInterval(() => {
            if (this.audiohookWebSocket && this.audiohookWebSocket.readyState === WebSocket.OPEN) {
                const pingMessage = { ping: 1 };
                this.audiohookWebSocket.send(JSON.stringify(pingMessage));
                console.log('Sent AudioHook ping');
            }
        }, 10000); // Ping every 10 seconds
    }
    
    /**
     * Handle AudioHook WebSocket message received
     * @param {MessageEvent} event - WebSocket message event
     */
    handleAudiohookMessage(event) {
        console.log('AudioHook WebSocket message received:', event.data);
        
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(event.data);
        } catch (error) {
            console.error('Failed to parse AudioHook message:', event.data, error);
            this.onAudiohookMessage({
                type: 'parse_error',
                rawData: event.data,
                error: error.message
            });
            return;
        }
        
        // Handle pong responses (keepalive)
        if (parsedMessage.pong !== undefined) {
            console.log('Received AudioHook pong response');
            return;
        }
        
        // Process the message and notify UI
        this.onAudiohookMessage(parsedMessage);
        
        // If this is a conversation message, automatically send to iframe for analysis if enabled
        if (this.autoForwardAudiohook && 
            parsedMessage.type === 'message' && 
            typeof parsedMessage.content === 'string' && 
            parsedMessage.content.trim() !== '' && 
            this.currentConversationId) {
            
            console.log('Auto-forwarding AudioHook message to iframe for analysis');
            
            // Determine participant type based on channel
            const participantType = parsedMessage.channel === 'internal' ? 'HUMAN_AGENT' : 'END_USER';
            
            // Send to iframe for analysis
            this.sendAnalyzeContent(this.currentConversationId, parsedMessage.content, participantType);
        }
    }
    
    /**
     * Handle AudioHook WebSocket connection closed
     * @param {CloseEvent} event - WebSocket close event
     */
    handleAudiohookClose(event) {
        console.log(`AudioHook WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
        
        // Clear ping interval
        if (this.audiohookPingInterval) {
            clearInterval(this.audiohookPingInterval);
            this.audiohookPingInterval = null;
        }
        
        // Update connection state
        this.audiohookConnected = false;
        
        // Only attempt reconnection if:
        // 1. It was not a manual disconnect
        // 2. It was not a normal closure (code 1000)
        // 3. We haven't exceeded max retry attempts
        // 4. We have a URL to reconnect to
        if (!this.audiohookManualDisconnect &&
            event.code !== 1000 && // 1000 = normal closure
            this.audiohookReconnectAttempts < this.maxAudiohookReconnectAttempts && 
            this.audiohookUrl) {
            
            this.audiohookReconnectAttempts++;
            this.onAudiohookStatusChanged(`Reconnecting... (${this.audiohookReconnectAttempts}/${this.maxAudiohookReconnectAttempts})`);
            
            console.log(`Attempting AudioHook reconnection ${this.audiohookReconnectAttempts}/${this.maxAudiohookReconnectAttempts}...`);
            
            setTimeout(() => {
                // Double-check that we still want to reconnect and haven't manually disconnected
                if (this.audiohookUrl && !this.audiohookConnected && !this.audiohookManualDisconnect) {
                    this.connectToAudiohook(this.audiohookUrl, this.audiohookInitConversationId);
                }
            }, this.audiohookReconnectDelay);
            
        } else if (this.audiohookReconnectAttempts >= this.maxAudiohookReconnectAttempts) {
            console.log('AudioHook maximum reconnection attempts reached');
            this.onAudiohookStatusChanged('Disconnected (Max retries exceeded)');
        } else if (this.audiohookManualDisconnect) {
            console.log('AudioHook was manually disconnected - no reconnection attempt');
            this.onAudiohookStatusChanged('Disconnected');
        } else {
            this.onAudiohookStatusChanged('Disconnected');
        }
    }
    
    /**
     * Handle AudioHook WebSocket error
     * @param {Event} event - WebSocket error event
     */
    handleAudiohookError(event) {
        console.error('AudioHook WebSocket error:', event);
        this.onAudiohookStatusChanged('Error');
        
        // Log the error for the UI
        this.onAudiohookMessage({
            type: 'connection_error',
            message: 'WebSocket connection error occurred',
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Get AudioHook connection status
     * @returns {boolean} - Whether AudioHook is connected
     */
    isAudiohookConnected() {
        return this.audiohookConnected && 
               this.audiohookWebSocket && 
               this.audiohookWebSocket.readyState === WebSocket.OPEN;
    }
    
    /**
     * Send a message to AudioHook WebSocket (for testing purposes)
     * @param {Object} message - The message to send
     */
    sendAudiohookMessage(message) {
        if (this.isAudiohookConnected()) {
            console.log('Sending message to AudioHook:', message);
            this.audiohookWebSocket.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send AudioHook message - not connected');
        }
    }

    // ==============================================
    // GENESYS CLOUD TRANSCRIPTION FUNCTIONS
    // ==============================================
    
    /**
     * Initialize Genesys Cloud Platform Client
     * @param {string} region - The Genesys Cloud region (e.g., 'mypurecloud.com')
     * @param {string} clientId - The OAuth client ID
     * @param {string} redirectUrl - The redirect URL for OAuth
     */
    initializeGenesysCloud(region, clientId, redirectUrl) {
        console.log('Initializing Genesys Cloud Platform Client...');
        
        // Store configuration
        this.gcRegion = region;
        this.gcClientId = clientId;
        this.gcRedirectUrl = redirectUrl;
        
        // Check if platformClient is available (try multiple possible global names)
        let platformClientRef = null;
        if (typeof platformClient !== 'undefined') {
            platformClientRef = platformClient;
        } else if (typeof window !== 'undefined' && window.platformClient) {
            platformClientRef = window.platformClient;
        } else if (typeof require !== 'undefined') {
            try {
                platformClientRef = require('platformClient');
            } catch (e) {
                console.log('Could not require platformClient');
            }
        }
        
        if (!platformClientRef) {
            console.error('PureCloud Platform Client SDK not loaded. Please ensure the SDK script is included.');
            this.onGcAuthStatusChanged('SDK Not Loaded');
            return false;
        }
        
        try {
            // Initialize Platform Client
            this.gcPlatformClient = platformClientRef;
            this.gcClient = this.gcPlatformClient.ApiClient.instance;
            this.gcNotificationsApi = new this.gcPlatformClient.NotificationsApi();
            this.gcUsersApi = new this.gcPlatformClient.UsersApi();
            
            // Set environment
            this.gcClient.setEnvironment(region);
            this.gcClient.setPersistSettings(true, 'iframe_demo_');
            
            console.log('Genesys Cloud Platform Client initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Genesys Cloud Platform Client:', error);
            this.onGcAuthStatusChanged('Initialization Failed');
            return false;
        }
    }
    
    /**
     * Authenticate with Genesys Cloud using OAuth implicit grant
     */
    async authenticateGenesysCloud() {
        console.log('Authenticating with Genesys Cloud...');
        
        if (!this.gcClient) {
            console.error('Genesys Cloud Platform Client not initialized');
            this.onGcAuthStatusChanged('Not Initialized');
            return false;
        }
        
        try {
            this.onGcAuthStatusChanged('Authenticating...');
            
            // Perform OAuth login
            await this.gcClient.loginImplicitGrant(this.gcClientId, this.gcRedirectUrl, {});
            
            // Get current user info
            const user = await this.gcUsersApi.getUsersMe({});
            this.gcUserId = user.id;
            
            // Auto-populate the GC User ID input field on the form
            if (typeof document !== 'undefined') {
                const gcUserIdInput = document.getElementById('gcUserIdInput');
                if (gcUserIdInput) {
                    gcUserIdInput.value = user.id;
                    console.log(`Auto-populated GC User ID field with: ${user.id}`);
                }
            }
            
            console.log('Genesys Cloud authentication successful. User:', user.name);
            this.gcAuthenticated = true;
            this.onGcAuthStatusChanged(`Authenticated as ${user.name}`);
            
            return true;
            
        } catch (error) {
            console.error('Genesys Cloud authentication failed:', error);
            this.gcAuthenticated = false;
            this.onGcAuthStatusChanged('Authentication Failed');
            return false;
        }
    }
    
    /**
     * Connect to Genesys Cloud transcription WebSocket
     * @param {string} conversationId - The conversation ID to subscribe to transcription
     */
    async connectToGcTranscription(conversationId) {
        console.log('Connecting to Genesys Cloud transcription for conversation:', conversationId);
        
        if (!this.gcAuthenticated) {
            console.error('Not authenticated with Genesys Cloud');
            this.onGcTranscriptionStatusChanged('Not Authenticated');
            return false;
        }
        
        this.gcConversationId = conversationId;
        this.gcTranscriptionConnected = true; // Mark that transcription is wanted
        
        try {
            this.onGcTranscriptionStatusChanged('Connecting...');
            
            // Create or reuse notification channel
            await this.createOrReuseNotificationChannel();
            
            // Subscribe to transcription topic
            const transcriptionTopic = `v2.conversations.${conversationId}.transcription`;
            await this.subscribeToGcTopic(transcriptionTopic);
            
            // Ensure WebSocket connection
            await this.ensureGcWebSocketConnection();
            
            // Update status to connected since we've successfully set up transcription
            this.onGcTranscriptionStatusChanged('Connected');
            
            return true;
            
        } catch (error) {
            console.error('Failed to connect to Genesys Cloud transcription:', error);
            this.gcTranscriptionConnected = false;
            this.onGcTranscriptionStatusChanged('Connection Failed');
            return false;
        }
    }
    
    /**
     * Create or reuse existing notification channel
     */
    async createOrReuseNotificationChannel() {
        // Check if we already have a stored channel ID
        const storedChannelId = sessionStorage.getItem('gc_demo_channel_id');
        
        if (storedChannelId) {
            console.log('Reusing existing notification channel:', storedChannelId);
            this.gcChannelId = storedChannelId;
        } else {
            console.log('Creating new notification channel...');
            const channel = await this.gcNotificationsApi.postNotificationsChannels();
            this.gcChannelId = channel.id;
            sessionStorage.setItem('gc_demo_channel_id', this.gcChannelId);
            console.log('Created notification channel:', this.gcChannelId);
        }
    }
    
    /**
     * Create or ensure single WebSocket connection for all Genesys Cloud notifications
     */
    async ensureGcWebSocketConnection() {
        // If WebSocket already exists and is connected, do nothing
        if (this.gcWebSocket && this.gcWebSocket.readyState === WebSocket.OPEN) {
            console.log('Genesys Cloud WebSocket already connected');
            return;
        }
        
        // If WebSocket exists but is not open, clean it up
        if (this.gcWebSocket) {
            this.gcWebSocket.close();
            this.gcWebSocket = null;
        }
        
        const websocketUrl = `wss://streaming.${this.gcRegion}/channels/${this.gcChannelId}`;
        console.log('Creating Genesys Cloud WebSocket:', websocketUrl);
        
        this.gcWebSocket = new WebSocket(websocketUrl);
        
        this.gcWebSocket.onopen = () => {
            console.log('Genesys Cloud WebSocket connected');
            this.gcWebSocketConnected = true;
            
            // Update transcription status only if transcription is actually wanted
            if (this.gcTranscriptionConnected) {
                this.onGcTranscriptionStatusChanged('Connected');
                console.log('Transcription status updated to Connected');
            }
        };
        
        this.gcWebSocket.onmessage = (event) => {
            this.handleGcMessages(event);
        };
        
        this.gcWebSocket.onclose = (event) => {
            console.log('Genesys Cloud WebSocket closed:', event.reason);
            this.gcWebSocketConnected = false;
            
            // Update transcription status only if transcription was actually connected
            if (this.gcTranscriptionConnected) {
                this.onGcTranscriptionStatusChanged('Disconnected');
                console.log('Transcription status updated to Disconnected');
            }
        };
        
        this.gcWebSocket.onerror = (error) => {
            console.error('Genesys Cloud WebSocket error:', error);
            this.gcWebSocketConnected = false;
            
            // Update transcription status only if transcription was actually connected
            if (this.gcTranscriptionConnected) {
                this.onGcTranscriptionStatusChanged('Error');
                console.log('Transcription status updated to Error');
            }
        };
        
        console.log(`Waiting for GC events on ${websocketUrl}`);
    }
    
    /**
     * Subscribe to a topic on the Genesys Cloud notification channel
     * @param {string} topicId - The topic ID to subscribe to
     */
    async subscribeToGcTopic(topicId) {
        if (this.gcSubscribedTopics.has(topicId)) {
            console.log(`Already subscribed to topic: ${topicId}`);
            return;
        }
        
        console.log(`Subscribing to GC topic: ${topicId}`);
        
        await this.gcNotificationsApi.postNotificationsChannelSubscriptions(
            this.gcChannelId, 
            [{ id: topicId }]
        );
        
        this.gcSubscribedTopics.add(topicId);
        console.log(`Successfully subscribed to topic: ${topicId}`);
    }
    
    /**
     * Unsubscribe from a topic on the Genesys Cloud notification channel
     * @param {string} topicId - The topic ID to unsubscribe from
     */
    async unsubscribeFromGcTopic(topicId) {
        if (!this.gcSubscribedTopics.has(topicId)) {
            console.log(`Not subscribed to topic: ${topicId}`);
            return;
        }
        
        console.log(`Unsubscribing from GC topic: ${topicId}`);
        
        // Note: Genesys Cloud doesn't have a direct unsubscribe API
        // Topics are automatically removed when not renewed
        this.gcSubscribedTopics.delete(topicId);
        console.log(`Removed topic from local tracking: ${topicId}`);
    }
    
    /**
     * Handle incoming Genesys Cloud messages (transcription, conversations, etc.)
     * @param {MessageEvent} event - The WebSocket message event
     */
    handleGcMessages(event) {
        console.log('Genesys Cloud transcription message received:', event.data);
        
        let messageData;
        try {
            messageData = JSON.parse(event.data);
        } catch (error) {
            console.error('Failed to parse Genesys Cloud message:', error);
            return;
        }
        
        // Handle heartbeat messages
        if (messageData?.eventBody?.message === 'WebSocket Heartbeat') {
            console.log('❤️ Genesys Cloud WebSocket Heartbeat');
            return;
        }
        
        // Check for SESSION_ENDED status to trigger wrap conversation
        if (messageData.topicName && messageData.topicName.includes('transcription') && 
            messageData.eventBody?.status?.status === 'SESSION_ENDED') {
            console.log('🏁 Session ended detected in transcription message - sending wrap conversation');
            
            // Send wrap conversation message to iframe if we have an active conversation
            if (this.currentConversationId) {
                this.sendWrapConversation(this.currentConversationId);
                
                // Log the event
                const wrapMessage = {
                    type: 'session_ended',
                    conversationId: messageData.eventBody.conversationId,
                    timestamp: messageData.eventBody.eventTime,
                    message: 'Session ended - wrap conversation sent automatically'
                };
                this.onGcTranscriptionMessage(wrapMessage);
            }
        }
        
        // Process transcription messages
        if (messageData.topicName && messageData.topicName.includes('transcription')) {
            console.log('Transcription notification received:', messageData);
            
            const transcriptionEvent = messageData.eventBody?.transcripts;
            if (transcriptionEvent && transcriptionEvent.length > 0) {
                const transcript = transcriptionEvent[0];
                const utterance = transcript.alternatives?.[0]?.transcript;
                
                if (utterance && utterance.trim()) {
                    // Determine participant type
                    const participantType = transcript.channel === 'EXTERNAL' ? 'END_USER' : 'HUMAN_AGENT';
                    
                    console.log(`${participantType} speaking: ${utterance}`);
                    
                    // Auto-forward to iframe for analysis if enabled and we have an active conversation
                    if (this.autoForwardTranscription && this.currentConversationId) {
                        console.log('Auto-forwarding GC transcription to iframe for analysis');
                        this.sendAnalyzeContent(this.currentConversationId, utterance, participantType);
                    }
                    
                    // Create structured message for UI
                    const transcriptionMessage = {
                        type: 'transcription',
                        channel: transcript.channel,
                        participantType: participantType,
                        utterance: utterance,
                        confidence: transcript.alternatives?.[0]?.confidence,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.onGcTranscriptionMessage(transcriptionMessage);
                }
            }
        }
        
        // Process conversation notifications (calls)
        if (messageData.topicName && messageData.topicName.includes('conversations.calls')) {
            console.log('Conversation notification received:', messageData);
            
            // Extract conversation and participant information
            const conversationId = messageData.eventBody?.id;
            const participants = messageData.eventBody?.participants;
            
            if (participants && participants.length > 0) {
                // Find the agent/user participant to get state information
                const agentParticipant = participants.find(p => p.purpose === 'agent' || p.purpose === 'user');
                
                if (agentParticipant) {
                    const participantState = agentParticipant.state;
                    const participantUserId = agentParticipant.user?.id;
                    
                    console.log(`Conversation ${conversationId} - Participant ${participantUserId} state: ${participantState}`);
                    
                    // Update conversation tracking
                    this.updateTrackedConversation(conversationId, participantState, participants, messageData);
                    
                    // Create structured message for UI
                    const conversationMessage = {
                        type: 'conversation_notification',
                        conversationId: conversationId,
                        participantUserId: participantUserId,
                        participantState: participantState,
                        participants: participants,
                        timestamp: new Date().toISOString(),
                        rawEvent: messageData
                    };
                    
                    this.onGcConversationNotification(conversationMessage);
                }
            } else {
                // Even if no specific participant info, still log the notification
                const conversationMessage = {
                    type: 'conversation_notification',
                    conversationId: conversationId,
                    timestamp: new Date().toISOString(),
                    rawEvent: messageData
                };
                
                this.onGcConversationNotification(conversationMessage);
            }
        }
        
        // Process message notifications 
        if (messageData.topicName && messageData.topicName.includes('conversations.messages')) {
            console.log('Message notification received:', messageData);
            
            // Extract conversation ID from event body
            const conversationId = messageData.eventBody?.id || 'unknown';
            const participants = messageData.eventBody?.participants || [];
            
            // Process and track messages from all participants
            this.processMessageNotifications(participants, conversationId, messageData);
            
            // Auto-populate conversation ID in the UI field when we receive messages
            if (conversationId && conversationId !== 'unknown') {
                // Check if the HTML function exists before calling it
                if (typeof window.updateActiveConversationId === 'function') {
                    window.updateActiveConversationId(conversationId);
                } else {
                    // Fallback: directly update the input field if the function doesn't exist
                    const gcConversationIdInput = document.getElementById('gcConversationIdInput');
                    if (gcConversationIdInput && !gcConversationIdInput.value) {
                        gcConversationIdInput.value = conversationId;
                        console.log(`Auto-populated GC Conversation ID from message: ${conversationId}`);
                    }
                }
            }
            
            // Create structured message for general UI logging
            const messageNotification = {
                type: 'message_notification',
                conversationId: conversationId,
                timestamp: new Date().toISOString(),
                rawEvent: messageData
            };
            
            console.log(`Message notification processed - Conversation: ${conversationId}`);
            
            // Forward to callback for UI display
            this.onGcConversationNotification(messageNotification);
        }
        
        // Forward non-specific messages (heartbeats, etc.) to transcription log for general logging
        // Only forward messages that aren't conversation calls, messages, or transcription events
        if (messageData.topicName && 
            !messageData.topicName.includes('conversations.calls') && 
            !messageData.topicName.includes('conversations.messages') && 
            !messageData.topicName.includes('transcription')) {
            this.onGcTranscriptionMessage(messageData);
        }
    }
    
    /**
     * Process message notifications and track individual messages
     * @param {Array} participants - Array of participant objects with messages
     * @param {string} conversationId - The conversation ID
     * @param {Object} rawEvent - The original event data
     */
    processMessageNotifications(participants, conversationId, rawEvent) {
        if (!participants || participants.length === 0) return;
        
        // Check for agent disconnect before processing messages
        participants.forEach(participant => {
            const participantPurpose = participant.purpose || 'unknown';
            const participantState = participant.state;
            const participantDisconnectType = participant.disconnectType;
            const participantEndTime = participant.endTime;
            const participantStartAcwTime = participant.startAcwTime;
            
            // Check if this is an agent who has disconnected
            if (participantPurpose === 'agent' && participantState === 'disconnected') {
                console.log('🔌 Agent disconnect detected in messaging conversation:', {
                    conversationId: conversationId,
                    participantId: participant.id,
                    participantName: participant.name || 'Unknown',
                    state: participantState,
                    disconnectType: participantDisconnectType,
                    endTime: participantEndTime,
                    startAcwTime: participantStartAcwTime
                });
                
                // Trigger wrap conversation automatically, similar to transcription session_end
                if (this.currentConversationId) {
                    console.log('🏁 Agent disconnected - sending wrap conversation automatically');
                    this.sendWrapConversation(this.currentConversationId);
                    
                    // Log the event for UI display
                    const wrapMessage = {
                        type: 'agent_disconnected',
                        conversationId: conversationId,
                        participantId: participant.id,
                        participantName: participant.name || 'Unknown',
                        timestamp: participantEndTime || new Date().toISOString(),
                        message: 'Agent disconnected - wrap conversation sent automatically'
                    };
                    this.onGcTranscriptionMessage(wrapMessage);
                } else {
                    console.log('⚠️ No current conversation ID available for wrap conversation');
                }
            }
        });
        
        participants.forEach(participant => {
            const participantId = participant.id;
            const participantName = participant.name || 'Unknown';
            const participantPurpose = participant.purpose || 'unknown';
            const messages = participant.messages || [];
            
            messages.forEach(messageData => {
                const message = messageData.message;
                const messageId = message?.id;
                const messageTime = messageData.messageTime;
                const messageStatus = messageData.messageStatus;
                const messageType = messageData.messageMetadata?.type || 'unknown';
                
                if (messageId && !this.trackedMessages.has(messageId)) {
                    // Track workflow message timestamps for filtering logic
                    if (participantPurpose === 'workflow') {
                        const currentTime = this.lastWorkflowMessageTime.get(conversationId);
                        if (!currentTime || new Date(messageTime) > new Date(currentTime)) {
                            this.lastWorkflowMessageTime.set(conversationId, messageTime);
                            console.log(`Updated last workflow message time for conversation ${conversationId}: ${messageTime}`);
                        }
                    }
                    
                    // Track new message
                    const trackedMessage = {
                        messageId: messageId,
                        conversationId: conversationId,
                        participantId: participantId,
                        participantName: participantName,
                        participantPurpose: participantPurpose,
                        messageTime: messageTime,
                        messageStatus: messageStatus,
                        messageType: messageType,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.trackedMessages.set(messageId, trackedMessage);
                    
                    console.log(`📨 New message tracked: ${messageId} from ${participantName} (${participantPurpose})`);
                    
                    // Notify UI immediately
                    this.onMessageTracked(trackedMessage);
                    
                    // Fetch message text asynchronously
                    this.getMessageText(conversationId, messageId).then(messageText => {
                        this.updateMessageText(messageId, messageText);
                        // Notify UI again with updated text
                        const updatedMessage = this.trackedMessages.get(messageId);
                        if (updatedMessage) {
                            this.onMessageTracked(updatedMessage);
                        }
                        
                        // Auto-forward to iframe for analysis if enabled and we have message text
                        if (this.autoForwardMessages && messageText && messageText.trim() && this.currentConversationId) {
                            // Enhanced filtering logic for workflow messages
                            let shouldSkip = false;
                            let skipReason = '';
                            
                            if (this.filterWorkflowMessages) {
                                // Skip workflow messages
                                if (participantPurpose === 'workflow') {
                                    shouldSkip = true;
                                    skipReason = 'workflow message';
                                } else {
                                    // Skip messages that occurred before the last workflow message
                                    const lastWorkflowTime = this.lastWorkflowMessageTime.get(conversationId);
                                    if (lastWorkflowTime && new Date(messageTime) <= new Date(lastWorkflowTime)) {
                                        shouldSkip = true;
                                        skipReason = `occurred before/during workflow phase (${messageTime} <= ${lastWorkflowTime})`;
                                    }
                                }
                            }
                            
                            if (shouldSkip) {
                                console.log(`Skipping message analysis (${skipReason}): ${messageText.substring(0, 50)}... from ${participantName} (${participantPurpose}) at ${messageTime}`);
                            } else {
                                // Determine participant type for analysis
                                const speakerType = participantPurpose === 'customer' ? 'END_USER' : 'HUMAN_AGENT';
                                
                                console.log(`Auto-forwarding message to iframe for analysis: ${messageText.substring(0, 50)}... from ${participantName} (${participantPurpose}) at ${messageTime}`);
                                this.sendAnalyzeContent(this.currentConversationId, messageText, speakerType);
                            }
                        }
                    }).catch(error => {
                        console.error(`❌ Failed to fetch text for message ${messageId}:`, error);
                    });
                }
            });
        });
    }
    
    /**
     * Get all tracked messages
     * @returns {Array} - Array of tracked message objects
     */
    getTrackedMessages() {
        return Array.from(this.trackedMessages.values());
    }
    
    /**
     * Get the message text from Genesys Cloud using conversation ID and message ID
     * @param {string} conversationId - The conversation ID
     * @param {string} messageId - The message ID
     * @returns {Promise<string>} - The message text or error message
     */
    async getMessageText(conversationId, messageId) {
        try {
            // Check if we have access to the platform client and are authenticated
            if (!this.gcClient || !this.gcAuthenticated) {
                console.log('⚠️ Cannot fetch message text: Not authenticated to Genesys Cloud');
                return 'Not authenticated';
            }
            
            const conversationsApi = new platformClient.ConversationsApi();
            const message = await conversationsApi.getConversationsMessageMessage(conversationId, messageId);
            
            if (message && message.normalizedMessage && message.normalizedMessage.text) {
                return message.normalizedMessage.text;
            } else {
                console.log('⚠️ No text found in message:', messageId);
                return 'No text content';
            }
        } catch (error) {
            console.error('❌ Error fetching message text:', error);
            return `Error: ${error.message || 'Unknown error'}`;
        }
    }

    /**
     * Update a tracked message with text content
     * @param {string} messageId - The message ID to update
     * @param {string} messageText - The message text content
     */
    updateMessageText(messageId, messageText) {
        if (this.trackedMessages.has(messageId)) {
            const message = this.trackedMessages.get(messageId);
            message.messageText = messageText;
            this.trackedMessages.set(messageId, message);
            console.log(`📝 Message text updated for: ${messageId}`);
        }
    }

    /**
     * Clear all tracked messages
     */
    clearTrackedMessages() {
        this.trackedMessages.clear();
        console.log('All tracked messages cleared');
    }
    
    /**
     * Disconnect from Genesys Cloud transcription
     */
    async disconnectFromGcTranscription() {
        console.log('Disconnecting from Genesys Cloud transcription...');
        
        // Unsubscribe from transcription topic
        if (this.gcConversationId) {
            const transcriptionTopic = `v2.conversations.${this.gcConversationId}.transcription`;
            await this.unsubscribeFromGcTopic(transcriptionTopic);
        }
        
        this.gcTranscriptionConnected = false;
        this.gcConversationId = null;
        this.onGcTranscriptionStatusChanged('Disconnected');
        
        // Close WebSocket only if no other subscriptions are active
        if (this.gcSubscribedTopics.size === 0 && this.gcWebSocket) {
            console.log('No remaining subscriptions, closing WebSocket');
            this.gcWebSocket.close(1000, 'No active subscriptions');
            this.gcWebSocket = null;
            this.gcWebSocketConnected = false;
        }
        
        console.log('Genesys Cloud transcription disconnected');
    }
    
    /**
     * Get Genesys Cloud authentication status
     * @returns {boolean} - Whether authenticated with Genesys Cloud
     */
    isGenesysCloudAuthenticated() {
        return this.gcAuthenticated && this.gcClient;
    }
    
    /**
     * Get Genesys Cloud transcription connection status
     * @returns {boolean} - Whether connected to transcription
     */
    isGcTranscriptionConnected() {
        return this.gcTranscriptionConnected && 
               this.gcWebSocket && 
               this.gcWebSocket.readyState === WebSocket.OPEN;
    }

    // ==============================================
    // GENESYS CLOUD CONVERSATION NOTIFICATIONS FUNCTIONS
    // ==============================================
    
    /**
     * Connect to Genesys Cloud conversation notifications for a specific user
     * @param {string} userId - The user ID to subscribe to conversation notifications for
     */
    async connectToGcConversationNotifications(userId) {
        console.log('Connecting to Genesys Cloud conversation notifications for user:', userId);
        
        if (!this.gcAuthenticated) {
            console.error('Not authenticated with Genesys Cloud');
            this.onGcConversationStatusChanged('Not Authenticated');
            return false;
        }
        
        this.gcConversationNotificationsUserId = userId;
        
        try {
            this.onGcConversationStatusChanged('Connecting...');
            
            // Create or reuse notification channel
            await this.createOrReuseNotificationChannel();
            
            // Subscribe to user conversation calls topic
            const userCallsTopic = `v2.users.${userId}.conversations.calls`;
            await this.subscribeToGcTopic(userCallsTopic);
            
            // Ensure WebSocket connection
            await this.ensureGcWebSocketConnection();
            
            this.gcConversationNotificationsConnected = true;
            this.onGcConversationStatusChanged('Connected');
            
            return true;
            
        } catch (error) {
            console.error('Failed to connect to Genesys Cloud conversation notifications:', error);
            this.onGcConversationStatusChanged('Connection Failed');
            return false;
        }
    }
    
    /**
     * Disconnect from Genesys Cloud conversation notifications
     */
    async disconnectFromGcConversationNotifications() {
        console.log('Disconnecting from Genesys Cloud conversation notifications...');
        
        // Unsubscribe from conversation topic
        if (this.gcConversationNotificationsUserId) {
            const userCallsTopic = `v2.users.${this.gcConversationNotificationsUserId}.conversations.calls`;
            await this.unsubscribeFromGcTopic(userCallsTopic);
        }
        
        this.gcConversationNotificationsConnected = false;
        this.gcConversationNotificationsUserId = null;
        this.onGcConversationStatusChanged('Disconnected');
        
        // Close WebSocket only if no other subscriptions are active
        if (this.gcSubscribedTopics.size === 0 && this.gcWebSocket) {
            console.log('No remaining subscriptions, closing WebSocket');
            this.gcWebSocket.close(1000, 'No active subscriptions');
            this.gcWebSocket = null;
            this.gcWebSocketConnected = false;
        }
        
        console.log('Genesys Cloud conversation notifications disconnected');
    }
    
    /**
     * Connect to Genesys Cloud message notifications for a specific user
     * @param {string} userId - The user ID to subscribe to message notifications for
     */
    async connectToGcMessageNotifications(userId) {
        console.log('Connecting to Genesys Cloud message notifications for user:', userId);
        
        if (!this.gcAuthenticated) {
            console.error('Not authenticated with Genesys Cloud');
            this.onGcMessageStatusChanged('Not Authenticated');
            return false;
        }
        
        this.gcMessageNotificationsUserId = userId;
        
        try {
            this.onGcMessageStatusChanged('Connecting...');
            
            // Create or reuse notification channel
            await this.createOrReuseNotificationChannel();
            
            // Subscribe to user message notifications topic
            const userMessagesTopic = `v2.users.${userId}.conversations.messages`;
            await this.subscribeToGcTopic(userMessagesTopic);
            
            // Ensure WebSocket connection
            await this.ensureGcWebSocketConnection();
            
            this.gcMessageNotificationsConnected = true;
            this.onGcMessageStatusChanged('Connected');
            
            return true;
            
        } catch (error) {
            console.error('Failed to connect to Genesys Cloud message notifications:', error);
            this.onGcMessageStatusChanged('Connection Failed');
            return false;
        }
    }
    
    /**
     * Disconnect from Genesys Cloud message notifications
     */
    async disconnectFromGcMessageNotifications() {
        console.log('Disconnecting from Genesys Cloud message notifications...');
        
        // Unsubscribe from messages topic
        if (this.gcMessageNotificationsUserId) {
            const userMessagesTopic = `v2.users.${this.gcMessageNotificationsUserId}.conversations.messages`;
            await this.unsubscribeFromGcTopic(userMessagesTopic);
        }
        
        this.gcMessageNotificationsConnected = false;
        this.gcMessageNotificationsUserId = null;
        this.onGcMessageStatusChanged('Disconnected');
        
        // Close WebSocket only if no other subscriptions are active
        if (this.gcSubscribedTopics.size === 0 && this.gcWebSocket) {
            console.log('No remaining subscriptions, closing WebSocket');
            this.gcWebSocket.close(1000, 'No active subscriptions');
            this.gcWebSocket = null;
            this.gcWebSocketConnected = false;
        }
        
        console.log('Genesys Cloud message notifications disconnected');
    }
    
    /**
     * Get Genesys Cloud conversation notifications connection status
     * @returns {boolean} - Whether connected to conversation notifications
     */
    isGcConversationNotificationsConnected() {
        return this.gcConversationNotificationsConnected;
    }
    
    /**
     * Update tracked conversation with new state information
     * @param {string} conversationId - The conversation ID
     * @param {string} participantState - Current participant state
     * @param {Array} participants - Array of participants
     * @param {Object} rawEvent - Raw event data
     */
    updateTrackedConversation(conversationId, participantState, participants, rawEvent) {
        if (!conversationId) return;
        
        let conversation = this.trackedConversations.get(conversationId);
        
        if (!conversation) {
            // Create new conversation tracking entry
            conversation = {
                id: conversationId,
                currentState: participantState,
                hasAgentAssist: false, // Will be updated when AA conversation is joined
                agentAssistConversationId: null, // AA conversation ID from iframe join response
                createdTime: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                stateHistory: [],
                participants: participants,
                direction: null,
                customerName: null,
                queueId: null,
                autoSequenceTriggered: false // Track if auto sequence has been triggered for this conversation
            };
            
            // Extract additional info from the first event
            const agentParticipant = participants.find(p => p.purpose === 'agent' || p.purpose === 'user');
            const customerParticipant = participants.find(p => p.purpose === 'customer');
            
            if (agentParticipant) {
                conversation.direction = agentParticipant.direction || 'unknown';
                conversation.queueId = agentParticipant.queue?.id;
            }
            
            if (customerParticipant) {
                conversation.customerName = customerParticipant.name || customerParticipant.address || 'Unknown';
            }
            
            // Trigger automated sequence for new incoming calls
            // Only trigger for connected states to avoid triggering on intermediate states
            if (participantState.toLowerCase() === 'connected' && !conversation.autoSequenceTriggered) {
                conversation.autoSequenceTriggered = true;
                console.log(`🔔 New call detected: ${conversationId} - triggering automated sequence`);
                
                // Trigger the automated sequence asynchronously to avoid blocking the event processing
                setTimeout(() => {
                    this.handleIncomingCallSequence(conversationId, conversation).catch(error => {
                        console.error('Error in automated incoming call sequence:', error);
                    });
                }, 100); // Small delay to ensure conversation is fully processed
            }
        }
        
        // Update conversation state
        if (conversation.currentState !== participantState) {
            conversation.stateHistory.push({
                state: conversation.currentState,
                timestamp: conversation.lastUpdated
            });
            conversation.currentState = participantState;
            
            // Check if we should trigger automated sequence on state change to 'connected'
            // (for existing conversations that weren't initially in connected state)
            if (participantState.toLowerCase() === 'connected' && !conversation.autoSequenceTriggered) {
                conversation.autoSequenceTriggered = true;
                console.log(`🔔 Call state changed to connected: ${conversationId} - triggering automated sequence`);
                
                // Trigger the automated sequence asynchronously
                setTimeout(() => {
                    this.handleIncomingCallSequence(conversationId, conversation).catch(error => {
                        console.error('Error in automated incoming call sequence (state change):', error);
                    });
                }, 100);
            }
        }
        
        conversation.lastUpdated = new Date().toISOString();
        conversation.participants = participants;
        
        // Store the updated conversation
        this.trackedConversations.set(conversationId, conversation);
        
        console.log(`Updated tracked conversation ${conversationId}:`, conversation);
        
        // Update most recent active conversation tracking
        this.updateMostRecentActiveConversation();
        
        // Notify UI of the update
        this.onConversationTrackingUpdate(Array.from(this.trackedConversations.values()));
    }
    
    /**
     * Get all tracked conversations
     * @returns {Array} - Array of tracked conversation objects
     */
    getTrackedConversations() {
        return Array.from(this.trackedConversations.values());
    }
    
    /**
     * Clear all tracked conversations
     */
    clearTrackedConversations() {
        this.trackedConversations.clear();
        this.mostRecentActiveConversationId = null;
        this.onConversationTrackingUpdate([]);
        this.onActiveConversationChanged(null);
    }
    
    /**
     * Update tracking of the most recent active conversation
     * Active conversations are those not in 'disconnected' or 'terminated' states
     */
    updateMostRecentActiveConversation() {
        const activeStates = ['contacting', 'dialing', 'connected'];
        let mostRecentActiveConversation = null;
        let mostRecentTime = null;
        
        // Find the most recent active conversation
        for (const conversation of this.trackedConversations.values()) {
            if (activeStates.includes(conversation.currentState.toLowerCase())) {
                const conversationTime = new Date(conversation.lastUpdated);
                if (!mostRecentTime || conversationTime > mostRecentTime) {
                    mostRecentTime = conversationTime;
                    mostRecentActiveConversation = conversation;
                }
            }
        }
        
        const newActiveConversationId = mostRecentActiveConversation ? mostRecentActiveConversation.id : null;
        
        // Only notify if the active conversation has changed
        if (this.mostRecentActiveConversationId !== newActiveConversationId) {
            const previousId = this.mostRecentActiveConversationId;
            this.mostRecentActiveConversationId = newActiveConversationId;
            
            console.log(`Active conversation changed from ${previousId} to ${newActiveConversationId}`);
            
            // Notify UI of the change
            this.onActiveConversationChanged(newActiveConversationId);
        }
    }
    
    /**
     * Get the most recent active conversation ID
     * @returns {string|null} - The conversation ID of the most recent active conversation
     */
    getMostRecentActiveConversationId() {
        return this.mostRecentActiveConversationId;
    }
    
    /**
     * Get the most recent active conversation object
     * @returns {Object|null} - The most recent active conversation object
     */
    getMostRecentActiveConversation() {
        if (this.mostRecentActiveConversationId) {
            return this.trackedConversations.get(this.mostRecentActiveConversationId);
        }
        return null;
    }
    
    /**
     * Associate an Agent Assist conversation ID with a Genesys Cloud conversation
     * @param {string} gcConversationId - The Genesys Cloud conversation ID
     * @param {string} aaConversationId - The Agent Assist conversation ID from iframe join response
     */
    associateAgentAssistConversation(gcConversationId, aaConversationId) {
        console.log(`Associating Agent Assist conversation ${aaConversationId} with GC conversation ${gcConversationId}`);
        
        const conversation = this.trackedConversations.get(gcConversationId);
        if (conversation) {
            conversation.agentAssistConversationId = aaConversationId;
            conversation.hasAgentAssist = true;
            conversation.lastUpdated = new Date().toISOString();
            
            // Update the stored conversation
            this.trackedConversations.set(gcConversationId, conversation);
            
            console.log(`Successfully associated AA conversation. Updated conversation:`, conversation);
            
            // Notify UI of the update
            this.onConversationTrackingUpdate(Array.from(this.trackedConversations.values()));
        } else {
            console.warn(`Could not find GC conversation ${gcConversationId} to associate with AA conversation ${aaConversationId}`);
        }
    }
    
    /**
     * Remove Agent Assist association from a Genesys Cloud conversation
     * @param {string} gcConversationId - The Genesys Cloud conversation ID
     */
    removeAgentAssistConversation(gcConversationId) {
        console.log(`Removing Agent Assist association from GC conversation ${gcConversationId}`);
        
        const conversation = this.trackedConversations.get(gcConversationId);
        if (conversation) {
            conversation.agentAssistConversationId = null;
            conversation.hasAgentAssist = false;
            conversation.lastUpdated = new Date().toISOString();
            
            // Update the stored conversation
            this.trackedConversations.set(gcConversationId, conversation);
            
            console.log(`Successfully removed AA association. Updated conversation:`, conversation);
            
            // Notify UI of the update
            this.onConversationTrackingUpdate(Array.from(this.trackedConversations.values()));
        } else {
            console.warn(`Could not find GC conversation ${gcConversationId} to remove AA association`);
        }
    }
    
    /**
     * Find a tracked conversation by its Agent Assist conversation ID
     * @param {string} aaConversationId - The Agent Assist conversation ID
     * @returns {Object|null} - The tracked conversation object or null if not found
     */
    findConversationByAAId(aaConversationId) {
        for (const conversation of this.trackedConversations.values()) {
            if (conversation.agentAssistConversationId === aaConversationId) {
                return conversation;
            }
        }
        return null;
    }

    // ==============================================
    // AUTO-FORWARDING CONTROL FUNCTIONS
    // ==============================================
    
    /**
     * Enable or disable auto-forwarding of transcription messages to iframe
     * @param {boolean} enabled - Whether to enable auto-forwarding
     */
    setAutoForwardTranscription(enabled) {
        this.autoForwardTranscription = enabled;
        console.log(`Auto-forwarding of GC transcription messages ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Enable or disable auto-forwarding of AudioHook messages to iframe
     * @param {boolean} enabled - Whether to enable auto-forwarding
     */
    setAutoForwardAudiohook(enabled) {
        this.autoForwardAudiohook = enabled;
        console.log(`Auto-forwarding of AudioHook messages ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Enable or disable auto-forwarding of Genesys Cloud messages to iframe for analysis
     * @param {boolean} enabled - Whether to enable auto-forwarding
     */
    setAutoForwardMessages(enabled) {
        this.autoForwardMessages = enabled;
        console.log(`Auto-forwarding of Genesys Cloud messages ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Enable or disable filtering of workflow messages from analysis
     * @param {boolean} enabled - Whether to enable filtering (true = filter out workflow messages)
     */
    setFilterWorkflowMessages(enabled) {
        this.filterWorkflowMessages = enabled;
        console.log(`Workflow message filtering ${enabled ? 'enabled' : 'disabled'} - ${enabled ? 'excluding' : 'including'} bot/system messages`);
    }
    
    /**
     * Get current auto-forwarding status
     * @returns {Object} - Current auto-forwarding settings
     */
    getAutoForwardingStatus() {
        return {
            transcription: this.autoForwardTranscription,
            audiohook: this.autoForwardAudiohook
        };
    }
    
    /**
     * Enable or disable automatic handling of incoming calls
     * @param {boolean} enabled - Whether to enable auto-handling
     */
    setAutoHandleIncomingCalls(enabled) {
        this.autoHandleIncomingCalls = enabled;
        console.log(`Automatic incoming call handling ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Automated sequence for handling new incoming calls
     * Reuses methods from the main call sequence for consistency
     * @param {string} conversationId - The Genesys Cloud conversation ID
     * @param {Object} conversation - The tracked conversation object
     * @returns {Promise<void>}
     */
    async handleIncomingCallSequence(conversationId, conversation) {
        if (!this.autoHandleIncomingCalls) {
            console.log('Automatic call handling is disabled, skipping sequence');
            return;
        }
        
        if (this.autoCallSequenceInProgress) {
            console.log('Auto call sequence already in progress, skipping');
            return;
        }
        
        this.autoCallSequenceInProgress = true;
        console.log(`🔄 Starting automated sequence for incoming call: ${conversationId}`);
        
        try {
            // Step 1: Connect transcription for the conversation
            console.log(`📞 Auto Step 1: Connecting transcription for conversation ${conversationId}...`);
            if (this.isGenesysCloudAuthenticated()) {
                await this.connectToGcTranscription(conversationId);
                console.log('✅ Auto transcription connected successfully');
            } else {
                console.log('⚠️ Skipping transcription - Genesys Cloud not authenticated');
            }
            
            // Step 2: Generate random conversation ID for iframe join
            console.log('🎲 Auto Step 2: Generating random conversation ID for iframe join...');
            const randomConversationId = this.generateRandomConversationId();
            console.log(`Generated random conversation ID: ${randomConversationId}`);
            
            // Update the form field if it exists (for UI consistency)
            if (typeof document !== 'undefined') {
                const conversationIdInput = document.getElementById('conversationIdInput');
                if (conversationIdInput) {
                    conversationIdInput.value = randomConversationId;
                }
            }
            
            // Step 3: Join the conversation in iframe
            console.log('📋 Auto Step 3: Joining conversation in iframe...');
            const contactName = conversation.customerName || 'Auto Customer';
            const contactEmail = 'auto@example.com';
            const contactPhone = this.extractPhoneFromConversation(conversation);
            const profileId = '0198e667-6540-727d-b6b0-d8f4de9db1c6'; // Default profile ID
            
            this.sendJoinConversation(randomConversationId, profileId, contactName, contactEmail, contactPhone);
            
            // Step 4: Wait for successful join response, then activate
            console.log('⏳ Auto Step 4: Waiting for join response to activate conversation...');
            await this.waitForConversationJoined();
            console.log('✅ Auto conversation join successful');
            
            // Step 5: Activate the conversation
            console.log('🔄 Auto Step 5: Activating conversation...');
            if (this.currentConversationId) {
                this.sendActivateConversation(this.currentConversationId);
                console.log('✅ Auto conversation activation sent');
            } else {
                console.warn('⚠️ No current conversation ID available for activation');
            }
            
            console.log('🎉 Automated incoming call sequence completed successfully!');
            
        } catch (error) {
            console.error('❌ Error in automated call sequence:', error);
        } finally {
            this.autoCallSequenceInProgress = false;
        }
    }
    
    /**
     * Generate a random conversation ID (reused from main sequence)
     * @returns {string} - Random conversation ID starting with a letter
     */
    generateRandomConversationId() {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
        
        // Start with a random letter
        let result = letters.charAt(Math.floor(Math.random() * letters.length));
        
        // Add 15 more random alphanumeric characters
        for (let i = 1; i < 16; i++) {
            result += alphanumeric.charAt(Math.floor(Math.random() * alphanumeric.length));
        }
        
        return result;
    }
    
    /**
     * Extract phone number from conversation participants
     * @param {Object} conversation - The conversation object
     * @returns {string} - Extracted phone number or default
     */
    extractPhoneFromConversation(conversation) {
        if (!conversation || !conversation.participants) {
            return '5551112222';
        }
        
        const customerParticipant = conversation.participants.find(p => p.purpose === 'customer');
        if (customerParticipant && customerParticipant.address) {
            // Extract only numbers from the address and take the last 10 digits
            const numbersOnly = customerParticipant.address.replace(/\D/g, '');
            const last10Digits = numbersOnly.slice(-10);
            return last10Digits || '5551112222';
        }
        
        return '5551112222';
    }
    
    /**
     * Wait for conversation joined event (reused from main sequence)
     * @returns {Promise<void>}
     */
    waitForConversationJoined() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for conversation joined'));
            }, 10000); // 10 second timeout
            
            // Listen for conversation joined event
            const checkInterval = setInterval(() => {
                if (this.currentConversationId) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 500);
        });
    }

    // ==============================================
    // UTILITY FUNCTIONS
    // ==============================================
    
    /**
     * Get current connection status
     * @returns {boolean} - Whether iframe is connected
     */
    isIframeConnected() {
        return this.isConnected;
    }
    
    /**
     * Get current access token
     * @returns {string|null} - Current access token or null if not authorized
     */
    getCurrentAccessToken() {
        return this.accessToken;
    }
    
    /**
     * Get current conversation ID
     * @returns {string|null} - Current conversation ID or null if none active
     */
    getCurrentConversationId() {
        return this.currentConversationId;
    }
    
    /**
     * Clean up - remove event listeners and close connections
     */
    cleanup() {
        console.log('Cleaning up iframe communication wrapper...');
        
        // Clean up iframe message listener
        if (this.handleReceivedMessage) {
            window.removeEventListener('message', this.handleReceivedMessage);
        }
        
        // Clean up AudioHook WebSocket connection (non-manual for cleanup)
        this.disconnectFromAudiohook(false);
        
        // Clean up Genesys Cloud transcription connection
        this.disconnectFromGcTranscription();
        
        // Clean up Genesys Cloud conversation notifications connection
        this.disconnectFromGcConversationNotifications();
        
        // Clean up Genesys Cloud message notifications connection
        this.disconnectFromGcMessageNotifications();
        
        // Reset all state
        this.iframeElement = null;
        this.isConnected = false;
        this.accessToken = null;
        this.currentConversationId = null;
        this.contactCenterConversationId = null;
        
        // Reset automated sequence state
        this.autoCallSequenceInProgress = false;
        
        // Clear conversation tracking
        this.trackedConversations.clear();
        this.mostRecentActiveConversationId = null;
        
        console.log('Cleanup completed');
    }
}

// Make the class available globally for the HTML file
if (typeof window !== 'undefined') {
    window.IframeCommunicationWrapper = IframeCommunicationWrapper;
}

// Export for use as a module (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IframeCommunicationWrapper;
}