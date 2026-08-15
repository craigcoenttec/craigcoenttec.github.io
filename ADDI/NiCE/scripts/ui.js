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
            debugSubclient: document.getElementById('debugSubclient'),
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
     * Set up language dropdown validation.
     *
     * Two rules, deliberately of different strengths: the same language on
     * both sides is nonsense and blocks Update, whereas a combination ADDI has
     * no configured pair for only warns - it is unusual but not impossible,
     * and blocking it would make an in-flight call unmanageable.
     */
    function setupLanguageValidation() {
        const validate = () => {
            const sourceVal = elements.sourceLanguageSelect?.value;
            const targetVal = elements.targetLanguageSelect?.value;

            if (sourceVal && sourceVal === targetVal) {
                elements.updateButton?.setAttribute('disabled', 'true');
                showWarning('Customer and agent languages cannot be the same', 3000);
                return;
            }

            elements.updateButton?.removeAttribute('disabled');

            if (sourceVal && targetVal && Config.hasRouteData() &&
                !Config.isConfiguredPair(sourceVal, targetVal)) {
                showWarning('ADDI has no configured translation pair for that combination', 4000);
            }
        };

        // Changing one side re-groups the other, so the configured options for
        // the new selection surface without anything being removed
        elements.sourceLanguageSelect?.addEventListener('change', () => {
            regroupOptions(elements.targetLanguageSelect, elements.sourceLanguageSelect.value);
            validate();
        });
        elements.targetLanguageSelect?.addEventListener('change', () => {
            regroupOptions(elements.sourceLanguageSelect, elements.targetLanguageSelect.value);
            validate();
        });

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

        // This can be called again when a language is discovered mid-call, so
        // remember the selections and restore them after rebuilding.
        const previousSource = elements.sourceLanguageSelect.value;
        const previousTarget = elements.targetLanguageSelect.value;

        const languages = sortedLanguages(languageDefs);

        renderOptions(elements.sourceLanguageSelect, languages, previousTarget);
        renderOptions(elements.targetLanguageSelect, languages, previousSource);

        setSelectValue(elements.sourceLanguageSelect, previousSource, 'customer', true);
        setSelectValue(elements.targetLanguageSelect, previousTarget, 'agent', true);

        console.log(`%cLanguage dropdowns populated (${languages.length})`, 'color: green');
    }

    /**
     * Language entries sorted by display name, so languages discovered
     * mid-call are not just appended to the bottom of the list
     * @param {Object} languageDefs - Language definitions object
     * @returns {Array} Sorted language entries
     */
    function sortedLanguages(languageDefs) {
        return Object.values(languageDefs || {})
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    /**
     * Render one select's options, split into languages ADDI has a configured
     * translation pair with the counterpart and languages it does not.
     *
     * Grouped rather than filtered on purpose. The pair list is accurate for
     * the tenant it came from, but the bearer picks the tenant and can point
     * somewhere other than the transaction - and hiding a language then makes
     * the live call unrepresentable, which is the failure this widget exists
     * to avoid. Grouping conveys the same information and still degrades
     * safely.
     *
     * @param {HTMLSelectElement} select - The select to fill
     * @param {Array} languages - Sorted language entries
     * @param {string} counterpartValue - The other select's current value
     */
    function renderOptions(select, languages, counterpartValue) {
        if (!select) return;

        select.innerHTML = '';

        const buildOption = (lang) => {
            const option = document.createElement('option');
            option.value = lang.key;
            option.textContent = `${Utils.flagEmoji(lang.flag_id)} ${lang.name}`;
            return option;
        };

        if (!Config.hasRouteData() || !counterpartValue) {
            languages.forEach(lang => select.appendChild(buildOption(lang)));
            return;
        }

        const configured = [];
        const unconfigured = [];
        languages.forEach(lang => {
            (Config.isConfiguredPair(lang.key, counterpartValue) ? configured : unconfigured).push(lang);
        });

        appendGroup(select, 'Configured pairs', configured, buildOption);
        appendGroup(select, 'Not configured', unconfigured, buildOption);
    }

    /**
     * Append a labelled group of options, skipping empty groups
     * @param {HTMLSelectElement} select - The select to append to
     * @param {string} label - Group label
     * @param {Array} languages - Language entries for this group
     * @param {Function} buildOption - Option factory
     */
    function appendGroup(select, label, languages, buildOption) {
        if (languages.length === 0) return;

        const group = document.createElement('optgroup');
        group.label = label;
        languages.forEach(lang => group.appendChild(buildOption(lang)));
        select.appendChild(group);
    }

    /**
     * Re-group one select against a new counterpart value, keeping its
     * current selection
     * @param {HTMLSelectElement} select - The select to re-group
     * @param {string} counterpartValue - The other select's current value
     */
    function regroupOptions(select, counterpartValue) {
        const definitions = Config.languages.definitions;
        if (!select || !definitions) return;

        const current = select.value;
        renderOptions(select, sortedLanguages(definitions), counterpartValue);
        setSelectValue(select, current, 'regroup', true);
    }

    /**
     * Update language dropdown selections
     * @param {string} customerLanguage - Customer language key
     * @param {string} agentLanguage - Agent language key
     */
    function updateLanguageSelections(customerLanguage, agentLanguage) {
        setSelectValue(elements.sourceLanguageSelect, customerLanguage, 'customer');
        setSelectValue(elements.targetLanguageSelect, agentLanguage, 'agent');

        // Re-group both lists now that each has a counterpart to judge against
        regroupOptions(elements.sourceLanguageSelect, elements.targetLanguageSelect?.value);
        regroupOptions(elements.targetLanguageSelect, elements.sourceLanguageSelect?.value);
    }

    /**
     * Set a select's value only if a matching option exists,
     * otherwise keep the current selection (setting an unmatched
     * value would blank the dropdown).
     * @param {HTMLSelectElement} select - The select element
     * @param {string} value - Desired option value
     * @param {string} label - Label for warning logs
     * @param {boolean} quiet - Suppress the warning (used when restoring)
     */
    function setSelectValue(select, value, label, quiet = false) {
        if (!select || value == null || value === '') return;

        const stringValue = String(value);
        const hasOption = Array.from(select.options).some(o => o.value === stringValue);

        if (hasOption) {
            select.value = stringValue;
        } else if (!quiet) {
            console.warn(
                `No dropdown option matches ${label} language "${stringValue}". Available values:`,
                Array.from(select.options).map(o => o.value)
            );
        }
    }

    /**
     * Get current language selections from dropdowns
     * @returns {Object} Object with source and target language values
     */
    function getLanguageSelections() {
        return {
            source: elements.sourceLanguageSelect?.value || Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE,
            target: elements.targetLanguageSelect?.value || Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE
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
        setDebugValue('debugSubclient', info.subclient);
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
