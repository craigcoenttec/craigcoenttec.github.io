/**
 * ADDI Translation Widget (NiCE CXone Edition) - WebSocket Module
 *
 * Manages the WebSocket connection for ADDI real-time transcription.
 */

const WebSocketManager = (() => {
    'use strict';

    let addiSocket = null;

    // Reconnection settings
    const RECONNECT_DELAY = 3000;

    // Callbacks
    let transcriptionCallback = null;

    /**
     * Connect to ADDI transcription WebSocket
     * @param {string} transactionId - ADDI transaction ID
     * @param {Function} onTranscription - Callback for transcription events
     */
    function connectADDI(transactionId, onTranscription) {
        transcriptionCallback = onTranscription;

        const wsUrl = API.getADDIWebSocketUrl(transactionId);
        Utils.log('Connecting to ADDI WebSocket...', 'info');

        try {
            addiSocket = new WebSocket(wsUrl);

            addiSocket.onopen = () => {
                Utils.log('ADDI WebSocket connected', 'success');
                UI.setConnectionStatus(true);
            };

            addiSocket.onmessage = (event) => {
                handleADDIMessage(event);
            };

            addiSocket.onerror = (error) => {
                Utils.log('ADDI WebSocket error', 'error', error);
            };

            addiSocket.onclose = (event) => {
                Utils.log('ADDI WebSocket closed, attempting reconnect...', 'warning');
                UI.setConnectionStatus(false);
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

            if (transcriptionCallback) {
                transcriptionCallback(data);
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

    /**
     * Close the WebSocket connection
     */
    function closeAll() {
        if (addiSocket) {
            addiSocket.close();
            addiSocket = null;
        }

        Utils.log('WebSocket connection closed', 'info');
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
        connectADDI,
        sendADDIPing,
        closeAll,
        isADDIConnected
    };
})();
