import { MAX_TOPICS_PER_CHANNEL } from './topics.js';

/**
 * @typedef {object} NotificationMessage
 * @property {string} topicName
 * @property {string} [version]
 * @property {any} eventBody
 * @property {Record<string, any>} [metadata]
 */

/**
 * @callback NotificationHandler
 * @param {any} eventBody            the event payload (shape depends on the topic)
 * @param {NotificationMessage} message  the full notification envelope
 * @returns {void|Promise<void>}
 */

/**
 * Pure, synchronous bookkeeping of "which handlers want which topic".
 * It knows nothing about channels or sockets; the NotificationClient
 * reconciles this desired state with the server.
 *
 * Topic matching is case-insensitive, but the casing the caller used is
 * preserved when talking to the API.
 */
export class SubscriptionRegistry {
    /** @type {Map<string, { topic: string, handlers: Set<NotificationHandler> }>} */
    #entries = new Map();

    /**
     * @param {string} topic
     * @param {NotificationHandler} handler
     * @returns {{ isNewTopic: boolean, remove: () => boolean }} `remove()` returns true if the topic has no handlers left
     */
    add(topic, handler) {
        if (typeof handler !== 'function') throw new TypeError('Handler must be a function');
        const key = topic.toLowerCase();
        let entry = this.#entries.get(key);
        const isNewTopic = !entry;
        if (isNewTopic) {
            if (this.#entries.size >= MAX_TOPICS_PER_CHANNEL) {
                throw new RangeError(`A channel supports at most ${MAX_TOPICS_PER_CHANNEL} topics`);
            }
            entry = { topic, handlers: new Set() };
            this.#entries.set(key, entry);
        }
        // Wrap so the same function can be registered twice and removed independently.
        const registration = (...args) => handler(...args);
        entry.handlers.add(registration);

        let removed = false;
        return {
            isNewTopic,
            remove: () => {
                if (removed) return false;
                removed = true;
                entry.handlers.delete(registration);
                if (entry.handlers.size === 0 && this.#entries.get(key) === entry) {
                    this.#entries.delete(key);
                    return true;
                }
                return false;
            },
        };
    }

    /** @param {string} topic */
    has(topic) {
        return this.#entries.has(topic.toLowerCase());
    }

    /** @returns {string[]} every topic with at least one handler */
    topics() {
        return [...this.#entries.values()].map((e) => e.topic);
    }

    get size() {
        return this.#entries.size;
    }

    /**
     * Invoke every handler for the message's topic. Each handler is isolated:
     * a throw (or rejected promise) is reported via `onError` and never
     * prevents the others from running.
     *
     * @param {NotificationMessage} message
     * @param {(error: unknown, topic: string) => void} onError
     * @returns {number} how many handlers were invoked
     */
    dispatch(message, onError) {
        const entry = this.#entries.get(String(message.topicName).toLowerCase());
        if (!entry) return 0;
        const handlers = [...entry.handlers];
        for (const handler of handlers) {
            try {
                const result = handler(message.eventBody, message);
                if (result && typeof result.then === 'function') {
                    result.then(undefined, (err) => onError(err, entry.topic));
                }
            } catch (err) {
                onError(err, entry.topic);
            }
        }
        return handlers.length;
    }

    clear() {
        this.#entries.clear();
    }
}
