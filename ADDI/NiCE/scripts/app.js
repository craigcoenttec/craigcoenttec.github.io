/**
 * ADDI Translation Widget (NiCE CXone Edition) - Main Application Module
 *
 * Orchestrates the application flow, coordinating between
 * Config, API, UI, Utils, and WebSocket modules.
 *
 * Standalone ADDI-only: requires transactionId (and bearer) via
 * URL parameters. No Genesys Cloud integration.
 */

const App = (() => {
    'use strict';

    // Message tracking
    let messageStore = {};
    let eventCounter = 0;

    /**
     * Initialize the application
     * Called on page load
     */
    async function init() {
        Utils.log('ADDI Translation Widget (NiCE CXone Edition) starting...', 'info');

        try {
            // Initialize configuration from URL params
            Config.init();

            // Initialize UI
            UI.init();

            const transactionId = Config.addi.transactionId;

            if (!transactionId) {
                UI.showWarning('Missing transactionId URL parameter', 10000);
                throw new Error('Transaction ID required (pass ?transactionId=...&bearer=...)');
            }

            // Load language definitions (ADDI API with JSON fallback)
            await loadLanguageDefinitions();

            // Load the tenant's configured routes, used to group the dropdowns
            await loadTranslationPairs();

            // Apply default selections until the transaction languages load.
            const defs = Config.languages.definitions;
            const defaultCustomer = findLanguageObject(defs, Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE);
            const defaultAgent = findLanguageObject(defs, Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE);
            UI.updateLanguageSelections(
                defaultCustomer?.key || Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE,
                defaultAgent?.key || Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE
            );

            // Load language settings from ADDI transaction, then connect the
            // WebSocket regardless of whether the languages resolved.
            await handleADDITransaction();
            WebSocketManager.connectADDI(transactionId, handleADDITranscription);

            // Show footer for TTS message sending
            UI.setFooterVisible(true);

            // Update debug panel
            updateDebugPanel();

            Utils.log('Application initialized successfully', 'success');

        } catch (error) {
            Utils.log('Application initialization failed', 'error', error);
            console.error(error);
        }
    }

    /**
     * Load language definitions - tries ADDI API first, falls back to static JSON
     */
    async function loadLanguageDefinitions() {
        // Try ADDI language_maps API first
        try {
            Utils.log('Attempting to load languages from ADDI API...', 'info');
            const languageMaps = await API.getLanguageMaps();
            console.log('ADDI /language_maps response:', languageMaps);

            if (languageMaps && Array.isArray(languageMaps) && languageMaps.length > 0) {
                captureTenant(languageMaps);
                const languageDefs = transformLanguageMaps(languageMaps);
                Config.setLanguageDefinitions(languageDefs);
                UI.populateLanguages(languageDefs);
                Utils.log(`Language definitions loaded from ADDI (${languageMaps.length} languages)`, 'success');
                return;
            }
        } catch (error) {
            Utils.log('ADDI language_maps failed, falling back to static JSON', 'warning', error);
        }

        // Fallback to static JSON file
        try {
            const response = await fetch('./scripts/languageDefinition.json');
            const staticDefs = await response.json();
            const languageDefs = transformStaticDefinitions(staticDefs);

            Config.setLanguageDefinitions(languageDefs);
            UI.populateLanguages(languageDefs);

            Utils.log('Language definitions loaded from static JSON', 'success');

        } catch (error) {
            Utils.log('Failed to load language definitions from any source', 'error', error);
            throw error;
        }
    }

    /**
     * Load the tenant's configured translation pairs.
     *
     * Advisory, not authoritative: it drives how the dropdowns are grouped,
     * never which languages appear in them. Failing to load it costs grouping
     * and nothing else.
     */
    async function loadTranslationPairs() {
        try {
            const pairs = await API.getTranslationPairs();
            Config.setTranslationPairs(pairs);
            Utils.log(`Loaded ${pairs?.length || 0} configured translation pair(s)`, 'success');
        } catch (error) {
            Utils.log('Could not load translation pairs - dropdowns will not be grouped', 'warning', error);
        }
    }

    /**
     * Record which tenant this bearer resolves to, off the catalog itself.
     *
     * The bearer selects a subclient, and nothing in the widget's inputs says
     * which one - so without this a bearer pointed at the wrong subclient is
     * invisible, and shows up only as languages that mysteriously fail to
     * resolve. See reportUncataloguedLanguages.
     *
     * @param {Array} languageMaps - Raw /language_maps response
     */
    function captureTenant(languageMaps) {
        const scoped = languageMaps.find(entry => entry.subclient_id || entry.client_id);
        if (scoped) {
            Config.setTenant(scoped.client_id, scoped.subclient_id);
        }
    }

    /**
     * Build a language entry keyed by its canonical dialect code.
     *
     * The dialect code is the key rather than the ADDI map ID because it is
     * the one identifier shared by every source of language information:
     * /language_maps (dialect_id), the transaction (agent/caller), and the
     * live transcription events (source/target). The map ID is retained for
     * the transaction-update path, which needs it later.
     *
     * @param {string} dialectId - Dialect code (e.g., 'JA-JP')
     * @param {Object} options - Optional display name and ADDI map ID
     * @returns {Object|null} Language entry, or null without a usable code
     */
    function makeLanguageEntry(dialectId, { name = null, mapId = null } = {}) {
        const code = Config.normalizeDialectId(dialectId);
        if (!code) return null;

        return {
            key: code,
            name: name || Config.resolveDialectDisplay(code),
            id: code,
            id_region: code.split('-')[0].toLowerCase(),
            flag_id: Config.resolveFlagId(code),
            mapId
        };
    }

    /**
     * Transform ADDI language maps response to internal format
     * @param {Array} languageMapList - Array from ADDI /language_maps endpoint
     * @returns {Object} Language definitions keyed by dialect code
     */
    function transformLanguageMaps(languageMapList) {
        const languageDefs = {};

        languageMapList.forEach(entry => {
            const languageEntry = makeLanguageEntry(entry.dialect_id, {
                name: entry.dialect_display || entry.map_name,
                mapId: entry.id
            });

            if (languageEntry) {
                languageDefs[languageEntry.key] = languageEntry;
            } else {
                Utils.log(`Skipping language map "${entry.map_name || entry.id}" - no dialect_id`, 'warning');
            }
        });

        return languageDefs;
    }

    /**
     * Transform the static languageDefinition.json into dialect-code-keyed
     * entries so both language sources produce the same shape.
     *
     * The static file has entries that collide on dialect code (Australian
     * and British are both 'en-GB'); prefer the one whose flag matches the
     * dialect's country so 'en-GB' keeps the British flag.
     *
     * @param {Object} staticDefs - Parsed languageDefinition.json
     * @returns {Object} Language definitions keyed by dialect code
     */
    function transformStaticDefinitions(staticDefs) {
        const languageDefs = {};

        Object.values(staticDefs || {}).forEach(def => {
            const languageEntry = makeLanguageEntry(def.id, { name: def.name });
            if (!languageEntry) return;

            const existing = languageDefs[languageEntry.key];
            if (existing) {
                const country = languageEntry.key.split('-')[1]?.toLowerCase();
                const existingMatchesCountry = existing.flag_id === country;
                const candidateMatchesCountry = def.flag_id?.toLowerCase() === country;
                if (existingMatchesCountry || !candidateMatchesCountry) return;
            }

            // Trust the curated flag from the static file over the derived one
            languageDefs[languageEntry.key] = {
                ...languageEntry,
                flag_id: def.flag_id || languageEntry.flag_id
            };
        });

        return languageDefs;
    }

    // Languages already reported as absent from the catalog, so a mid-call
    // discovery does not re-banner on every subsequent WebSocket event.
    const reportedUncatalogued = new Set();

    /**
     * Ensure the given dialect codes are present in the language list, adding
     * any the catalog does not contain.
     *
     * This is a safety net, not a routine path. On a correctly configured
     * tenant every language on the transaction is in /language_maps; a
     * language that is not means something is wrong upstream, so the entry is
     * added to keep the transcript readable and the condition is reported
     * rather than absorbed.
     *
     * @param {...string} dialectIds - Dialect codes to ensure exist
     * @returns {boolean} True if any language was added
     */
    function ensureLanguages(...dialectIds) {
        const languageDefs = { ...(Config.languages.definitions || {}) };
        const added = [];

        dialectIds.forEach(dialectId => {
            const code = Config.normalizeDialectId(dialectId);
            if (!code || languageDefs[code]) return;

            const languageEntry = makeLanguageEntry(code);
            if (!languageEntry) return;

            languageDefs[code] = languageEntry;
            added.push(languageEntry);
        });

        if (added.length === 0) return false;

        Config.setLanguageDefinitions(languageDefs);
        UI.populateLanguages(languageDefs);
        reportUncataloguedLanguages(added);

        return true;
    }

    /**
     * Report a language that is live on this transaction but missing from
     * /language_maps.
     *
     * The usual cause is that the bearer and the transaction resolve to
     * different subclients, so the catalog being read is not the one the call
     * runs under. Confirmed against a live JA-JP call: its agent_id/caller_id
     * resolved cleanly to catalog entries in its own subclient and matched
     * nothing at all in another's.
     *
     * Worth surfacing rather than quietly patching over, because the same
     * mismatch also breaks profile matching and the Update button - both of
     * which need a catalog entry that does not exist here.
     *
     * @param {Array<Object>} added - Language entries just added
     */
    function reportUncataloguedLanguages(added) {
        const fresh = added.filter(entry => !reportedUncatalogued.has(entry.key));
        if (fresh.length === 0) return;

        fresh.forEach(entry => reportedUncatalogued.add(entry.key));

        const names = fresh.map(entry => `${entry.name} (${entry.key})`).join(', ');
        const subclient = Config.tenant.subclientId || 'unknown';

        Utils.log(
            `${names} is live on this transaction but absent from /language_maps for ` +
            `subclient ${subclient}. The bearer and the transaction may belong to ` +
            `different subclients - profile matching and Update will not work for it.`,
            'warning'
        );
        UI.showWarning(
            `${names} is not in this tenant's language catalog - check that the bearer matches the transaction`,
            10000
        );
    }

    /**
     * Handle ADDI transaction setup
     */
    async function handleADDITransaction() {
        const transactionId = Config.addi.transactionId;

        try {
            // Get and update language settings from ADDI
            const languageSettings = await API.getTransactionLanguage(transactionId);
            console.log('ADDI transaction /languages response:', languageSettings);

            // Prefer the dialect codes (agent/caller) because they are what
            // the live WebSocket events also carry, so one key spans both.
            // agent_id/caller_id are /language_maps IDs and resolve fine as a
            // fallback - findLanguageObject handles either.
            const agentLang = languageSettings.agent || languageSettings.agent_id;
            const callerLang = languageSettings.caller || languageSettings.caller_id;

            if (agentLang && callerLang) {
                // Keep the transaction's languages selectable even if this
                // tenant's catalog somehow does not list them.
                ensureLanguages(agentLang, callerLang);
                await updateLanguageSettings(agentLang, callerLang);
            } else {
                Utils.log('Transaction has no languages set, applying defaults', 'info');
                await updateLanguageSettings(
                    Config.TRANSLATION_DEFAULTS.AGENT_LANGUAGE,
                    Config.TRANSLATION_DEFAULTS.CUSTOMER_LANGUAGE
                );
            }

            Utils.log('ADDI transaction configured', 'success');

        } catch (error) {
            Utils.log('Failed to configure ADDI transaction', 'error', error);
        }
    }

    /**
     * Update language settings and translation profiles
     * @param {string} agentLanguage - Agent language key
     * @param {string} customerLanguage - Customer language key
     */
    async function updateLanguageSettings(agentLanguage, customerLanguage) {
        const languageDefs = Config.languages.definitions;

        // Find language objects - try direct match first, then search
        const agentLangObj = findLanguageObject(languageDefs, agentLanguage);
        const customerLangObj = findLanguageObject(languageDefs, customerLanguage);

        if (!agentLangObj || !customerLangObj) {
            const unresolved = [
                !agentLangObj ? `agent "${agentLanguage}"` : null,
                !customerLangObj ? `customer "${customerLanguage}"` : null
            ].filter(Boolean).join(' and ');

            Utils.log(
                `Could not resolve language(s) - agent "${agentLanguage}" ${agentLangObj ? 'OK' : 'NOT FOUND'}, ` +
                `customer "${customerLanguage}" ${customerLangObj ? 'OK' : 'NOT FOUND'}. ` +
                `Available: ${Object.keys(languageDefs || {}).join(', ')}`,
                'warning'
            );

            // Surface this: an unresolved language means the dropdown is showing
            // something other than what the transaction is actually set to.
            UI.showWarning(`Unrecognized ${unresolved} - the selection below may not match the call`, 8000);
        }

        Config.updateLanguageSettings({
            agentLanguage,
            customerLanguage,
            agentLanguageObject: agentLangObj,
            customerLanguageObject: customerLangObj
        });

        // Use resolved keys so the dropdowns match their option values
        UI.updateLanguageSelections(
            customerLangObj?.key || customerLanguage,
            agentLangObj?.key || agentLanguage
        );

        // Load translation profiles
        await loadTranslationProfiles();
    }

    /**
     * Find a language object by ID or name (case-insensitive)
     * @param {Object} languageDefs - Language definitions
     * @param {string} idOrName - Language ID or name to find
     * @returns {Object|null} Language object or null
     */
    // Friendly language names to ISO 639 prefixes, for matching against
    // dialect IDs like 'es-MX' when the exact key/name doesn't match
    const LANGUAGE_NAME_TO_ISO = {
        english: 'en', spanish: 'es', french: 'fr', german: 'de',
        dutch: 'nl', polish: 'pl', portuguese: 'pt', arabic: 'ar',
        hindi: 'hi', japanese: 'ja', korean: 'ko', finnish: 'fi'
    };

    function findLanguageObject(languageDefs, idOrName) {
        if (!languageDefs || idOrName == null || idOrName === '') return null;

        const search = String(idOrName);

        // Canonical dialect code - the normal path now that entries are keyed
        // by code ('ja-JP', 'JA-JP' and 'JA-jp' all land here)
        const normalized = Config.normalizeDialectId(search);
        if (normalized && languageDefs[normalized]) {
            return languageDefs[normalized];
        }

        // /language_maps ID - what a transaction's agent_id/caller_id are, so
        // a transaction still resolves if only the UUID form is available
        for (const key in languageDefs) {
            if (languageDefs[key].mapId === search) {
                return languageDefs[key];
            }
        }

        // Case-insensitive match on key, dialect code, or display name
        const searchLower = search.toLowerCase();
        for (const key in languageDefs) {
            const def = languageDefs[key];
            if (key.toLowerCase() === searchLower ||
                def.id?.toLowerCase() === searchLower ||
                def.name?.toLowerCase() === searchLower) {
                return def;
            }
        }

        // Language match: 'spanish' -> 'es', or a bare code like 'es'
        const region = LANGUAGE_NAME_TO_ISO[searchLower] || searchLower.split('-')[0];
        for (const key in languageDefs) {
            if (languageDefs[key].id_region === region) {
                return languageDefs[key];
            }
        }

        // Loose name match (e.g. 'spanish' vs 'Spanish (Mexico)'). Only the
        // name-contains-search direction: the reverse lets a short catalog
        // name swallow an unrelated search and return a wrong language, which
        // is worse than reporting nothing.
        for (const key in languageDefs) {
            const name = languageDefs[key].name?.toLowerCase();
            if (name && name.includes(searchLower)) {
                return languageDefs[key];
            }
        }

        return null;
    }

    /**
     * Load and set translation profiles/engines from ADDI
     * Uses /translation_engines endpoint
     *
     * Diagnostic only: the profiles are surfaced in the debug panel and are
     * not used to translate. ADDI performs translation server-side (the live
     * events arrive already translated) and outbound TTS via /speak carries
     * no profile, so a missing profile here does not mean translation is down.
     */
    async function loadTranslationProfiles() {
        try {
            const profiles = await API.getTranslationEngines();
            const langSettings = Config.languages;

            let agentProfile = null;
            let customerProfile = null;

            // Get language IDs for matching (case-insensitive)
            const agentId = langSettings.agentLanguageObject?.id?.toLowerCase() || '';
            const customerId = langSettings.customerLanguageObject?.id?.toLowerCase() || '';

            Object.values(profiles).forEach(profile => {
                const profileSource = profile.Source?.toLowerCase() || '';
                const profileTarget = profile.Target?.toLowerCase() || '';

                // Agent profile: agent language -> customer language
                if (profileSource === agentId && profileTarget === customerId) {
                    agentProfile = profile;
                }
                // Customer profile: customer language -> agent language
                if (profileSource === customerId && profileTarget === agentId) {
                    customerProfile = profile;
                }
            });

            Config.updateLanguageSettings({
                agentProfile,
                customerProfile
            });

            if (!agentProfile || !customerProfile) {
                // Not a warning: ADDI translates pairs that /translation_engines
                // does not list, so this is expected and has no user impact.
                console.debug(
                    `No /translation_engines entry for Agent[${agentId}] -> Customer[${customerId}] (informational). Available:`,
                    Object.values(profiles || {}).map(p => `${p.Source} -> ${p.Target} (${p.ProfileId})`));
            } else {
                Utils.log(`Profiles set - Agent: ${agentProfile?.ProfileId}, Customer: ${customerProfile?.ProfileId}`, 'info');
            }

            updateDebugPanel();

        } catch (error) {
            Utils.log('Failed to load translation profiles', 'error', error);
        }
    }

    /**
     * Handle ADDI transcription event
     * @param {Object} event - Transcription event data
     */
    function handleADDITranscription(event) {
        const eventId = `event_${eventCounter++}`;

        const senderType = event.participant === 'caller'
            ? Config.SENDER_TYPES.CUSTOMER
            : Config.SENDER_TYPES.AGENT;

        // Each event reports the pair ADDI actually translated, which is
        // authoritative and independent of the dropdowns - ADDI translates
        // pairs the catalog does not advertise, and the agent can change the
        // selection mid-call. Fall back to the selections only if absent.
        const selections = UI.getLanguageSelections();
        const isCustomer = senderType === Config.SENDER_TYPES.CUSTOMER;
        const sourceLang = Config.normalizeDialectId(event.source)
            || (isCustomer ? selections.source : selections.target);
        const targetLang = Config.normalizeDialectId(event.target)
            || (isCustomer ? selections.target : selections.source);

        // Keep languages seen on the wire selectable in the dropdowns
        ensureLanguages(sourceLang, targetLang);

        const languageDefs = Config.languages.definitions;

        const messageObj = Utils.createMessageObject({
            messageid: eventId,
            Timestamp: event.timestamp,
            OriginalText: event.text,
            OriginalLanguage: sourceLang,
            OriginalFlag: languageDefs?.[sourceLang]?.flag_id || Config.resolveFlagId(sourceLang),
            TranslatedText: event.translated,
            TranslatedLanguage: targetLang,
            TranslatedFlag: languageDefs?.[targetLang]?.flag_id || Config.resolveFlagId(targetLang),
            SenderType: senderType
        });

        messageStore[eventId] = messageObj;
        UI.addMessageBubble(messageObj);
    }

    /**
     * Send a message (public method)
     * Sends as a translated TTS message to the caller.
     * @param {string} text - Optional text to send (defaults to input value)
     */
    async function sendMessage(text = '') {
        const messageText = text || UI.getMessageInput();

        if (!messageText.trim()) return;

        UI.clearMessageInput();
        UI.showLoading();

        try {
            await sendVoiceMessage(messageText);
        } catch (error) {
            Utils.log('Failed to send message', 'error', error);
            UI.showWarning('Failed to send message');
        } finally {
            UI.hideLoading();
        }
    }

    /**
     * Send a voice TTS message
     * @param {string} text - Message text
     */
    async function sendVoiceMessage(text) {
        const transactionId = Config.addi.transactionId;

        if (!transactionId) {
            Utils.log('No ADDI transaction for voice message', 'warning');
            return;
        }

        await API.sendTTSMessage(transactionId, 'caller', text);
    }

    /**
     * Update language settings from UI (public method)
     */
    async function updateLanguages() {
        const selections = UI.getLanguageSelections();
        const langDefs = Config.languages.definitions;
        const transactionId = Config.addi.transactionId;

        if (transactionId) {
            const callerDef = langDefs?.[selections.source];
            const agentDef = langDefs?.[selections.target];

            // The write path takes /language_maps IDs. Anything added by
            // ensureLanguages has no catalog entry and so no ID to send -
            // better to say so than to send a dialect code the API rejects.
            const missing = [
                !agentDef?.mapId ? `agent "${selections.target}"` : null,
                !callerDef?.mapId ? `customer "${selections.source}"` : null
            ].filter(Boolean).join(' and ');

            if (missing) {
                Utils.log(`Cannot update languages - no /language_maps entry for ${missing}`, 'warning');
                UI.showWarning(`Cannot update: ${missing} is not in this tenant's catalog`, 8000);
            } else {
                const status = await API.updateTransactionLanguage(
                    transactionId,
                    agentDef.mapId,
                    callerDef.mapId
                );

                if (status === 200) {
                    Utils.log(`Languages updated: Caller=${callerDef.name}, Agent=${agentDef.name}`, 'success');
                } else {
                    UI.showWarning(`Failed to update languages (HTTP ${status})`);
                }
            }
        }

        await updateLanguageSettings(selections.target, selections.source);
    }

    /**
     * Update debug panel with current state
     */
    function updateDebugPanel() {
        const addi = Config.addi;
        const langSettings = Config.languages;

        UI.updateDebugInfo({
            version: Config.VERSION,
            addiHost: addi.apiHost,
            transactionId: addi.transactionId,
            bearer: addi.bearer ? 'Present' : 'None',
            subclient: Config.tenant.subclientId,
            agentProfile: langSettings.agentProfile?.ProfileId,
            customerProfile: langSettings.customerProfile?.ProfileId
        });
    }

    // Public API
    return {
        init,
        sendMessage,
        updateLanguages
    };
})();

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
