/**
 * ADDI POC Widget V2 - UI Module
 *
 * Handles all user interface rendering, DOM manipulation, and UI state.
 * Provides methods for creating message bubbles, updating dropdowns, etc.
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
            // Dropdowns
            sourceLanguageDropdown: document.getElementById('sourceLanguageDropdown'),
            targetLanguageDropdown: document.getElementById('targetLanguageDropdown'),
            sourceListbox: document.getElementById('sourceListbox'),
            targetListbox: document.getElementById('targetListbox'),

            // Conversation
            conversationPanel: document.getElementById('conversationPanel'),
            conversation: document.getElementById('conversation'),

            // Message Input
            footer: document.getElementById('footer'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            tabPanel: document.getElementById('tabPanel'),
            cannedResponseContainer: document.getElementById('cannedResponseContainer'),

            // Status Indicators
            loadingIndicator: document.getElementById('loadingIndicator'),
            warningMessage: document.getElementById('warningMessage'),

            // Debug Info
            debugEnvironment: document.getElementById('debugEnvironment'),
            debugLanguage: document.getElementById('debugLanguage'),
            debugUser: document.getElementById('debugUser'),
            debugVersion: document.getElementById('debugVersion'),
            debugClientId: document.getElementById('debugClientId'),
            debugConversation: document.getElementById('debugConversation'),
            debugParticipant: document.getElementById('debugParticipant'),
            debugCommunication: document.getElementById('debugCommunication'),
            debugMedia: document.getElementById('debugMedia'),
            debugTransaction: document.getElementById('debugTransaction')
        };

        // Set up event listeners
        setupEventListeners();

        console.log('%cUI initialized', 'color: green');
    }

    /**
     * Set up UI event listeners
     */
    function setupEventListeners() {
        // Enter key sends message
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    App.sendMessage();
                }
            });
        }

        // Drag and drop for canned responses
        if (elements.conversation) {
            elements.conversation.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            elements.conversation.addEventListener('drop', (e) => {
                e.preventDefault();
                const text = e.dataTransfer.getData('text');
                if (text) {
                    App.sendMessage(Utils.replacePlaceholders(text));
                }
            });
        }

        // Set up language dropdown validation
        setupLanguageValidation();
    }

    /**
     * Set up language dropdown validation
     * Prevents selecting the same language for both source and target (except "auto")
     */
    function setupLanguageValidation() {
        const srcDropdown = elements.sourceLanguageDropdown;
        const tgtDropdown = elements.targetLanguageDropdown;

        // Find the Update button
        const updateBtn = document.querySelector('.control-panel__button gux-button');

        /**
         * Check if selections are valid and update button state
         */
        const enforceUnique = () => {
            const sourceVal = srcDropdown?.value;
            const targetVal = tgtDropdown?.value;

            // Allow if either is "auto" or if they're different
            if (sourceVal === targetVal && sourceVal !== 'auto') {
                updateBtn?.setAttribute('disabled', 'true');
                showWarning('Source and target languages cannot be the same', 3000);
            } else {
                updateBtn?.removeAttribute('disabled');
            }
        };

        // Add event listeners for language changes
        if (srcDropdown) {
            srcDropdown.addEventListener('input', enforceUnique);
        }
        if (tgtDropdown) {
            tgtDropdown.addEventListener('input', enforceUnique);
        }

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
        if (!elements.sourceListbox || !elements.targetListbox) {
            console.warn('Language listboxes not found');
            return;
        }

        // Clear existing options
        elements.sourceListbox.innerHTML = '';
        elements.targetListbox.innerHTML = '';

        // Add options for each language
        Object.keys(languageDefs).forEach((key) => {
            const lang = languageDefs[key];

            const option1 = document.createElement('gux-option');
            option1.setAttribute('value', lang.key);
            option1.textContent = lang.name;
            elements.sourceListbox.appendChild(option1);

            const option2 = document.createElement('gux-option');
            option2.setAttribute('value', lang.key);
            option2.textContent = lang.name;
            elements.targetListbox.appendChild(option2);
        });

        console.log('%cLanguage dropdowns populated', 'color: green');
    }

    /**
     * Update language dropdown selections
     * @param {string} customerLanguage - Customer language key
     * @param {string} agentLanguage - Agent language key
     */
    function updateLanguageSelections(customerLanguage, agentLanguage) {
        if (elements.sourceLanguageDropdown) {
            elements.sourceLanguageDropdown.value = customerLanguage;
        }
        if (elements.targetLanguageDropdown) {
            elements.targetLanguageDropdown.value = agentLanguage;
        }
    }

    /**
     * Get current language selections from dropdowns
     * @returns {Object} Object with source and target language values
     */
    function getLanguageSelections() {
        return {
            source: elements.sourceLanguageDropdown?.value || 'auto',
            target: elements.targetLanguageDropdown?.value || 'english'
        };
    }

    // ============================================
    // Message Bubble Functions
    // ============================================

    /**
     * Create and add a message bubble to the conversation
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

        // Create bubble container
        const bubble = document.createElement('div');
        bubble.id = messageid;
        bubble.className = getBubbleClass(SenderType);

        // Create original text section
        const originalSection = createTextSection(
            OriginalText,
            OriginalFlag,
            'message-bubble__original'
        );

        // Create divider
        const divider = document.createElement('div');
        divider.className = 'message-bubble__divider';

        // Create translated text section
        const translatedSection = createTextSection(
            TranslatedText,
            TranslatedFlag,
            'message-bubble__translated'
        );

        // Assemble bubble
        bubble.appendChild(originalSection);
        bubble.appendChild(divider);
        bubble.appendChild(translatedSection);

        // Create and add header
        const header = createMessageHeader(message);

        // Add to conversation
        if (elements.conversation) {
            elements.conversation.appendChild(bubble);
            elements.conversation.appendChild(header);

            // Scroll to bottom
            scrollToBottom();
        }
    }

    /**
     * Create a text section with flag icon
     * @param {string} text - The text content
     * @param {string} flagCode - The flag code
     * @param {string} className - CSS class for the section
     * @returns {HTMLElement} The section element
     */
    function createTextSection(text, flagCode, className) {
        const section = document.createElement('div');
        section.className = className;

        const flag = document.createElement('gux-flag-icon-beta');
        flag.setAttribute('flag', flagCode || 'us');

        const textSpan = document.createElement('span');
        textSpan.className = 'gux-body-lg-semibold';
        textSpan.textContent = text || '';

        section.appendChild(flag);
        section.appendChild(textSpan);

        return section;
    }

    /**
     * Create message header with avatar, sender tag, and timestamp
     * @param {Object} message - Message object
     * @returns {HTMLElement} Header element
     */
    function createMessageHeader(message) {
        const { Timestamp, SenderType } = message;

        const header = document.createElement('div');
        header.className = SenderType === Config.SENDER_TYPES.CUSTOMER
            ? 'message-header message-header--left'
            : 'message-header message-header--right';

        // Timestamp tag
        const timestamp = document.createElement('gux-tag');
        timestamp.setAttribute('size', 'small');
        timestamp.setAttribute('disabled', 'true');
        timestamp.className = 'message-header__timestamp';
        timestamp.textContent = Timestamp || '';

        // Sender tag
        const senderTag = document.createElement('gux-tag');
        senderTag.setAttribute('size', 'small');
        senderTag.className = 'message-header__sender';
        senderTag.textContent = SenderType;
        senderTag.setAttribute('accent', getSenderAccent(SenderType));

        // Avatar
        const avatar = createAvatar(SenderType);

        // Arrange based on sender type
        if (SenderType === Config.SENDER_TYPES.CUSTOMER) {
            header.appendChild(avatar);
            header.appendChild(senderTag);
            header.appendChild(timestamp);
        } else {
            header.appendChild(timestamp);
            header.appendChild(senderTag);
            header.appendChild(avatar);
        }

        return header;
    }

    /**
     * Create an avatar element
     * @param {string} senderType - Type of sender
     * @returns {HTMLElement} Avatar element
     */
    function createAvatar(senderType) {
        const avatar = document.createElement('gux-avatar-beta');
        avatar.setAttribute('size', 'small');

        const img = document.createElement('img');
        img.setAttribute('slot', 'image');

        const user = Config.user;

        switch (senderType) {
            case Config.SENDER_TYPES.AGENT:
                img.setAttribute('src', user.image);
                img.setAttribute('alt', user.name);
                avatar.setAttribute('name', user.name);
                break;
            case Config.SENDER_TYPES.WORKFLOW:
                img.setAttribute('src', Config.IMAGES.WORKFLOW);
                img.setAttribute('alt', 'Workflow');
                avatar.setAttribute('name', 'Workflow');
                break;
            default:
                img.setAttribute('src', Config.IMAGES.CUSTOMER);
                img.setAttribute('alt', 'Customer');
                avatar.setAttribute('name', 'Customer');
        }

        avatar.appendChild(img);
        return avatar;
    }

    /**
     * Get CSS class for message bubble based on sender
     * @param {string} senderType - Type of sender
     * @returns {string} CSS class string
     */
    function getBubbleClass(senderType) {
        switch (senderType) {
            case Config.SENDER_TYPES.AGENT:
                return 'message-bubble message-bubble--agent';
            case Config.SENDER_TYPES.WORKFLOW:
                return 'message-bubble message-bubble--system';
            default:
                return 'message-bubble message-bubble--customer';
        }
    }

    /**
     * Get accent color for sender tag
     * @param {string} senderType - Type of sender
     * @returns {string} Accent number
     */
    function getSenderAccent(senderType) {
        switch (senderType) {
            case Config.SENDER_TYPES.AGENT:
                return '10';
            case Config.SENDER_TYPES.WORKFLOW:
                return '2';
            default:
                return '3';
        }
    }

    // ============================================
    // Canned Response Functions
    // ============================================

    /**
     * Add a canned response card
     * @param {Object} response - Response object with name and content
     */
    function addCannedResponse(response) {
        const { id, name, content } = response;

        // Parse HTML content to plain text
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const textContent = doc.body.textContent || '';

        const container = document.createElement('div');
        container.className = 'canned-response-card';

        const card = document.createElement('gux-selector-card-beta');
        card.setAttribute('draggable', 'true');
        card.setAttribute('variant', 'descriptive');
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text', textContent);
        });
        card.addEventListener('dblclick', () => {
            insertCannedResponse(textContent);
        });

        const label = document.createElement('label');
        label.setAttribute('slot', 'label');
        label.setAttribute('for', id);
        label.textContent = name;

        const input = document.createElement('input');
        input.setAttribute('slot', 'input');
        input.setAttribute('id', id);
        input.setAttribute('type', 'radio');
        input.setAttribute('name', 'cannedResponse');
        input.setAttribute('value', textContent);

        const description = document.createElement('span');
        description.setAttribute('slot', 'description');
        description.textContent = textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');

        card.appendChild(label);
        card.appendChild(input);
        card.appendChild(description);
        container.appendChild(card);

        if (elements.cannedResponseContainer) {
            elements.cannedResponseContainer.appendChild(container);
        }
    }

    /**
     * Insert canned response text into message input
     * @param {string} text - Text to insert
     */
    function insertCannedResponse(text) {
        if (elements.messageInput) {
            elements.messageInput.value = Utils.replacePlaceholders(text);
        }
        // Switch to message tab
        if (elements.tabPanel) {
            elements.tabPanel.setAttribute('active-tab', '1-1');
        }
    }

    // ============================================
    // Status & Loading Functions
    // ============================================

    /**
     * Show loading indicator
     */
    function showLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.visibility = 'visible';
        }
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.visibility = 'hidden';
        }
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     * @param {number} duration - Duration in ms (default 5000)
     */
    function showWarning(message, duration = 5000) {
        if (elements.warningMessage) {
            elements.warningMessage.textContent = message;
            elements.warningMessage.style.visibility = 'visible';

            setTimeout(() => {
                elements.warningMessage.style.visibility = 'hidden';
            }, duration);
        }
    }

    /**
     * Show/hide footer based on conversation type
     * @param {boolean} visible - Whether to show the footer
     */
    function setFooterVisible(visible) {
        if (elements.footer) {
            elements.footer.style.visibility = visible ? 'visible' : 'hidden';
        }
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
        const {
            environment,
            language,
            user,
            version,
            clientId,
            conversationId,
            participantId,
            communicationId,
            mediaType,
            transactionId
        } = info;

        setDebugValue('debugEnvironment', environment);
        setDebugValue('debugLanguage', language);
        setDebugValue('debugUser', user);
        setDebugValue('debugVersion', version);
        setDebugValue('debugClientId', clientId);
        setDebugValue('debugConversation', conversationId);
        setDebugValue('debugParticipant', participantId);
        setDebugValue('debugCommunication', communicationId);
        setDebugValue('debugMedia', mediaType);
        setDebugValue('debugTransaction', transactionId);
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
        addCannedResponse,
        insertCannedResponse,
        showLoading,
        hideLoading,
        showWarning,
        setFooterVisible,
        getMessageInput,
        clearMessageInput,
        scrollToBottom,
        updateDebugInfo
    };
})();

// Export for ES6 modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
