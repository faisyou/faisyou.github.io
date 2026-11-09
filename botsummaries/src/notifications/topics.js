/**
 * Notification topic helpers.
 *
 * Topic names are plain strings such as `v2.users.{id}.presence`. The helpers
 * below exist so callers don't hand-assemble strings (typos in topic names
 * fail silently: the subscription just never fires).
 *
 * Full catalogue: GET /api/v2/notifications/availabletopics, or
 * https://developer.genesys.cloud/notificationsalerts/notifications/available-topics
 */

/** Topics the library handles itself; never subscribe to these. */
export const SYSTEM_TOPICS = Object.freeze({
    /** Heartbeats and ping/pong replies. */
    METADATA: 'channel.metadata',
    /** Sent ~1 minute before the server closes the socket for maintenance. */
    SOCKET_CLOSING: 'v2.system.socket_closing',
});

/** Genesys Cloud limit per channel. */
export const MAX_TOPICS_PER_CHANNEL = 1000;

const TOPIC_RE = /^v2\.[A-Za-z0-9_\-.]+$/;

/**
 * @param {string} topic
 * @throws {TypeError} when the topic is malformed or still contains a `{placeholder}`
 */
export function assertValidTopic(topic) {
    if (typeof topic !== 'string' || !topic) {
        throw new TypeError('Topic must be a non-empty string');
    }
    if (/[{}]/.test(topic)) {
        throw new TypeError(`Topic "${topic}" still contains a {placeholder}; use buildTopic() to fill it in`);
    }
    if (Object.values(SYSTEM_TOPICS).includes(topic)) {
        throw new TypeError(`"${topic}" is a system topic and is handled by the library; listen to client events instead`);
    }
    if (!TOPIC_RE.test(topic)) {
        throw new TypeError(`Topic "${topic}" is not a valid notification topic (expected "v2.<...>")`);
    }
}

/**
 * Fill a documented topic template with values.
 *
 * @example buildTopic('v2.users.{id}.presence', { id: userId })
 * @param {string} template  topic as written in the Genesys docs, with {placeholders}
 * @param {Record<string, string>} params
 * @returns {string}
 */
export function buildTopic(template, params = {}) {
    const topic = template.replace(/\{(\w+)\}/g, (_, name) => {
        const value = params[name];
        if (value === undefined || value === null || value === '') {
            throw new TypeError(`buildTopic: missing value for {${name}} in "${template}"`);
        }
        return String(value);
    });
    assertValidTopic(topic);
    return topic;
}

/**
 * Builders for commonly used topics. Add new ones here rather than
 * scattering string templates through application code.
 */
export const Topics = Object.freeze({
    /** Conversation events for every conversation the user participates in. */
    userConversations: (userId) => buildTopic('v2.users.{id}.conversations', { id: userId }),
    /** AI conversation summaries and headlines for the user's conversations. */
    userConversationSummaries: (userId) => buildTopic('v2.users.{id}.conversations.summaries', { id: userId }),
    /** The user's presence changes. */
    userPresence: (userId) => buildTopic('v2.users.{id}.presence', { id: userId }),
    /** The user's routing status (idle / interacting / not responding...). */
    userRoutingStatus: (userId) => buildTopic('v2.users.{id}.routingStatus', { id: userId }),
    /** Conversation events on a queue. */
    queueConversations: (queueId) => buildTopic('v2.routing.queues.{id}.conversations', { id: queueId }),
    /** Speech transcription of a voice conversation. */
    conversationTranscription: (conversationId) => buildTopic('v2.conversations.{id}.transcription', { id: conversationId }),
    /** Virtual agent (bot) conversation summary. */
    botConversationSummaries: (id) => buildTopic('v2.bot.conversation.{id}.conversations.summaries', { id }),
});
