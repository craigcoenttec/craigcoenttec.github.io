/**
 * ADDI POC Widget V2 - Configuration Module
 *
 * Centralizes all configuration constants, URL parameters, and settings.
 * This module handles initialization of config from URL params and session storage.
 */

const Config = (() => {
    'use strict';

    // Widget version
    const VERSION = '2.1.0';

    // Default ADDI Service Endpoints (can be overridden via URL params)
    const ADDI_DEFAULTS = {
        API_HOST: 'https://addi-dev.ttec-cloudapps.com',
        API_ROUTE: '/services/api/ccaas'
    };

    // Default Images
    const IMAGES = {
        WORKFLOW: './assets/sandcastlerobot.jpg',
        CUSTOMER: 'https://dhqbrvplips7x.cloudfront.net/directory/11.25.0-1/assets/images/svg/person.svg'
    };

    // Genesys Cloud SDK Settings
    const SDK_SETTINGS = {
        PERSIST_SETTINGS: true,
        STORAGE_PREFIX: '_mm_'
    };

    // Translation Settings
    const TRANSLATION_DEFAULTS = {
        SOURCE_LANGUAGE: 'auto',
        TARGET_LANGUAGE: 'english',
        AGENT_LANGUAGE: 'english',
        CUSTOMER_LANGUAGE: 'english',
        DELAY_MS: 4000
    };

    // Media Types
    const MEDIA_TYPES = {
        MESSAGE: 'MESSAGE',
        VOICE: 'VOICE',
        OTHER: 'OTHER'
    };

    // Message Sender Types
    const SENDER_TYPES = {
        CUSTOMER: 'Customer',
        AGENT: 'Agent',
        WORKFLOW: 'Workflow'
    };

    // CSS Classes for message styling
    const MESSAGE_CLASSES = {
        CUSTOMER: 'message-bubble message-bubble--customer',
        AGENT: 'message-bubble message-bubble--agent',
        SYSTEM: 'message-bubble message-bubble--system'
    };

    /**
     * Static language definitions (used as fallback)
     * Maps dialect IDs to flag codes
     */
    const LANGUAGE_FLAG_MAP = {
        'ar-EG': 'eg',
        'en-GB': 'gb',
        'en-US': 'us',
        'en-AU': 'au',
        'yue-HK': 'hk',
        'es-CO': 'co',
        'es-ES': 'es',
        'nl-NL': 'nl',
        'fi-FI': 'fi',
        'fr-FR': 'fr',
        'fr-CA': 'ca',
        'de-DE': 'de',
        'hi': 'in',
        'ja-JP': 'jp',
        'ko-KR': 'kr',
        'cmn': 'cn',
        'pl-PL': 'pl',
        'pt-BR': 'br',
        'sk-SK': 'sk',
        'fil-PH': 'ph'
    };

    /**
     * Genesys Cloud configuration - populated from URL params or session storage
     */
    let gcConfig = {
        region: null,
        clientId: null,
        redirectUrl: null,
        conversationId: null,
        language: null,
        translateToken: null
    };

    /**
     * ADDI service configuration - supports bearer token and configurable host
     */
    let addiConfig = {
        apiHost: ADDI_DEFAULTS.API_HOST,
        apiRoute: ADDI_DEFAULTS.API_ROUTE,
        bearer: null
    };

    /**
     * Current user information - populated after authentication
     */
    let userInfo = {
        id: null,
        name: null,
        image: null,
        alias: null
    };

    /**
     * Current conversation state
     */
    let conversationState = {
        mediaType: null,
        communicationId: null,
        participantId: null,
        queueId: null,
        transactionId: null
    };

    /**
     * Language settings
     */
    let languageSettings = {
        agentLanguage: TRANSLATION_DEFAULTS.AGENT_LANGUAGE,
        customerLanguage: TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE,
        agentLanguageObject: null,
        customerLanguageObject: null,
        agentProfile: null,
        customerProfile: null,
        definitions: null
    };

    /**
     * Initialize configuration from URL parameters and session storage
     * @returns {Object} The initialized configuration
     */
    function init() {
        const url = new URL(document.location.href);

        // Get or set Genesys Cloud config values
        gcConfig.region = getOrStoreParam(url, 'gc_region');
        gcConfig.clientId = getOrStoreParam(url, 'gc_clientId');
        gcConfig.redirectUrl = getOrStoreParam(url, 'gc_redirectUrl');
        gcConfig.conversationId = getOrStoreParam(url, 'gc_conversationId');
        gcConfig.language = getOrStoreParam(url, 'gc_language');
        gcConfig.translateToken = getOrStoreParam(url, 'translateToken');

        // Get or set ADDI config values
        addiConfig.bearer = getOrStoreParam(url, 'bearer', 'addi_bearer');
        const addiHost = getOrStoreParam(url, 'addi_host', 'addi_host');
        if (addiHost) {
            addiConfig.apiHost = addiHost;
        }

        // Derive WebSocket host from API host (replace https with wss)
        const wsHost = addiConfig.apiHost.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

        console.log('%cConfig initialized', 'color: green', { gc: gcConfig, addi: addiConfig });
        return gcConfig;
    }

    /**
     * Get parameter from URL or retrieve from session storage
     * Also stores URL param to session storage if present
     * @param {URL} url - The URL object
     * @param {string} paramName - Name of the URL parameter
     * @param {string} storageName - Optional different name for session storage
     * @returns {string|null} The parameter value
     */
    function getOrStoreParam(url, paramName, storageName = null) {
        const storageKey = storageName || paramName;
        const urlValue = url.searchParams.get(paramName);
        if (urlValue) {
            sessionStorage.setItem(storageKey, urlValue);
            return urlValue;
        }
        return sessionStorage.getItem(storageKey);
    }

    /**
     * Set user information after authentication
     * @param {Object} user - User object from Genesys Cloud
     */
    function setUserInfo(user) {
        userInfo.id = user.id;
        userInfo.name = user.name;
        userInfo.image = user.images?.[0]?.imageUri || IMAGES.CUSTOMER;
        userInfo.alias = user.preferredName || user.name;
    }

    /**
     * Set conversation state information
     * @param {Object} state - Partial state object to merge
     */
    function setConversationState(state) {
        Object.assign(conversationState, state);
    }

    /**
     * Set language definitions from JSON or API
     * @param {Object} definitions - Language definitions object
     */
    function setLanguageDefinitions(definitions) {
        languageSettings.definitions = definitions;
    }

    /**
     * Update language settings
     * @param {Object} settings - Partial settings object to merge
     */
    function updateLanguageSettings(settings) {
        Object.assign(languageSettings, settings);
    }

    /**
     * Resolve a dialect ID to a flag code
     * @param {string} dialectId - The dialect ID (e.g., 'en-US', 'es-ES')
     * @returns {string} The flag code (e.g., 'us', 'es')
     */
    function resolveFlagId(dialectId) {
        if (!dialectId) return 'us';

        // Check direct match first
        const directMatch = LANGUAGE_FLAG_MAP[dialectId];
        if (directMatch) return directMatch;

        // Try lowercase match
        const lowerDialect = dialectId.toLowerCase();
        for (const [key, value] of Object.entries(LANGUAGE_FLAG_MAP)) {
            if (key.toLowerCase() === lowerDialect) return value;
        }

        // Try region code only (e.g., 'en' from 'en-US')
        const region = lowerDialect.split('-')[0];
        for (const [key, value] of Object.entries(LANGUAGE_FLAG_MAP)) {
            if (key.toLowerCase().startsWith(region + '-')) return value;
        }

        return 'us'; // Default fallback
    }

    /**
     * Get the full ADDI API URL for an endpoint
     * @param {string} endpoint - The API endpoint (e.g., '/language_maps')
     * @returns {string} The full URL
     */
    function getAddiApiUrl(endpoint) {
        return `${addiConfig.apiHost}${addiConfig.apiRoute}${endpoint}`;
    }

    /**
     * Get the ADDI WebSocket URL for a transaction
     * @param {string} transactionId - The transaction ID
     * @returns {string} The WebSocket URL with bearer token if available
     */
    function getAddiWebSocketUrl(transactionId) {
        const wsHost = addiConfig.apiHost.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
        let url = `${wsHost}${addiConfig.apiRoute}/live/${transactionId}/ws`;
        if (addiConfig.bearer) {
            url += `?bearer=${encodeURIComponent(addiConfig.bearer)}`;
        }
        return url;
    }

    // Public API
    return {
        VERSION,
        ADDI_DEFAULTS,
        IMAGES,
        SDK_SETTINGS,
        TRANSLATION_DEFAULTS,
        MEDIA_TYPES,
        SENDER_TYPES,
        MESSAGE_CLASSES,
        LANGUAGE_FLAG_MAP,

        // Getters for configuration objects
        get gc() { return { ...gcConfig }; },
        get addi() { return { ...addiConfig }; },
        get user() { return { ...userInfo }; },
        get conversation() { return { ...conversationState }; },
        get languages() { return { ...languageSettings }; },

        // Initialization and setters
        init,
        setUserInfo,
        setConversationState,
        setLanguageDefinitions,
        updateLanguageSettings,

        // Utility functions
        resolveFlagId,
        getAddiApiUrl,
        getAddiWebSocketUrl
    };
})();

// Export for ES6 modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}
