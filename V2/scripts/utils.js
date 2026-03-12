/**
 * ADDI POC Widget V2 - Utilities Module
 *
 * Provides helper functions used across the application.
 * Includes message object creation, placeholder replacement, etc.
 */

const Utils = (() => {
    'use strict';

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
     * Replace placeholders in text with actual values
     * @param {string} text - Text containing placeholders
     * @returns {string} Text with placeholders replaced
     */
    function replacePlaceholders(text) {
        if (!text) return '';

        const user = Config.user;
        const name = user.name || '';
        const alias = user.alias || user.name || '';

        return text
            .replace(/{{\s*AGENT_NAME\s*}}/g, name)
            .replace(/{{\s*AGENT_ALIAS\s*}}/g, alias);
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
     * Parse HTML content to plain text
     * @param {string} html - HTML string
     * @returns {string} Plain text content
     */
    function htmlToText(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    }

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
     * Sort messages by timestamp
     * @param {Array} messages - Array of message objects
     * @returns {Array} Sorted array
     */
    function sortMessagesByTime(messages) {
        return [...messages].sort((a, b) => {
            const timeA = new Date(a.messageTime || a.Timestamp).getTime();
            const timeB = new Date(b.messageTime || b.Timestamp).getTime();
            return timeA - timeB;
        });
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
        replacePlaceholders,
        delay,
        formatTimestamp,
        htmlToText,
        deepClone,
        debounce,
        getFlagCode,
        getLanguageObject,
        sortMessagesByTime,
        generateId,
        log
    };
})();

// Export for ES6 modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
