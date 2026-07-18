/**
 * ADDI Translation Widget (NiCE CXone Edition) - Main Application Module
 *
 * Orchestrates the application flow, coordinating between
 * Config, API, UI, Utils, and WebSocket modules.
 *
 * Standalone ADDI-only: requires transactionId (and bearer) via
 * URL parameters. No Genesys Cloud integration.
 */

const App = (() => {
    'use strict';

    // Message tracking
    let messageStore = {};
    let eventCounter = 0;

    /**
     * Initialize the application
     * Called on page load
     */
    async function init() {
        Utils.log('ADDI Translation Widget (NiCE CXone Edition) starting...', 'info');

        try {
            // Initialize configuration from URL params
            Config.init();

            // Initialize UI
            UI.init();

            const transactionId = Config.addi.transactionId;

            if (!transactionId) {
                UI.showWarning('Missing transactionId URL parameter', 10000);
                throw new Error('Transaction ID required (pass ?transactionId=...&bearer=...)');
            }

            // Load language definitions (ADDI API with JSON fallback)
            await loadLanguageDefinitions();

            // Apply default selections until the transaction languages load.
            // Resolve through the loaded definitions so defaults work whether
            // languages came from the ADDI API (map IDs) or the static JSON.
            const defs = Config.languages.definitions;
            const defaultCustomer = findLanguageObject(defs, Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE);
            const defaultAgent = findLanguageObject(defs, Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE);
            UI.updateLanguageSelections(
                defaultCustomer?.key || Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE,
                defaultAgent?.key || Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE
            );

            // Load language settings from ADDI transaction and connect WebSocket
            await handleADDITransaction();

            // Show footer for TTS message sending
            UI.setFooterVisible(true);

            // Update debug panel
            updateDebugPanel();

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
            console.log('ADDI /language_maps response:', languageMaps);

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
     * Handle ADDI transaction setup
     */
    async function handleADDITransaction() {
        const transactionId = Config.addi.transactionId;

        try {
            // Get and update language settings from ADDI
            const languageSettings = await API.getTransactionLanguage(transactionId);
            console.log('ADDI transaction /languages response:', languageSettings);

            // Handle both old format (agent/caller) and new format (agent_id/caller_id)
            const agentLang = languageSettings.agent_id || languageSettings.agent;
            const callerLang = languageSettings.caller_id || languageSettings.caller;

            if (agentLang && callerLang) {
                await updateLanguageSettings(agentLang, callerLang);
            } else {
                Utils.log('Transaction has no languages set, applying defaults', 'info');
                await updateLanguageSettings(
                    Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE,
                    Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE
                );
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

        if (!agentLangObj || !customerLangObj) {
            Utils.log(
                `Could not resolve language(s) - agent "${agentLanguage}" ${agentLangObj ? 'OK' : 'NOT FOUND'}, ` +
                `customer "${customerLanguage}" ${customerLangObj ? 'OK' : 'NOT FOUND'}. ` +
                `Available: ${Object.keys(languageDefs || {}).join(', ')}`,
                'warning'
            );
        }

        Config.updateLanguageSettings({
            agentLanguage,
            customerLanguage,
            agentLanguageObject: agentLangObj,
            customerLanguageObject: customerLangObj
        });

        // Use resolved keys so the dropdowns match their option values
        UI.updateLanguageSelections(
            customerLangObj?.key || customerLanguage,
            agentLangObj?.key || agentLanguage
        );

        // Load translation profiles
        await loadTranslationProfiles();
    }

    /**
     * Find a language object by ID or name (case-insensitive)
     * @param {Object} languageDefs - Language definitions
     * @param {string} idOrName - Language ID or name to find
     * @returns {Object|null} Language object or null
     */
    // Friendly language names to ISO 639 prefixes, for matching against
    // dialect IDs like 'es-MX' when the exact key/name doesn't match
    const LANGUAGE_NAME_TO_ISO = {
        english: 'en', spanish: 'es', french: 'fr', german: 'de',
        dutch: 'nl', polish: 'pl', portuguese: 'pt', arabic: 'ar',
        hindi: 'hi', japanese: 'ja', korean: 'ko', finnish: 'fi'
    };

    function findLanguageObject(languageDefs, idOrName) {
        if (!languageDefs || idOrName == null || idOrName === '') return null;

        const search = String(idOrName);

        // Direct match
        if (languageDefs[search]) {
            return languageDefs[search];
        }

        // Case-insensitive search
        const searchLower = search.toLowerCase();
        for (const key in languageDefs) {
            const def = languageDefs[key];
            if (key.toLowerCase() === searchLower ||
                def.id?.toLowerCase() === searchLower ||
                def.name?.toLowerCase() === searchLower) {
                return def;
            }
        }

        // Region match: 'spanish' -> 'es', or dialect codes like 'es'/'es-MX'
        const region = LANGUAGE_NAME_TO_ISO[searchLower] || searchLower.split('-')[0];
        for (const key in languageDefs) {
            if (languageDefs[key].id_region === region) {
                return languageDefs[key];
            }
        }

        // Loose name match (e.g. 'spanish' vs 'Spanish (Mexico)')
        for (const key in languageDefs) {
            const name = languageDefs[key].name?.toLowerCase();
            if (name && (name.includes(searchLower) || searchLower.includes(name))) {
                return languageDefs[key];
            }
        }

        return null;
    }

    /**
     * Load and set translation profiles/engines from ADDI
     * Uses /translation_engines endpoint
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
                console.warn('Available translation profiles:',
                    Object.values(profiles || {}).map(p => `${p.Source} -> ${p.Target} (${p.ProfileId})`));
            } else {
                Utils.log(`Profiles set - Agent: ${agentProfile?.ProfileId}, Customer: ${customerProfile?.ProfileId}`, 'info');
            }

            updateDebugPanel();

        } catch (error) {
            Utils.log('Failed to load translation profiles', 'error', error);
        }
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
     * Send a message (public method)
     * Sends as a translated TTS message to the caller.
     * @param {string} text - Optional text to send (defaults to input value)
     */
    async function sendMessage(text = '') {
        const messageText = text || UI.getMessageInput();

        if (!messageText.trim()) return;

        UI.clearMessageInput();
        UI.showLoading();

        try {
            await sendVoiceMessage(messageText);
        } catch (error) {
            Utils.log('Failed to send message', 'error', error);
            UI.showWarning('Failed to send message');
        } finally {
            UI.hideLoading();
        }
    }

    /**
     * Send a voice TTS message
     * @param {string} text - Message text
     */
    async function sendVoiceMessage(text) {
        const transactionId = Config.addi.transactionId;

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
        const langDefs = Config.languages.definitions;
        const transactionId = Config.addi.transactionId;

        if (transactionId) {
            const status = await API.updateTransactionLanguage(
                transactionId,
                selections.target,
                selections.source
            );

            if (status === 200) {
                const callerLabel = langDefs?.[selections.source]?.name || selections.source;
                const agentLabel = langDefs?.[selections.target]?.name || selections.target;
                Utils.log(`Languages updated: Caller=${callerLabel}, Agent=${agentLabel}`, 'success');
            } else {
                UI.showWarning('Failed to update languages');
            }
        }

        await updateLanguageSettings(selections.target, selections.source);
    }

    /**
     * Update debug panel with current state
     */
    function updateDebugPanel() {
        const addi = Config.addi;
        const langSettings = Config.languages;

        UI.updateDebugInfo({
            version: Config.VERSION,
            addiHost: addi.apiHost,
            transactionId: addi.transactionId,
            bearer: addi.bearer ? 'Present' : 'None',
            agentProfile: langSettings.agentProfile?.ProfileId,
            customerProfile: langSettings.customerProfile?.ProfileId
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
