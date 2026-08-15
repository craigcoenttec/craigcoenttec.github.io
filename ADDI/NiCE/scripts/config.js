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
    // Expressed as ADDI dialect codes, which are the canonical language
    // key everywhere in this widget (see normalizeDialectId).
    const TRANSLATION_DEFAULTS = {
        AGENT_LANGUAGE: 'EN-US',
        CUSTOMER_LANGUAGE: 'ES-ES'
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
        'es-US': 'us',
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
     * Configured translation routes from /translation_pairs, keyed by dialect
     * code. /language_maps says which languages exist; only this says which
     * combinations ADDI is actually set up to translate between.
     */
    let routeMap = {};

    /**
     * Which tenant the bearer resolves to. Every /language_maps entry carries
     * its client/subclient, and the bearer is what selects the subclient - so
     * reading it off the catalog is the only way the widget can tell which
     * tenant it is talking to, and therefore the only way to catch a bearer
     * pointed at a different subclient than the transaction.
     */
    let tenant = { clientId: null, subclientId: null };

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
     * Store the tenant's configured translation pairs, indexed by dialect code
     * so they join directly onto the rest of the widget's language handling.
     * @param {Array} pairs - Array from ADDI /translation_pairs
     */
    function setTranslationPairs(pairs) {
        routeMap = {};

        (Array.isArray(pairs) ? pairs : []).forEach(pair => {
            const source = normalizeDialectId(pair.source_dialect);
            const target = normalizeDialectId(pair.target_dialect);
            if (!source || !target) return;

            routeMap[source] = routeMap[source] || new Set();
            routeMap[source].add(target);
        });
    }

    /**
     * Whether any route information was loaded. Callers use this to fall back
     * to ungrouped behavior rather than treating "no data" as "no valid pair".
     * @returns {boolean} True when at least one route is known
     */
    function hasRouteData() {
        return Object.keys(routeMap).length > 0;
    }

    /**
     * Whether ADDI is configured to translate between two languages in both
     * directions. A translated call has to travel both ways, so a one-way
     * route is not enough to call the combination usable.
     * @param {string} a - A dialect code
     * @param {string} b - The other dialect code
     * @returns {boolean} True when both directions are configured
     */
    function isConfiguredPair(a, b) {
        const first = normalizeDialectId(a);
        const second = normalizeDialectId(b);
        if (!first || !second) return false;

        return Boolean(
            routeMap[first] && routeMap[first].has(second) &&
            routeMap[second] && routeMap[second].has(first)
        );
    }

    /**
     * Record the client/subclient the current bearer resolves to
     * @param {string} clientId - ADDI client ID
     * @param {string} subclientId - ADDI subclient ID
     */
    function setTenant(clientId, subclientId) {
        tenant = { clientId: clientId || null, subclientId: subclientId || null };
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

        // Use the dialect's own country suffix when it has one. This is
        // correct for any dialect not in the map ('es-US' -> 'us') and must
        // be tried before the language-prefix scan below, which would other-
        // wise return the first same-language entry ('es-US' -> 'es-CO').
        const [languagePart, countryPart] = lowerDialect.split('-');
        if (countryPart && countryPart.length === 2) {
            return countryPart;
        }

        // Fall back to any entry sharing the language prefix ('en' from 'en-US')
        for (const [key, value] of Object.entries(LANGUAGE_FLAG_MAP)) {
            if (key.toLowerCase().startsWith(languagePart + '-')) return value;
        }

        return 'us'; // Default fallback
    }

    /**
     * Normalize an ADDI dialect code to its canonical form: lowercase
     * language, uppercase country ('ja-jp' / 'JA-JP' -> 'JA-JP').
     * This is the key every language is stored and looked up under.
     * @param {string} dialectId - A dialect code in any casing
     * @returns {string} The normalized code, or '' when there is nothing to normalize
     */
    function normalizeDialectId(dialectId) {
        if (dialectId == null || dialectId === '') return '';

        const [languagePart, countryPart] = String(dialectId).trim().split('-');
        if (!languagePart) return '';

        return countryPart
            ? `${languagePart.toUpperCase()}-${countryPart.toUpperCase()}`
            : languagePart.toUpperCase();
    }

    /**
     * Derive a human-readable label for a dialect code, for languages that
     * are not in the ADDI catalog and therefore have no dialect_display.
     * Uses Intl so 'JA-JP' becomes 'Japanese (Japan)' without a lookup table.
     * @param {string} dialectId - The dialect code (e.g., 'JA-JP')
     * @returns {string} A display name, falling back to the code itself
     */
    function resolveDialectDisplay(dialectId) {
        const code = normalizeDialectId(dialectId);
        if (!code) return '';

        const [languagePart, countryPart] = code.split('-');
        const tag = countryPart
            ? `${languagePart.toLowerCase()}-${countryPart}`
            : languagePart.toLowerCase();

        try {
            const displayNames = new Intl.DisplayNames(['en'], {
                type: 'language',
                fallback: 'none'
            });
            return displayNames.of(tag) || code;
        } catch (error) {
            return code;
        }
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
        get tenant() { return { ...tenant }; },

        // Initialization and setters
        init,
        setLanguageDefinitions,
        updateLanguageSettings,
        setTranslationPairs,
        setTenant,

        // Translation route topology
        hasRouteData,
        isConfiguredPair,

        // Utility functions
        resolveFlagId,
        normalizeDialectId,
        resolveDialectDisplay,
        getAddiApiUrl,
        getAddiWebSocketUrl
    };
})();
