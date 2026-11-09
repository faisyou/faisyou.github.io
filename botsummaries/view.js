/**
 * DOM rendering only: no API calls, no state beyond what is on screen.
 * All data is written with textContent, never innerHTML, so summary text
 * produced by an LLM cannot inject markup.
 */

const $ = (id) => document.getElementById(id);

/** @param {string} tag @param {string} [className] @param {string} [text] */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

const STATUS_LABELS = {
    idle: 'Not connected',
    connecting: 'Connecting…',
    connected: 'Live',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
    failed: 'Connection failed',
};

/** @param {string} state  a ConnectionState value */
export function setStatus(state, detail = '') {
    const pill = $('status');
    pill.dataset.state = state;
    pill.textContent = STATUS_LABELS[state] ?? state;
    $('status-detail').textContent = detail;
}

export function setStatusDetail(detail) {
    $('status-detail').textContent = detail;
}

export function setContext({ agentName, conversationId, topic }) {
    $('agent').textContent = agentName ?? '';
    $('conversation').textContent = conversationId ?? '';
    $('topic').textContent = topic ?? '';
}

/** @param {{ requiresPermissions?: string[], description?: string }|null} definition */
export function setTopicInfo(definition) {
    if (!definition) return;
    const parts = [];
    if (definition.description) parts.push(definition.description);
    if (definition.requiresPermissions?.length) parts.push(`Requires: ${definition.requiresPermissions.join(', ')}`);
    $('topic-info').textContent = parts.join(' · ');
}

export function showWaiting(message) {
    const list = $('summaries');
    if (list.querySelector('.summary')) return;
    list.replaceChildren(el('p', 'empty', message));
}

/** Show an error banner. @param {unknown} error */
export function showError(error, { action } = {}) {
    const banner = $('banner');
    banner.hidden = false;
    banner.replaceChildren(el('span', null, error instanceof Error ? error.message : String(error)));
    if (action) {
        const button = el('button', 'banner-action', action.label);
        button.addEventListener('click', action.onClick, { once: true });
        banner.append(button);
    }
}

export function clearError() {
    $('banner').hidden = true;
}

/**
 * Ask for a conversation ID when the page wasn't opened from an interaction widget.
 * @param {(conversationId: string) => void} onSubmit
 */
export function showConversationPicker(onSubmit) {
    const form = $('picker');
    form.hidden = false;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = new FormData(form).get('conversationId')?.toString().trim();
        if (value) onSubmit(value);
    });
}

/**
 * Insert or replace a summary card, newest first.
 * @param {import('./summary-model.js').SummaryViewModel} summary
 */
export function upsertSummary(summary) {
    const list = $('summaries');
    list.querySelector('.empty')?.remove();

    const card = renderSummary(summary);
    const existing = [...list.children].find((node) => node.dataset.id === summary.id);
    if (existing) {
        existing.replaceWith(card);
        return;
    }
    const newer = [...list.children].find((node) => (node.dataset.createdAt ?? '') < (summary.createdAt ?? ''));
    list.insertBefore(card, newer ?? null);
    if (summary.source === 'notification') card.classList.add('fresh');
}

/** @param {import('./summary-model.js').SummaryViewModel} s */
function renderSummary(s) {
    const card = el('article', 'summary');
    card.dataset.id = s.id;
    card.dataset.createdAt = s.createdAt ?? '';

    const header = el('header', 'summary-header');
    header.append(el('h2', null, s.headline ?? 'Virtual agent summary'));
    const meta = [s.createdAt ? new Date(s.createdAt).toLocaleString() : null, s.language, s.source === 'notification' ? 'live' : 'loaded']
        .filter(Boolean)
        .join(' · ');
    header.append(el('span', 'summary-meta', meta));
    card.append(header);

    if (s.error) card.append(el('p', 'summary-error', `Summary generation reported: ${s.error}`));
    if (s.text) card.append(el('p', 'summary-text', s.text));

    const facts = el('dl', 'summary-facts');
    const addFact = (label, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return;
        facts.append(el('dt', null, label));
        if (Array.isArray(value)) {
            const dd = el('dd');
            const ul = el('ul');
            for (const item of value) ul.append(el('li', null, item));
            dd.append(ul);
            facts.append(dd);
        } else {
            facts.append(el('dd', null, value));
        }
    };
    addFact('Reason', s.reason);
    addFact('Resolution', s.resolution);
    addFact('Follow-up', s.followUps);
    addFact('Suggested wrap-up', s.wrapUpCodes);
    addFact('Extracted', s.entities.map((e) => `${e.label}: ${e.value}`));
    if (s.confidence !== null) addFact('Confidence', `${Math.round(s.confidence <= 1 ? s.confidence * 100 : s.confidence)}%`);
    if (facts.children.length) card.append(facts);

    return card;
}
