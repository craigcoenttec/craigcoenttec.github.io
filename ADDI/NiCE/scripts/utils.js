/**
 * ADDI Translation Widget (NiCE CXone Edition) - Utilities Module
 *
 * Provides helper functions used across the application.
 */

const Utils = (() => {
    'use strict';

    /**
     * Flag code corrections for codes that are not valid
     * ISO 3166-1 alpha-2 country codes
     */
    const FLAG_CODE_FIXES = {
        ja: 'jp',
        ko: 'kr',
        ch: 'cn'
    };

    /**
     * Create a standardized message object
     * @param {Object} params - Message parameters
     * @returns {Object} Standardized message object
     */
    function createMessageObject({
        messageid,
        Timestamp,
        OriginalText = '',
        OriginalLanguage,
        OriginalFlag,
        TranslatedText = '',
        TranslatedLanguage,
        TranslatedFlag,
        TranslationSource = 'ADDI',
        SenderType
    }) {
        return {
            messageid,
            Timestamp,
            OriginalText,
            OriginalLanguage,
            OriginalFlag,
            TranslatedText,
            TranslatedLanguage,
            TranslatedFlag,
            TranslationSource,
            SenderType,
            messageSender: SenderType // Legacy compatibility
        };
    }

    /**
     * Convert a two-letter flag code to a flag emoji
     * @param {string} code - Two-letter country/flag code (e.g., 'us', 'es')
     * @returns {string} Flag emoji or globe fallback
     */
    function flagEmoji(code) {
        let cc = (code || 'us').toLowerCase();
        cc = FLAG_CODE_FIXES[cc] || cc;

        if (!/^[a-z]{2}$/.test(cc)) return '\u{1F310}'; // globe fallback

        return String.fromCodePoint(
            ...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 97)
        );
    }

    /**
     * Create a promise-based delay
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format a timestamp for display
     * @param {string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted timestamp
     */
    function formatTimestamp(timestamp) {
        if (!timestamp) return '';

        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

        if (isNaN(date.getTime())) return timestamp;

        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Get flag code for a language key
     * @param {Object} languageDefs - Language definitions
     * @param {string} languageKey - Language key
     * @returns {string} Flag code
     */
    function getFlagCode(languageDefs, languageKey) {
        return languageDefs?.[languageKey]?.flag_id || 'us';
    }

    /**
     * Get language object from definitions
     * @param {Object} languageDefs - Language definitions
     * @param {string} languageKey - Language key
     * @returns {Object|null} Language object or null
     */
    function getLanguageObject(languageDefs, languageKey) {
        return languageDefs?.[languageKey] || null;
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    function generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Log with color coding
     * @param {string} message - Message to log
     * @param {string} type - Log type (success, warning, error, info)
     * @param {any} data - Additional data to log
     */
    function log(message, type = 'info', data = null) {
        const colors = {
            success: 'color: green',
            warning: 'color: orange',
            error: 'color: red',
            info: 'color: blue'
        };

        const color = colors[type] || colors.info;

        if (data) {
            console.log(`%c${message}`, color, data);
        } else {
            console.log(`%c${message}`, color);
        }
    }

    // Public API
    return {
        createMessageObject,
        flagEmoji,
        delay,
        formatTimestamp,
        getFlagCode,
        getLanguageObject,
        generateId,
        log
    };
})();
