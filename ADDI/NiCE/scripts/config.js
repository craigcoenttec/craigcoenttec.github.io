/**
 * ADDI Translation Widget (NiCE CXone Edition) - Configuration Module
 *
 * Standalone ADDI-only configuration. No Genesys Cloud settings.
 * Reads transactionId, bearer, and addi_host from URL params
 * (persisted to session storage for refresh survival).
 */

const Config = (() => {
    'use strict';

    // Widget version
    const VERSION = '1.0.0';

    // Default ADDI Service Endpoints (can be overridden via URL params)
    const ADDI_DEFAULTS = {
        API_HOST: 'https://addi-demo.ttec-cloudapps.com',
        API_ROUTE: '/services/api/ccaas'
    };

    // Translation Settings
    const TRANSLATION_DEFAULTS = {
        SOURCE_LANGUAGE: 'auto',
        TARGET_LANGUAGE: 'english',
        AGENT_LANGUAGE: 'english',
        CUSTOMER_LANGUAGE: 'spanish'
    };

    // Message Sender Types
    const SENDER_TYPES = {
        CUSTOMER: 'Customer',
        AGENT: 'Agent'
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
     * ADDI service configuration - bearer token and configurable host
     */
    let addiConfig = {
        apiHost: ADDI_DEFAULTS.API_HOST,
        apiRoute: ADDI_DEFAULTS.API_ROUTE,
        bearer: null,
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
     * @returns {Object} The initialized ADDI configuration
     */
    function init() {
        const url = new URL(document.location.href);

        addiConfig.bearer = getOrStoreParam(url, 'bearer', 'addi_bearer');
        addiConfig.transactionId = getOrStoreParam(url, 'transactionId', 'addi_transactionId');

        const addiHost = getOrStoreParam(url, 'addi_host', 'addi_host');
        if (addiHost) {
            addiConfig.apiHost = addiHost;
        }

        console.log('%cConfig initialized', 'color: green', { addi: { ...addiConfig, bearer: addiConfig.bearer ? 'Present' : 'None' } });
        return addiConfig;
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
        TRANSLATION_DEFAULTS,
        SENDER_TYPES,
        LANGUAGE_FLAG_MAP,

        // Getters for configuration objects
        get addi() { return { ...addiConfig }; },
        get languages() { return { ...languageSettings }; },

        // Initialization and setters
        init,
        setLanguageDefinitions,
        updateLanguageSettings,

        // Utility functions
        resolveFlagId,
        getAddiApiUrl,
        getAddiWebSocketUrl
    };
})();
