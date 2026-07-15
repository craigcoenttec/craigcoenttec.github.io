/**
 * ADDI Translation Widget (NiCE CXone Edition) - UI Module
 *
 * Handles all user interface rendering, DOM manipulation, and UI state.
 * Uses plain HTML elements styled to match the NiCE CXone chat
 * experience - no web component libraries.
 */

const UI = (() => {
    'use strict';

    // DOM Element References (cached on init)
    let elements = {};

    /**
     * Initialize UI by caching DOM element references
     */
    function init() {
        elements = {
            // Language selects
            sourceLanguageSelect: document.getElementById('sourceLanguageSelect'),
            targetLanguageSelect: document.getElementById('targetLanguageSelect'),
            updateButton: document.getElementById('updateButton'),

            // Conversation
            conversationPanel: document.getElementById('conversationPanel'),
            conversation: document.getElementById('conversation'),

            // Message Input
            footer: document.getElementById('footer'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),

            // Status Indicators
            loadingIndicator: document.getElementById('loadingIndicator'),
            warningMessage: document.getElementById('warningMessage'),
            connectionDot: document.getElementById('connectionDot'),

            // Debug Info
            debugVersion: document.getElementById('debugVersion'),
            debugHost: document.getElementById('debugHost'),
            debugTransaction: document.getElementById('debugTransaction'),
            debugBearer: document.getElementById('debugBearer'),
            debugWebSocket: document.getElementById('debugWebSocket'),
            debugAgentProfile: document.getElementById('debugAgentProfile'),
            debugCustomerProfile: document.getElementById('debugCustomerProfile')
        };

        setupEventListeners();

        console.log('%cUI initialized', 'color: green');
    }

    /**
     * Set up UI event listeners
     */
    function setupEventListeners() {
        // Enter key sends message (Shift+Enter for newline)
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    App.sendMessage();
                }
            });
        }

        setupLanguageValidation();
    }

    /**
     * Set up language dropdown validation
     * Prevents selecting the same language for both source and target (except "auto")
     */
    function setupLanguageValidation() {
        const enforceUnique = () => {
            const sourceVal = elements.sourceLanguageSelect?.value;
            const targetVal = elements.targetLanguageSelect?.value;

            // Allow if either is "auto" or if they're different
            if (sourceVal === targetVal && sourceVal !== 'auto') {
                elements.updateButton?.setAttribute('disabled', 'true');
                showWarning('Customer and agent languages cannot be the same', 3000);
            } else {
                elements.updateButton?.removeAttribute('disabled');
            }
        };

        elements.sourceLanguageSelect?.addEventListener('change', enforceUnique);
        elements.targetLanguageSelect?.addEventListener('change', enforceUnique);

        console.log('%cLanguage validation initialized', 'color: green');
    }

    // ============================================
    // Language Dropdown Functions
    // ============================================

    /**
     * Populate language dropdowns from definitions
     * @param {Object} languageDefs - Language definitions object
     */
    function populateLanguages(languageDefs) {
        if (!elements.sourceLanguageSelect || !elements.targetLanguageSelect) {
            console.warn('Language selects not found');
            return;
        }

        // Clear existing options
        elements.sourceLanguageSelect.innerHTML = '';
        elements.targetLanguageSelect.innerHTML = '';

        // Add options for each language
        Object.keys(languageDefs).forEach((key) => {
            const lang = languageDefs[key];
            const label = `${Utils.flagEmoji(lang.flag_id)} ${lang.name}`;

            const option1 = document.createElement('option');
            option1.value = lang.key;
            option1.textContent = label;
            elements.sourceLanguageSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = lang.key;
            option2.textContent = label;
            elements.targetLanguageSelect.appendChild(option2);
        });

        console.log('%cLanguage dropdowns populated', 'color: green');
    }

    /**
     * Update language dropdown selections
     * @param {string} customerLanguage - Customer language key
     * @param {string} agentLanguage - Agent language key
     */
    function updateLanguageSelections(customerLanguage, agentLanguage) {
        if (elements.sourceLanguageSelect) {
            elements.sourceLanguageSelect.value = customerLanguage;
        }
        if (elements.targetLanguageSelect) {
            elements.targetLanguageSelect.value = agentLanguage;
        }
    }

    /**
     * Get current language selections from dropdowns
     * @returns {Object} Object with source and target language values
     */
    function getLanguageSelections() {
        return {
            source: elements.sourceLanguageSelect?.value || 'auto',
            target: elements.targetLanguageSelect?.value || 'english'
        };
    }

    // ============================================
    // Message Bubble Functions
    // ============================================

    /**
     * Create and add a message row (header + bubble) to the conversation,
     * styled like a NiCE CXone chat message.
     * @param {Object} message - Message object with translation details
     */
    function addMessageBubble(message) {
        const {
            messageid,
            Timestamp,
            OriginalText,
            OriginalFlag,
            TranslatedText,
            TranslatedFlag,
            SenderType
        } = message;

        const isAgent = SenderType === Config.SENDER_TYPES.AGENT;

        // Row container aligns the whole message left/right
        const row = document.createElement('div');
        row.id = messageid;
        row.className = isAgent
            ? 'message-row message-row--agent'
            : 'message-row message-row--customer';

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = isAgent
            ? 'message-avatar message-avatar--agent'
            : 'message-avatar message-avatar--customer';
        avatar.textContent = isAgent ? 'A' : 'C';
        avatar.setAttribute('aria-hidden', 'true');

        // Body: meta line + bubble
        const body = document.createElement('div');
        body.className = 'message-body';

        const meta = document.createElement('div');
        meta.className = 'message-meta';

        const sender = document.createElement('span');
        sender.className = 'message-meta__sender';
        sender.textContent = SenderType;

        const time = document.createElement('span');
        time.className = 'message-meta__time';
        time.textContent = Utils.formatTimestamp(Timestamp);

        meta.appendChild(sender);
        meta.appendChild(time);

        // Bubble with original and translated sections
        const bubble = document.createElement('div');
        bubble.className = isAgent
            ? 'message-bubble message-bubble--agent'
            : 'message-bubble message-bubble--customer';

        bubble.appendChild(createTextSection(OriginalText, OriginalFlag, 'message-bubble__original'));

        const divider = document.createElement('div');
        divider.className = 'message-bubble__divider';
        bubble.appendChild(divider);

        bubble.appendChild(createTextSection(TranslatedText, TranslatedFlag, 'message-bubble__translated'));

        body.appendChild(meta);
        body.appendChild(bubble);

        row.appendChild(avatar);
        row.appendChild(body);

        if (elements.conversation) {
            elements.conversation.appendChild(row);
            scrollToBottom();
        }
    }

    /**
     * Create a text section with flag emoji
     * @param {string} text - The text content
     * @param {string} flagCode - The flag code
     * @param {string} className - CSS class for the section
     * @returns {HTMLElement} The section element
     */
    function createTextSection(text, flagCode, className) {
        const section = document.createElement('div');
        section.className = className;

        const flag = document.createElement('span');
        flag.className = 'message-bubble__flag';
        flag.textContent = Utils.flagEmoji(flagCode);
        flag.setAttribute('aria-hidden', 'true');

        const textSpan = document.createElement('span');
        textSpan.className = 'message-bubble__text';
        textSpan.textContent = text || '';

        section.appendChild(flag);
        section.appendChild(textSpan);

        return section;
    }

    // ============================================
    // Status & Loading Functions
    // ============================================

    /**
     * Show loading indicator
     */
    function showLoading() {
        elements.loadingIndicator?.classList.add('spinner--visible');
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        elements.loadingIndicator?.classList.remove('spinner--visible');
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     * @param {number} duration - Duration in ms (default 5000)
     */
    function showWarning(message, duration = 5000) {
        if (elements.warningMessage) {
            elements.warningMessage.textContent = message;
            elements.warningMessage.classList.add('warning-banner--visible');

            setTimeout(() => {
                elements.warningMessage.classList.remove('warning-banner--visible');
            }, duration);
        }
    }

    /**
     * Show/hide the message input footer
     * @param {boolean} visible - Whether to show the footer
     */
    function setFooterVisible(visible) {
        if (elements.footer) {
            elements.footer.style.visibility = visible ? 'visible' : 'hidden';
        }
    }

    /**
     * Set the connection status dot state
     * @param {boolean} connected - Whether the ADDI WebSocket is connected
     */
    function setConnectionStatus(connected) {
        if (elements.connectionDot) {
            elements.connectionDot.classList.toggle('connection-dot--connected', connected);
            elements.connectionDot.title = connected ? 'Connected' : 'Disconnected';
        }
        setDebugValue('debugWebSocket', connected ? 'Connected' : 'Disconnected');
    }

    /**
     * Get message input value
     * @returns {string} Current input value
     */
    function getMessageInput() {
        return elements.messageInput?.value || '';
    }

    /**
     * Clear message input
     */
    function clearMessageInput() {
        if (elements.messageInput) {
            elements.messageInput.value = '';
        }
    }

    /**
     * Scroll conversation panel to bottom
     */
    function scrollToBottom() {
        setTimeout(() => {
            if (elements.conversationPanel) {
                elements.conversationPanel.scrollTop = elements.conversationPanel.scrollHeight;
            }
        }, 100);
    }

    // ============================================
    // Debug Panel Functions
    // ============================================

    /**
     * Update debug information panel
     * @param {Object} info - Debug information object
     */
    function updateDebugInfo(info) {
        setDebugValue('debugVersion', info.version);
        setDebugValue('debugHost', info.addiHost);
        setDebugValue('debugTransaction', info.transactionId);
        setDebugValue('debugBearer', info.bearer);
        setDebugValue('debugAgentProfile', info.agentProfile);
        setDebugValue('debugCustomerProfile', info.customerProfile);
    }

    /**
     * Set a debug field value
     * @param {string} elementId - Element ID
     * @param {string} value - Value to set
     */
    function setDebugValue(elementId, value) {
        const element = elements[elementId];
        if (element) {
            element.textContent = value || '-';
        }
    }

    // Public API
    return {
        init,
        populateLanguages,
        updateLanguageSelections,
        getLanguageSelections,
        addMessageBubble,
        showLoading,
        hideLoading,
        showWarning,
        setFooterVisible,
        setConnectionStatus,
        getMessageInput,
        clearMessageInput,
        scrollToBottom,
        updateDebugInfo
    };
})();
