/**
 * ADDI POC Widget V2 - Main Application Module
 *
 * Orchestrates the application flow, coordinating between
 * Config, API, UI, Utils, and WebSocket modules.
 *
 * Key Features:
 * - Dynamic language loading from ADDI with JSON fallback
 * - Bearer token authentication support
 * - New ADDI API endpoint patterns
 */

const App = (() => {
    'use strict';

    // Message tracking
    let processedMessageIds = new Set();
    let messageStore = {};
    let eventCounter = 0;

    /**
     * Initialize the application
     * Called on page load
     */
    async function init() {
        Utils.log('ADDI POC Widget V2 starting...', 'info');

        try {
            // Initialize configuration from URL params
            Config.init();

            // Initialize UI
            UI.init();

            // Load language definitions (ADDI API with JSON fallback)
            await loadLanguageDefinitions();

            // Authenticate with Genesys Cloud
            const user = await API.initGenesysCloud();

            // Update debug panel
            updateDebugPanel();

            // Load conversation details
            await loadConversation();

            Utils.log('Application initialized successfully', 'success');

        } catch (error) {
            Utils.log('Application initialization failed', 'error', error);
            console.error(error);
        }
    }

    /**
     * Load language definitions - tries ADDI API first, falls back to static JSON
     */
    async function loadLanguageDefinitions() {
        // Try ADDI language_maps API first
        try {
            Utils.log('Attempting to load languages from ADDI API...', 'info');
            const languageMaps = await API.getLanguageMaps();

            if (languageMaps && Array.isArray(languageMaps) && languageMaps.length > 0) {
                const languageDefs = transformLanguageMaps(languageMaps);
                Config.setLanguageDefinitions(languageDefs);
                UI.populateLanguages(languageDefs);
                Utils.log(`Language definitions loaded from ADDI (${languageMaps.length} languages)`, 'success');
                return;
            }
        } catch (error) {
            Utils.log('ADDI language_maps failed, falling back to static JSON', 'warning', error);
        }

        // Fallback to static JSON file
        try {
            const response = await fetch('./scripts/languageDefinition.json');
            const languageDefs = await response.json();

            Config.setLanguageDefinitions(languageDefs);
            UI.populateLanguages(languageDefs);

            Utils.log('Language definitions loaded from static JSON', 'success');

        } catch (error) {
            Utils.log('Failed to load language definitions from any source', 'error', error);
            throw error;
        }
    }

    /**
     * Transform ADDI language maps response to internal format
     * @param {Array} languageMapList - Array from ADDI /language_maps endpoint
     * @returns {Object} Language definitions keyed by ID
     */
    function transformLanguageMaps(languageMapList) {
        const languageDefs = {};

        languageMapList.forEach(entry => {
            const dialectId = entry.dialect_id;
            const displayName = entry.dialect_display || entry.map_name || entry.dialect_id || entry.id;
            const flagId = Config.resolveFlagId(dialectId);

            languageDefs[entry.id] = {
                key: entry.id,
                name: displayName,
                id: dialectId,
                id_region: dialectId ? dialectId.split('-')[0].toLowerCase() : '',
                flag_id: flagId
            };
        });

        return languageDefs;
    }

    /**
     * Load and process the current conversation
     */
    async function loadConversation() {
        const gc = Config.gc;

        if (!gc.conversationId) {
            Utils.log('No conversation ID provided', 'warning');
            return;
        }

        try {
            const conversation = await API.getConversation(gc.conversationId);
            Utils.log('Conversation loaded', 'info', conversation);

            // Extract agent participant info
            const agentParticipant = conversation.participants
                .slice()
                .reverse()
                .find(p => p.purpose === 'agent');

            if (!agentParticipant) {
                Utils.log('No agent participant found', 'error');
                return;
            }

            // Get customer attributes
            const customerParticipant = conversation.participants.find(p => p.purpose === 'customer');
            const customerAttributes = customerParticipant?.attributes || {};

            // Determine customer language from attributes
            let customerLanguage = customerAttributes.speaker_language || Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE;
            if (customerLanguage === 'default') {
                customerLanguage = 'german';
            }

            // Determine media type and set conversation state
            let mediaType = Config.MEDIA_TYPES.OTHER;
            let communicationId = null;

            if (agentParticipant.messages?.length > 0) {
                mediaType = Config.MEDIA_TYPES.MESSAGE;
                communicationId = agentParticipant.messages[0].id;
            } else if (agentParticipant.calls?.length > 0) {
                mediaType = Config.MEDIA_TYPES.VOICE;
                communicationId = agentParticipant.calls[0].id;
            }

            // Update configuration
            Config.setConversationState({
                mediaType,
                communicationId,
                participantId: agentParticipant.id,
                queueId: agentParticipant.queueId,
                transactionId: customerAttributes.ADDI_TransactionId || null
            });

            // Update language settings
            await updateLanguageSettings(Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE, customerLanguage);

            // Show footer for messaging
            UI.setFooterVisible(true);

            // Update debug panel
            updateDebugPanel();

            // Load queue canned responses
            if (Config.conversation.queueId) {
                await loadCannedResponses(Config.conversation.queueId);
            }

            // Handle ADDI transaction if present
            if (Config.conversation.transactionId) {
                await handleADDITransaction();
            }

            // For messaging, load existing messages and subscribe
            if (mediaType === Config.MEDIA_TYPES.MESSAGE) {
                await Utils.delay(1000);
                await translateExistingMessages(conversation);
                displayStoredMessages();
                await subscribeToMessages();
            }

        } catch (error) {
            Utils.log('Failed to load conversation', 'error', error);
            throw error;
        }
    }

    /**
     * Handle ADDI transaction setup
     */
    async function handleADDITransaction() {
        const transactionId = Config.conversation.transactionId;

        try {
            // Get and update language settings from ADDI
            const languageSettings = await API.getTransactionLanguage(transactionId);

            // Handle both old format (agent/caller) and new format (agent_id/caller_id)
            const agentLang = languageSettings.agent_id || languageSettings.agent;
            const callerLang = languageSettings.caller_id || languageSettings.caller;

            if (agentLang && callerLang) {
                await updateLanguageSettings(agentLang, callerLang);
            }

            // Connect to ADDI transcription WebSocket
            WebSocketManager.connectADDI(transactionId, handleADDITranscription);

            Utils.log('ADDI transaction configured', 'success');

        } catch (error) {
            Utils.log('Failed to configure ADDI transaction', 'error', error);
        }
    }

    /**
     * Update language settings and translation profiles
     * @param {string} agentLanguage - Agent language key
     * @param {string} customerLanguage - Customer language key
     */
    async function updateLanguageSettings(agentLanguage, customerLanguage) {
        const languageDefs = Config.languages.definitions;

        // Find language objects - try direct match first, then search
        const agentLangObj = findLanguageObject(languageDefs, agentLanguage);
        const customerLangObj = findLanguageObject(languageDefs, customerLanguage);

        Config.updateLanguageSettings({
            agentLanguage,
            customerLanguage,
            agentLanguageObject: agentLangObj,
            customerLanguageObject: customerLangObj
        });

        UI.updateLanguageSelections(customerLanguage, agentLanguage);

        // Load translation profiles
        await loadTranslationProfiles();
    }

    /**
     * Find a language object by ID or name (case-insensitive)
     * @param {Object} languageDefs - Language definitions
     * @param {string} idOrName - Language ID or name to find
     * @returns {Object|null} Language object or null
     */
    function findLanguageObject(languageDefs, idOrName) {
        if (!languageDefs || !idOrName) return null;

        // Direct match
        if (languageDefs[idOrName]) {
            return languageDefs[idOrName];
        }

        // Case-insensitive search
        const searchLower = idOrName.toLowerCase();
        for (const key in languageDefs) {
            const def = languageDefs[key];
            if (key.toLowerCase() === searchLower ||
                def.id?.toLowerCase() === searchLower ||
                def.name?.toLowerCase() === searchLower) {
                return def;
            }
        }

        return null;
    }

    /**
     * Load and set translation profiles/engines from ADDI
     * Uses new /translation_engines endpoint
     */
    async function loadTranslationProfiles() {
        try {
            const profiles = await API.getTranslationEngines();
            const langSettings = Config.languages;

            let agentProfile = null;
            let customerProfile = null;

            // Get language IDs for matching (case-insensitive)
            const agentId = langSettings.agentLanguageObject?.id?.toLowerCase() || '';
            const customerId = langSettings.customerLanguageObject?.id?.toLowerCase() || '';

            Object.values(profiles).forEach(profile => {
                const profileSource = profile.Source?.toLowerCase() || '';
                const profileTarget = profile.Target?.toLowerCase() || '';

                // Agent profile: agent language -> customer language
                if (profileSource === agentId && profileTarget === customerId) {
                    agentProfile = profile;
                }
                // Customer profile: customer language -> agent language
                if (profileSource === customerId && profileTarget === agentId) {
                    customerProfile = profile;
                }
            });

            Config.updateLanguageSettings({
                agentProfile,
                customerProfile
            });

            if (!agentProfile || !customerProfile) {
                Utils.log(`No translation profiles found for Agent[${agentId}] -> Customer[${customerId}]`, 'warning');
            } else {
                Utils.log(`Profiles set - Agent: ${agentProfile?.ProfileId}, Customer: ${customerProfile?.ProfileId}`, 'info');
            }

        } catch (error) {
            Utils.log('Failed to load translation profiles', 'error', error);
        }
    }

    /**
     * Load canned responses for a queue
     * @param {string} queueId - Queue ID
     */
    async function loadCannedResponses(queueId) {
        try {
            const queue = await API.getQueue(queueId);

            if (!queue?.cannedResponseLibraries?.libraryIds?.length) {
                return;
            }

            const libraryId = queue.cannedResponseLibraries.libraryIds[0];
            const responses = await API.getCannedResponses(libraryId);

            responses.forEach(response => {
                UI.addCannedResponse({
                    id: response.id,
                    name: response.name,
                    content: response.texts?.[0]?.content || ''
                });
            });

            Utils.log(`Loaded ${responses.length} canned responses`, 'success');

        } catch (error) {
            Utils.log('Failed to load canned responses', 'error', error);
        }
    }

    /**
     * Subscribe to message events
     */
    async function subscribeToMessages() {
        try {
            const channelId = await API.getOrCreateNotificationChannel();
            const userId = Config.user.id;
            const topic = `v2.users.${userId}.conversations.messages`;

            await API.subscribeToTopic(channelId, topic);
            WebSocketManager.connectGenesys(channelId, handleMessageNotification);

        } catch (error) {
            Utils.log('Failed to subscribe to messages', 'error', error);
        }
    }

    /**
     * Handle incoming message notification
     * @param {Object} notification - Notification data
     */
    function handleMessageNotification(notification) {
        const customerParticipant = notification.eventBody?.participants
            ?.slice()
            .reverse()
            .find(p => p.purpose === 'customer');

        if (!customerParticipant?.messages) return;

        customerParticipant.messages.reverse().forEach(async message => {
            const messageId = message.message?.id;

            if (!messageId || processedMessageIds.has(messageId)) return;

            processedMessageIds.add(messageId);

            const langSettings = Config.languages;
            const messageObj = Utils.createMessageObject({
                messageid: messageId,
                Timestamp: message.messageTime,
                OriginalLanguage: langSettings.customerLanguageObject?.name,
                OriginalFlag: langSettings.customerLanguageObject?.flag_id,
                TranslatedLanguage: langSettings.agentLanguageObject?.name,
                TranslatedFlag: langSettings.agentLanguageObject?.flag_id,
                SenderType: Config.SENDER_TYPES.CUSTOMER
            });

            messageStore[messageId] = messageObj;

            // Translate and display
            await translateMessage(messageObj, langSettings.customerProfile, displayNewMessage);
        });
    }

    /**
     * Handle ADDI transcription event
     * @param {Object} event - Transcription event data
     */
    function handleADDITranscription(event) {
        const eventId = `event_${eventCounter++}`;
        const langSettings = Config.languages;
        const selections = UI.getLanguageSelections();

        let senderType = Config.SENDER_TYPES.CUSTOMER;
        let sourceLang = selections.source;
        let targetLang = selections.target;

        if (event.participant !== 'caller') {
            senderType = Config.SENDER_TYPES.AGENT;
            sourceLang = selections.target;
            targetLang = selections.source;
        }

        const messageObj = Utils.createMessageObject({
            messageid: eventId,
            Timestamp: event.timestamp,
            OriginalText: event.text,
            OriginalLanguage: sourceLang,
            OriginalFlag: langSettings.definitions?.[sourceLang]?.flag_id || 'us',
            TranslatedText: event.translated,
            TranslatedLanguage: targetLang,
            TranslatedFlag: langSettings.definitions?.[targetLang]?.flag_id || 'us',
            SenderType: senderType
        });

        messageStore[eventId] = messageObj;
        UI.addMessageBubble(messageObj);
    }

    /**
     * Translate existing messages in a conversation
     * @param {Object} conversation - Conversation object
     */
    async function translateExistingMessages(conversation) {
        const participants = conversation.participants;

        // Collect all messages
        const allMessages = [];

        const customer = participants.find(p => p.purpose === 'customer');
        const agent = participants.slice().reverse().find(p => p.purpose === 'agent');
        const workflow = participants.slice().reverse().find(p => p.purpose === 'workflow');

        // Add customer messages
        customer?.messages?.[0]?.messages?.forEach(msg => {
            processedMessageIds.add(msg.messageId);
            allMessages.push({ ...msg, messageSender: Config.SENDER_TYPES.CUSTOMER });
        });

        // Add agent messages
        agent?.messages?.[0]?.messages?.forEach(msg => {
            processedMessageIds.add(msg.messageId);
            allMessages.push({ ...msg, messageSender: Config.SENDER_TYPES.AGENT });
        });

        // Add workflow messages
        workflow?.messages?.[0]?.messages?.forEach(msg => {
            processedMessageIds.add(msg.messageId);
            allMessages.push({ ...msg, messageSender: Config.SENDER_TYPES.WORKFLOW });
        });

        // Sort by time and translate
        const sortedMessages = Utils.sortMessagesByTime(allMessages);
        const langSettings = Config.languages;

        for (const msg of sortedMessages) {
            // Skip empty messages
            if (!msg.messageId) continue;

            const messageObj = Utils.createMessageObject({
                messageid: msg.messageId,
                Timestamp: msg.messageTime,
                OriginalLanguage: langSettings.customerLanguageObject?.name,
                OriginalFlag: langSettings.customerLanguageObject?.flag_id,
                TranslatedLanguage: langSettings.agentLanguageObject?.name,
                TranslatedFlag: langSettings.agentLanguageObject?.flag_id,
                SenderType: msg.messageSender
            });

            messageStore[msg.messageId] = messageObj;
            await translateMessage(messageObj, langSettings.customerProfile, storeTranslation);
        }
    }

    /**
     * Display all stored messages
     */
    function displayStoredMessages() {
        Object.values(messageStore)
            .filter(msg => msg.OriginalText && msg.OriginalText.trim() !== '')
            .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
            .forEach(msg => UI.addMessageBubble(msg));
    }

    /**
     * Translate a message via ADDI
     * @param {Object} messageObj - Message object
     * @param {Object} profile - Translation profile
     * @param {Function} callback - Callback after translation
     */
    async function translateMessage(messageObj, profile, callback) {
        try {
            // Get original message text from Genesys
            const fullMessage = await API.getMessage(
                Config.gc.conversationId,
                messageObj.messageid
            );

            messageObj.OriginalText = fullMessage.normalizedMessage?.text || '';

            // Skip translation if no text
            if (!messageObj.OriginalText.trim()) {
                return;
            }

            // Translate via ADDI (uses transaction ID from conversation)
            const transactionId = Config.conversation.transactionId || Config.gc.conversationId;
            const result = await API.translateText(
                transactionId,
                messageObj.messageSender,
                messageObj.OriginalText,
                profile?.ProfileId || ''
            );

            result.messageId = messageObj.messageid;
            callback(result);

        } catch (error) {
            Utils.log(`Failed to translate message ${messageObj.messageid}`, 'error', error);
        }
    }

    /**
     * Store translation result
     * @param {Object} result - Translation result
     */
    function storeTranslation(result) {
        if (messageStore[result.messageId]) {
            messageStore[result.messageId].TranslatedText = result.text || '';
        }
    }

    /**
     * Display a newly translated message
     * @param {Object} result - Translation result
     */
    function displayNewMessage(result) {
        storeTranslation(result);
        const msg = messageStore[result.messageId];
        if (msg) {
            UI.addMessageBubble(msg);
        }
    }

    /**
     * Send a message (public method)
     * @param {string} text - Optional text to send (defaults to input value)
     */
    async function sendMessage(text = '') {
        const messageText = text || UI.getMessageInput();

        if (!messageText.trim()) return;

        UI.clearMessageInput();
        UI.showLoading();

        const mediaType = Config.conversation.mediaType;

        try {
            if (mediaType === Config.MEDIA_TYPES.MESSAGE) {
                await sendDigitalMessage(messageText);
            } else if (mediaType === Config.MEDIA_TYPES.VOICE) {
                await sendVoiceMessage(messageText);
            }
        } catch (error) {
            Utils.log('Failed to send message', 'error', error);
        } finally {
            UI.hideLoading();
        }
    }

    /**
     * Send a digital channel message
     * @param {string} text - Message text
     */
    async function sendDigitalMessage(text) {
        const langSettings = Config.languages;
        const transactionId = Config.conversation.transactionId || Config.gc.conversationId;

        // Translate for customer
        const result = await API.translateText(
            transactionId,
            'agent',
            text,
            langSettings.agentProfile?.ProfileId || ''
        );

        // Send translated message
        const sentMessage = await API.sendMessage(
            Config.gc.conversationId,
            Config.conversation.communicationId,
            result.text
        );

        // Create and display message bubble
        const messageObj = Utils.createMessageObject({
            messageid: sentMessage.id,
            Timestamp: sentMessage.timestamp,
            OriginalText: result.original_text || text,
            OriginalLanguage: langSettings.agentLanguageObject?.name,
            OriginalFlag: langSettings.agentLanguageObject?.flag_id,
            TranslatedText: result.text,
            TranslatedLanguage: langSettings.customerLanguageObject?.name,
            TranslatedFlag: langSettings.customerLanguageObject?.flag_id,
            SenderType: Config.SENDER_TYPES.AGENT
        });

        processedMessageIds.add(sentMessage.id);
        messageStore[sentMessage.id] = messageObj;
        UI.addMessageBubble(messageObj);
    }

    /**
     * Send a voice TTS message
     * @param {string} text - Message text
     */
    async function sendVoiceMessage(text) {
        const transactionId = Config.conversation.transactionId;

        if (!transactionId) {
            Utils.log('No ADDI transaction for voice message', 'warning');
            return;
        }

        await API.sendTTSMessage(transactionId, 'caller', text);
    }

    /**
     * Update language settings from UI (public method)
     */
    async function updateLanguages() {
        const selections = UI.getLanguageSelections();
        const mediaType = Config.conversation.mediaType;
        const langDefs = Config.languages.definitions;

        if (mediaType === Config.MEDIA_TYPES.VOICE) {
            const transactionId = Config.conversation.transactionId;
            if (transactionId) {
                const status = await API.updateTransactionLanguage(
                    transactionId,
                    selections.target,
                    selections.source
                );

                if (status === 200) {
                    // Show confirmation message
                    const callerLabel = langDefs?.[selections.source]?.name || selections.source;
                    const agentLabel = langDefs?.[selections.target]?.name || selections.target;
                    Utils.log(`Languages updated: Caller=${callerLabel}, Agent=${agentLabel}`, 'success');
                }
            }
        }

        await updateLanguageSettings(selections.target, selections.source);
    }

    /**
     * Update debug panel with current state
     */
    function updateDebugPanel() {
        const gc = Config.gc;
        const addi = Config.addi;
        const user = Config.user;
        const conv = Config.conversation;

        UI.updateDebugInfo({
            environment: gc.region,
            language: gc.language,
            user: user.name,
            version: Config.VERSION,
            clientId: gc.clientId,
            conversationId: gc.conversationId,
            participantId: conv.participantId,
            communicationId: conv.communicationId,
            mediaType: conv.mediaType,
            transactionId: conv.transactionId,
            bearer: addi.bearer ? 'Present' : 'None',
            addiHost: addi.apiHost
        });
    }

    // Public API
    return {
        init,
        sendMessage,
        updateLanguages
    };
})();

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
