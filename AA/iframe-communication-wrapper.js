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
        this.gcTranscriptionWebSocket = null;
        this.gcTranscriptionConnected = false;
        this.gcRegion = null;
        this.gcClientId = null;
        this.gcRedirectUrl = null;
        this.gcConversationId = null;
        this.gcUserId = null;
        
        // Auto-forwarding settings
        this.autoForwardTranscription = true; // Default to enabled
        this.autoForwardAudiohook = true; // Default to enabled
        
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
            console.log('  - Conversation ID:', this.currentConversationId);
            console.log('  - Contact Center ID:', this.contactCenterConversationId);
            
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
        
        try {
            this.onGcTranscriptionStatusChanged('Connecting...');
            
            // Create or reuse notification channel
            await this.createOrReuseNotificationChannel();
            
            // Subscribe to transcription topic
            const transcriptionTopic = `v2.conversations.${conversationId}.transcription`;
            await this.gcNotificationsApi.postNotificationsChannelSubscriptions(
                this.gcChannelId, 
                [{ id: transcriptionTopic }]
            );
            
            console.log(`Subscribed to transcription topic: ${transcriptionTopic}`);
            
            // Create WebSocket connection
            await this.createGcTranscriptionWebSocket();
            
            return true;
            
        } catch (error) {
            console.error('Failed to connect to Genesys Cloud transcription:', error);
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
     * Create WebSocket connection for Genesys Cloud notifications
     */
    async createGcTranscriptionWebSocket() {
        const websocketUrl = `wss://streaming.${this.gcRegion}/channels/${this.gcChannelId}`;
        
        console.log('Creating Genesys Cloud transcription WebSocket:', websocketUrl);
        
        this.gcTranscriptionWebSocket = new WebSocket(websocketUrl);
        
        this.gcTranscriptionWebSocket.onopen = () => {
            console.log('Genesys Cloud transcription WebSocket connected');
            this.gcTranscriptionConnected = true;
            this.onGcTranscriptionStatusChanged('Connected');
        };
        
        this.gcTranscriptionWebSocket.onmessage = (event) => {
            this.handleGcTranscriptionMessage(event);
        };
        
        this.gcTranscriptionWebSocket.onclose = (event) => {
            console.log('Genesys Cloud transcription WebSocket closed:', event.reason);
            this.gcTranscriptionConnected = false;
            this.onGcTranscriptionStatusChanged('Disconnected');
        };
        
        this.gcTranscriptionWebSocket.onerror = (error) => {
            console.error('Genesys Cloud transcription WebSocket error:', error);
            this.onGcTranscriptionStatusChanged('Error');
        };
        
        console.log(`Waiting for transcription events on ${websocketUrl}`);
    }
    
    /**
     * Handle incoming Genesys Cloud transcription messages
     * @param {MessageEvent} event - The WebSocket message event
     */
    handleGcTranscriptionMessage(event) {
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
        
        // Forward all messages to callback for logging
        this.onGcTranscriptionMessage(messageData);
    }
    
    /**
     * Disconnect from Genesys Cloud transcription
     */
    disconnectFromGcTranscription() {
        console.log('Disconnecting from Genesys Cloud transcription...');
        
        if (this.gcTranscriptionWebSocket) {
            this.gcTranscriptionWebSocket.close(1000, 'Manual disconnect');
            this.gcTranscriptionWebSocket = null;
        }
        
        this.gcTranscriptionConnected = false;
        this.onGcTranscriptionStatusChanged('Disconnected');
        
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
               this.gcTranscriptionWebSocket && 
               this.gcTranscriptionWebSocket.readyState === WebSocket.OPEN;
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
     * Get current auto-forwarding status
     * @returns {Object} - Current auto-forwarding settings
     */
    getAutoForwardingStatus() {
        return {
            transcription: this.autoForwardTranscription,
            audiohook: this.autoForwardAudiohook
        };
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
        
        // Reset all state
        this.iframeElement = null;
        this.isConnected = false;
        this.accessToken = null;
        this.currentConversationId = null;
        this.contactCenterConversationId = null;
        
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