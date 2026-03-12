/**
 * ADDI POC Widget V2 - API Module
 *
 * Handles all API interactions with both Genesys Cloud and ADDI services.
 * Provides a clean interface for making authenticated requests.
 *
 * ADDI Authentication: Uses bearer token passed via URL parameter.
 * New endpoint pattern: /services/api/ccaas/transactions/{id}/...
 */

const API = (() => {
    'use strict';

    // Genesys Cloud SDK instances (initialized after auth)
    let platformClient = null;
    let client = null;
    let usersApi = null;
    let notificationsApi = null;
    let conversationsApi = null;
    let routingApi = null;
    let responseManagementApi = null;

    /**
     * Initialize the Genesys Cloud SDK and authenticate
     * @returns {Promise<Object>} User object after successful authentication
     */
    async function initGenesysCloud() {
        const gc = Config.gc;

        platformClient = require('platformClient');
        client = platformClient.ApiClient.instance;

        // Initialize API instances
        usersApi = new platformClient.UsersApi();
        notificationsApi = new platformClient.NotificationsApi();
        conversationsApi = new platformClient.ConversationsApi();
        routingApi = new platformClient.RoutingApi();
        responseManagementApi = new platformClient.ResponseManagementApi();

        // Configure SDK
        client.setEnvironment(gc.region);
        client.setPersistSettings(Config.SDK_SETTINGS.PERSIST_SETTINGS, Config.SDK_SETTINGS.STORAGE_PREFIX);

        console.log('%cInitializing Genesys Cloud SDK', 'color: green');
        console.log('%cRegion: %s, ClientId: %s', 'color: yellow', gc.region, gc.clientId);

        // Authenticate
        await client.loginImplicitGrant(gc.clientId, gc.redirectUrl, {});

        // Get current user
        const user = await usersApi.getUsersMe({});
        Config.setUserInfo(user);

        console.log('%cAuthenticated as: %s', 'color: green', user.name);
        return user;
    }

    // ============================================
    // Genesys Cloud Conversation APIs
    // ============================================

    /**
     * Get conversation details
     * @param {string} conversationId - The conversation ID
     * @returns {Promise<Object>} Conversation object
     */
    async function getConversation(conversationId) {
        return conversationsApi.getConversation(conversationId);
    }

    /**
     * Get a specific message from a conversation
     * @param {string} conversationId - The conversation ID
     * @param {string} messageId - The message ID
     * @returns {Promise<Object>} Message object
     */
    async function getMessage(conversationId, messageId) {
        return conversationsApi.getConversationsMessageMessage(conversationId, messageId);
    }

    /**
     * Send a message in a conversation
     * @param {string} conversationId - The conversation ID
     * @param {string} communicationId - The communication ID
     * @param {string} text - Message text to send
     * @returns {Promise<Object>} Sent message object
     */
    async function sendMessage(conversationId, communicationId, text) {
        const body = { textBody: text };
        const opts = { useNormalizedMessage: false };
        return conversationsApi.postConversationsMessageCommunicationMessages(
            conversationId,
            communicationId,
            body,
            opts
        );
    }

    // ============================================
    // Genesys Cloud Notification APIs
    // ============================================

    /**
     * Get or create a notification channel with improved error handling
     * @returns {Promise<string>} Channel ID
     */
    async function getOrCreateNotificationChannel() {
        const existingChannelId = sessionStorage.getItem('gc_channelid');

        // Try to reuse existing channel
        if (existingChannelId) {
            try {
                // Verify the channel is still valid by attempting a subscription
                console.log('%cAttempting to reuse existing notification channel', 'color: green');
                return existingChannelId;
            } catch (err) {
                console.warn('Cached channel expired or invalid, creating new one...', err);
                sessionStorage.removeItem('gc_channelid');
            }
        }

        // Create new channel
        const channel = await notificationsApi.postNotificationsChannels();
        sessionStorage.setItem('gc_channelid', channel.id);
        console.log('%cCreated new notification channel: %s', 'color: green', channel.id);
        return channel.id;
    }

    /**
     * Subscribe to a notification topic with error recovery
     * @param {string} channelId - The channel ID
     * @param {string} topic - The topic to subscribe to
     * @returns {Promise<boolean>} True if successful
     */
    async function subscribeToTopic(channelId, topic) {
        try {
            await notificationsApi.postNotificationsChannelSubscriptions(channelId, [{ id: topic }]);
            console.log('%cSubscribed to topic: %s', 'color: green', topic);
            return true;
        } catch (err) {
            console.warn('Subscription failed, channel may be expired:', err);
            // Clear cached channel so a new one will be created
            sessionStorage.removeItem('gc_channelid');

            // Try creating a new channel and subscribing
            const newChannel = await notificationsApi.postNotificationsChannels();
            sessionStorage.setItem('gc_channelid', newChannel.id);
            await notificationsApi.postNotificationsChannelSubscriptions(newChannel.id, [{ id: topic }]);
            console.log('%cSubscribed to topic on new channel: %s', 'color: green', topic);
            return true;
        }
    }

    /**
     * Get the WebSocket URL for a notification channel
     * @param {string} channelId - The channel ID
     * @returns {string} WebSocket URL
     */
    function getNotificationWebSocketUrl(channelId) {
        return `wss://streaming.${Config.gc.region}/channels/${channelId}`;
    }

    // ============================================
    // Genesys Cloud Routing & Response APIs
    // ============================================

    /**
     * Get queue details by ID
     * @param {string} queueId - The queue ID
     * @returns {Promise<Object>} Queue entity
     */
    async function getQueue(queueId) {
        const opts = {
            pageNumber: 1,
            pageSize: 1,
            sortOrder: 'asc',
            id: [queueId]
        };
        const result = await routingApi.getRoutingQueues(opts);
        return result.entities?.[0] || null;
    }

    /**
     * Get canned responses from a library
     * @param {string} libraryId - The library ID
     * @returns {Promise<Array>} Array of response entities
     */
    async function getCannedResponses(libraryId) {
        const opts = {
            pageNumber: 1,
            pageSize: 25
        };
        const result = await responseManagementApi.getResponsemanagementResponses(libraryId, opts);
        return result.entities || [];
    }

    // ============================================
    // ADDI Translation APIs
    // ============================================

    /**
     * Build headers for ADDI API requests including bearer token
     * @param {Object} additionalHeaders - Optional additional headers
     * @returns {Object} Headers object
     */
    function getAddiHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };

        const bearer = Config.addi.bearer;
        if (bearer) {
            headers['Authorization'] = `Bearer ${bearer}`;
        }

        return headers;
    }

    /**
     * Make a request to the ADDI API
     * @param {string} endpoint - API endpoint (without host/route prefix)
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Parsed JSON response
     */
    async function addiRequest(endpoint, options = {}) {
        const url = Config.getAddiApiUrl(endpoint);

        const response = await fetch(url, {
            ...options,
            headers: getAddiHeaders(options.headers)
        });

        if (!response.ok) {
            throw new Error(`ADDI API error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    /**
     * Get language maps from ADDI (new endpoint for dynamic language loading)
     * @returns {Promise<Array>} Array of language map entries
     */
    async function getLanguageMaps() {
        return addiRequest('/language_maps');
    }

    /**
     * Get translation engines/profiles from ADDI
     * (Replaces old /profiles endpoint)
     * @returns {Promise<Object>} Translation engines/profiles data
     */
    async function getTranslationEngines() {
        return addiRequest('/translation_engines');
    }

    /**
     * Get language settings for a transaction
     * @param {string} transactionId - The transaction ID
     * @returns {Promise<Object>} Language settings (agent_id, caller_id)
     */
    async function getTransactionLanguage(transactionId) {
        return addiRequest(`/transactions/${transactionId}/languages`);
    }

    /**
     * Update language settings for a transaction
     * @param {string} transactionId - The transaction ID
     * @param {string} agentLanguage - Agent's language
     * @param {string} callerLanguage - Caller's language
     * @returns {Promise<number>} HTTP status code
     */
    async function updateTransactionLanguage(transactionId, agentLanguage, callerLanguage) {
        const url = Config.getAddiApiUrl(`/transactions/${transactionId}/languages`);
        const response = await fetch(url, {
            method: 'PUT',
            headers: getAddiHeaders(),
            body: JSON.stringify({
                transaction_id: transactionId,
                agent: agentLanguage,
                caller: callerLanguage
            })
        });
        return response.status;
    }

    /**
     * Translate text using ADDI
     * @param {string} transactionId - The transaction ID
     * @param {string} party - The party (caller/agent)
     * @param {string} text - Text to translate
     * @param {string} profileId - Translation profile ID
     * @param {boolean} translationOnly - If true, adds X-Translation-Only header
     * @returns {Promise<Object>} Translation result
     */
    async function translateText(transactionId, party, text, profileId, translationOnly = false) {
        const additionalHeaders = {};

        // For MESSAGE media type, add translation-only header to skip TTS
        if (translationOnly || Config.conversation.mediaType === Config.MEDIA_TYPES.MESSAGE) {
            additionalHeaders['X-Translation-Only'] = 'true';
        }

        const url = Config.getAddiApiUrl(`/transactions/${transactionId}/translate`);
        const response = await fetch(url, {
            method: 'POST',
            headers: getAddiHeaders(additionalHeaders),
            body: JSON.stringify({
                transaction_id: transactionId,
                party: party,
                text: text,
                profile: profileId
            })
        });

        if (!response.ok) {
            throw new Error(`ADDI translate error: ${response.status}`);
        }

        const result = await response.text();
        return result ? JSON.parse(result) : null;
    }

    /**
     * Send a TTS (text-to-speech) message via ADDI
     * @param {string} transactionId - The transaction ID
     * @param {string} party - Target party (caller/agent)
     * @param {string} text - Text to speak
     * @param {boolean} translate - Whether to translate
     * @param {boolean} cancelPlaying - Whether to cancel current playback
     * @returns {Promise<Object>} Result
     */
    async function sendTTSMessage(transactionId, party, text, translate = true, cancelPlaying = false) {
        const url = Config.getAddiApiUrl(`/transactions/${transactionId}/speak`);
        const response = await fetch(url, {
            method: 'POST',
            headers: getAddiHeaders(),
            body: JSON.stringify({
                transaction_id: transactionId,
                party: party,
                text: text,
                translate: translate,
                cancel_playing: cancelPlaying
            })
        });

        if (!response.ok) {
            throw new Error(`ADDI speak error: ${response.status}`);
        }

        const result = await response.text();
        return result ? JSON.parse(result) : null;
    }

    /**
     * Get the WebSocket URL for ADDI live transcription
     * Uses Config.getAddiWebSocketUrl which includes bearer token
     * @param {string} transactionId - The transaction ID
     * @returns {string} WebSocket URL
     */
    function getADDIWebSocketUrl(transactionId) {
        return Config.getAddiWebSocketUrl(transactionId);
    }

    // Public API
    return {
        // Initialization
        initGenesysCloud,

        // Genesys Cloud APIs
        getConversation,
        getMessage,
        sendMessage,
        getOrCreateNotificationChannel,
        subscribeToTopic,
        getNotificationWebSocketUrl,
        getQueue,
        getCannedResponses,

        // ADDI APIs
        getLanguageMaps,
        getTranslationEngines,
        getTransactionLanguage,
        updateTransactionLanguage,
        translateText,
        sendTTSMessage,
        getADDIWebSocketUrl,

        // Utility
        getAddiHeaders
    };
})();

// Export for ES6 modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
