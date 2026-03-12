/**
 * ADDI POC Widget V2 - WebSocket Module
 *
 * Manages WebSocket connections for both Genesys Cloud notifications
 * and ADDI real-time transcription.
 */

const WebSocketManager = (() => {
    'use strict';

    // WebSocket instances
    let genesysSocket = null;
    let addiSocket = null;

    // Reconnection settings
    const RECONNECT_DELAY = 3000;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Callbacks
    let messageCallbacks = {
        genesysMessage: null,
        addiTranscription: null
    };

    // ============================================
    // Genesys Cloud WebSocket
    // ============================================

    /**
     * Connect to Genesys Cloud notification WebSocket
     * @param {string} channelId - Notification channel ID
     * @param {Function} onMessage - Callback for message events
     */
    async function connectGenesys(channelId, onMessage) {
        messageCallbacks.genesysMessage = onMessage;

        const wsUrl = API.getNotificationWebSocketUrl(channelId);
        Utils.log(`Connecting to Genesys WebSocket: ${wsUrl}`, 'info');

        try {
            genesysSocket = new WebSocket(wsUrl);

            genesysSocket.onopen = () => {
                Utils.log('Genesys WebSocket connected', 'success');
                reconnectAttempts = 0;
            };

            genesysSocket.onmessage = (event) => {
                handleGenesysMessage(event);
            };

            genesysSocket.onerror = (error) => {
                Utils.log('Genesys WebSocket error', 'error', error);
            };

            genesysSocket.onclose = (event) => {
                Utils.log('Genesys WebSocket closed', 'warning', event);
                attemptGenesysReconnect(channelId, onMessage);
            };

        } catch (error) {
            Utils.log('Failed to connect to Genesys WebSocket', 'error', error);
        }
    }

    /**
     * Handle incoming Genesys WebSocket message
     * @param {MessageEvent} event - WebSocket message event
     */
    function handleGenesysMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // Log heartbeat differently
            if (data?.eventBody?.message === 'WebSocket Heartbeat') {
                console.log('%c%s Heartbeat', 'color: red', '\u2764\uFE0F');
                return;
            }

            // Handle message notifications
            if (data.topicName?.includes('messages')) {
                Utils.log('Message notification received', 'info', data);

                if (messageCallbacks.genesysMessage) {
                    messageCallbacks.genesysMessage(data);
                }
            }

            // Handle transcription notifications
            if (data.topicName?.includes('transcription')) {
                Utils.log('Transcription notification received', 'info', data);

                const transcripts = data.eventBody?.transcripts;
                if (transcripts && messageCallbacks.addiTranscription) {
                    messageCallbacks.addiTranscription(transcripts);
                }
            }

        } catch (error) {
            Utils.log('Error parsing Genesys WebSocket message', 'error', error);
        }
    }

    /**
     * Attempt to reconnect Genesys WebSocket
     * @param {string} channelId - Channel ID
     * @param {Function} onMessage - Message callback
     */
    function attemptGenesysReconnect(channelId, onMessage) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            Utils.log(`Attempting Genesys reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 'warning');

            setTimeout(() => {
                connectGenesys(channelId, onMessage);
            }, RECONNECT_DELAY);
        } else {
            Utils.log('Max reconnect attempts reached for Genesys WebSocket', 'error');
        }
    }

    // ============================================
    // ADDI WebSocket
    // ============================================

    /**
     * Connect to ADDI transcription WebSocket
     * @param {string} transactionId - ADDI transaction ID
     * @param {Function} onTranscription - Callback for transcription events
     */
    function connectADDI(transactionId, onTranscription) {
        messageCallbacks.addiTranscription = onTranscription;

        const wsUrl = API.getADDIWebSocketUrl(transactionId);
        Utils.log(`Connecting to ADDI WebSocket: ${wsUrl}`, 'info');

        try {
            addiSocket = new WebSocket(wsUrl);

            addiSocket.onopen = () => {
                Utils.log('ADDI WebSocket connected', 'success');
            };

            addiSocket.onmessage = (event) => {
                handleADDIMessage(event);
            };

            addiSocket.onerror = (error) => {
                Utils.log('ADDI WebSocket error', 'error', error);
            };

            addiSocket.onclose = (event) => {
                Utils.log('ADDI WebSocket closed, attempting reconnect...', 'warning');
                // Auto-reconnect for ADDI
                setTimeout(() => {
                    connectADDI(transactionId, onTranscription);
                }, RECONNECT_DELAY);
            };

        } catch (error) {
            Utils.log('Failed to connect to ADDI WebSocket', 'error', error);
        }
    }

    /**
     * Handle incoming ADDI WebSocket message
     * @param {MessageEvent} event - WebSocket message event
     */
    function handleADDIMessage(event) {
        try {
            const data = JSON.parse(event.data);
            Utils.log('ADDI transcription event', 'info', data);

            if (messageCallbacks.addiTranscription) {
                messageCallbacks.addiTranscription(data);
            }

        } catch (error) {
            Utils.log('Error parsing ADDI WebSocket message', 'error', error);
        }
    }

    /**
     * Send a ping to ADDI WebSocket to keep connection alive
     */
    function sendADDIPing() {
        if (addiSocket && addiSocket.readyState === WebSocket.OPEN) {
            addiSocket.send(JSON.stringify({ type: 'ping' }));
        }
    }

    // ============================================
    // Connection Management
    // ============================================

    /**
     * Close all WebSocket connections
     */
    function closeAll() {
        if (genesysSocket) {
            genesysSocket.close();
            genesysSocket = null;
        }

        if (addiSocket) {
            addiSocket.close();
            addiSocket = null;
        }

        Utils.log('All WebSocket connections closed', 'info');
    }

    /**
     * Check if Genesys WebSocket is connected
     * @returns {boolean} Connection status
     */
    function isGenesysConnected() {
        return genesysSocket && genesysSocket.readyState === WebSocket.OPEN;
    }

    /**
     * Check if ADDI WebSocket is connected
     * @returns {boolean} Connection status
     */
    function isADDIConnected() {
        return addiSocket && addiSocket.readyState === WebSocket.OPEN;
    }

    // Public API
    return {
        connectGenesys,
        connectADDI,
        sendADDIPing,
        closeAll,
        isGenesysConnected,
        isADDIConnected
    };
})();

// Export for ES6 modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
}
