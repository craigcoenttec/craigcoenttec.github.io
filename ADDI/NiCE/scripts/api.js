/**
 * ADDI Translation Widget (NiCE CXone Edition) - API Module
 *
 * Handles all API interactions with ADDI services.
 * Authentication: bearer token passed via URL parameter.
 * Endpoint pattern: /services/api/ccaas/transactions/{id}/...
 */

const API = (() => {
    'use strict';

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
     * Get language maps from ADDI (dynamic language loading)
     * @returns {Promise<Array>} Array of language map entries
     */
    async function getLanguageMaps() {
        return addiRequest('/language_maps');
    }

    /**
     * Get translation engines/profiles from ADDI
     * @returns {Promise<Object>} Translation engines/profiles data
     */
    async function getTranslationEngines() {
        return addiRequest('/translation_engines');
    }

    /**
     * Get the translation pairs configured for this tenant. Each entry carries
     * both the dialect codes and the /language_maps IDs of its two ends.
     * @returns {Promise<Array>} Array of configured source/target pairs
     */
    async function getTranslationPairs() {
        return addiRequest('/translation_pairs');
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
     * Update language settings for a transaction.
     *
     * The values are /language_maps IDs, not dialect codes. The matching GET
     * returns agent_id/caller_id taken straight from the catalog (verified
     * against a live JA-JP call, where both resolved to catalog entries in the
     * transaction's own subclient), and sending dialect codes here is
     * rejected. The field names stay agent/caller - only the namespace of the
     * values matters.
     *
     * @param {string} transactionId - The transaction ID
     * @param {string} agentMapId - Agent language's /language_maps ID
     * @param {string} callerMapId - Caller language's /language_maps ID
     * @returns {Promise<number>} HTTP status code
     */
    async function updateTransactionLanguage(transactionId, agentMapId, callerMapId) {
        const url = Config.getAddiApiUrl(`/transactions/${transactionId}/languages`);
        const response = await fetch(url, {
            method: 'PUT',
            headers: getAddiHeaders(),
            body: JSON.stringify({
                transaction_id: transactionId,
                agent: agentMapId,
                caller: callerMapId
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
     * @param {boolean} translationOnly - If true, adds X-Translation-Only header to skip TTS
     * @returns {Promise<Object>} Translation result
     */
    async function translateText(transactionId, party, text, profileId, translationOnly = false) {
        const additionalHeaders = {};

        if (translationOnly) {
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
        getLanguageMaps,
        getTranslationEngines,
        getTranslationPairs,
        getTransactionLanguage,
        updateTransactionLanguage,
        translateText,
        sendTTSMessage,
        getADDIWebSocketUrl,
        getAddiHeaders
    };
})();
