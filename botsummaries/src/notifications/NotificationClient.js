import { EventEmitter } from '../core/EventEmitter.js';
import { createBackoff } from '../core/backoff.js';
import { systemClock } from '../core/clock.js';
import { ApiError, AuthError, NotificationError } from '../core/errors.js';
import { silentLogger } from '../core/logger.js';
import { DEFAULTS } from '../config.js';
import { SocketConnection } from './SocketConnection.js';
import { SubscriptionRegistry } from './SubscriptionRegistry.js';
import { SYSTEM_TOPICS, assertValidTopic } from './topics.js';

/** Lifecycle states. Transitions are announced with the `stateChange` event. */
export const ConnectionState = Object.freeze({
    /** Created, `connect()` not called yet. */
    IDLE: 'idle',
    /** First connection attempt(s) in progress. */
    CONNECTING: 'connecting',
    /** Socket open and subscriptions applied. */
    CONNECTED: 'connected',
    /** Lost the connection after having been connected; retrying. */
    RECONNECTING: 'reconnecting',
    /** `disconnect()` was called. `connect()` may be called again. */
    DISCONNECTED: 'disconnected',
    /** Unrecoverable: auth failure or reconnect attempts exhausted. `connect()` may be called again. */
    FAILED: 'failed',
});

const CHANNELS_PATH = '/api/v2/notifications/channels';
const DEFAULT_CHANNEL_LIFETIME_MS = 24 * 60 * 60_000;
/** How long after a channel swap we de-duplicate events arriving on both sockets. */
const OVERLAP_DEDUPE_MS = 10_000;

/**
 * @typedef {object} Subscription
 * @property {string} topic
 * @property {() => Promise<void>} unsubscribe  removes this handler (and the server-side topic when it was the last one)
 */

/**
 * Manages one Genesys Cloud notification channel and its WebSocket, and keeps
 * them healthy for the lifetime of the page.
 *
 * Reliability features:
 *   - Reconnects with exponential backoff and jitter; waits for `online` when offline.
 *   - Detects silently dead sockets with a ping/pong watchdog.
 *   - Rolls over to a fresh channel *before* the 24h channel expiry and when the
 *     server sends `v2.system.socket_closing`. The new socket is opened and subscribed
 *     before the old one is closed, and events seen on both are de-duplicated.
 *   - Re-applies every subscription after any reconnect (desired-state reconciliation:
 *     the full topic list is PUT, so server state can't drift from client state).
 *   - Isolates handler errors so one failing handler can't break the stream.
 *
 * Events:
 *   - `stateChange`          { state, previous, error? }
 *   - `connected`            { channelId, reconnected, rollover }  if `reconnected` is true, events may have been
 *                            missed while offline; re-fetch anything you need from the REST API
 *   - `disconnected`         { code, reason, cause }
 *   - `reconnecting`         { attempt, delayMs, waitingForNetwork, error? }
 *   - `rollover`             { reason }
 *   - `heartbeat`            eventBody of channel.metadata frames
 *   - `notification`         every dispatched NotificationMessage (for logging / catch-all handling)
 *   - `handlerError`         { error, topic, message }
 *   - `subscriptionRejected` { topics }  topics the server silently dropped (usually missing permissions)
 *   - `error`                NotificationError | AuthError  for failures that need attention
 */
export class NotificationClient extends EventEmitter {
    #api;
    #opts;
    #WebSocket;
    #clock;
    #logger;
    #network;
    #registry = new SubscriptionRegistry();
    #backoff;

    #state = ConnectionState.IDLE;
    /** @type {{ id: string, connectUri: string, expiresAt: number, hasSubscriptions: boolean }|null} */
    #channel = null;
    #channelFailures = 0;
    /** @type {SocketConnection|null} */
    #conn = null;
    /** The previous socket while a new one is being set up (make-before-break). */
    /** @type {SocketConnection|null} */
    #retiring = null;
    #hasConnected = false;
    #generation = 0;
    #reconnectTimer = null;
    #rolloverTimer = null;
    #rolloverInFlight = false;
    #waitingForNetwork = false;
    #overlapUntil = 0;
    #recentDuringOverlap = new Set();
    #syncTail = Promise.resolve();
    #pendingSync = null;
    #offNetwork;
    #disposed = false;

    /**
     * @param {object} options
     * @param {import('../http/ApiClient.js').ApiClient} options.api
     * @param {typeof DEFAULTS.notifications} [options.options]  usually `config.notifications`
     * @param {typeof WebSocket} [options.WebSocket]
     * @param {import('../core/clock.js').Clock} [options.clock]
     * @param {import('../core/logger.js').Logger} [options.logger]
     * @param {{ isOnline(): boolean, onOnline(cb: () => void): () => void }} [options.network]
     * @param {() => number} [options.random]  for backoff jitter (tests)
     */
    constructor({
        api,
        options = DEFAULTS.notifications,
        WebSocket: WebSocketImpl = globalThis.WebSocket,
        clock = systemClock,
        logger = silentLogger,
        network = browserNetwork(),
        random = Math.random,
    }) {
        super();
        this.#api = api;
        this.#opts = options;
        this.#WebSocket = WebSocketImpl;
        this.#clock = clock;
        this.#logger = logger;
        this.#network = network;
        this.#backoff = createBackoff({
            initialDelayMs: options.reconnect.initialDelayMs,
            maxDelayMs: options.reconnect.maxDelayMs,
            random,
        });
        this.#offNetwork = network.onOnline(() => this.#onNetworkOnline());
    }

    /** @returns {typeof ConnectionState[keyof typeof ConnectionState]} */
    get state() {
        return this.#state;
    }

    get isConnected() {
        return this.#state === ConnectionState.CONNECTED;
    }

    /** ID of the current notification channel, or null. */
    get channelId() {
        return this.#channel?.id ?? null;
    }

    /** Every topic that currently has at least one handler. */
    get topics() {
        return this.#registry.topics();
    }

    /**
     * Open the channel and socket. Safe to call repeatedly.
     * Transient failures are retried according to the reconnect policy, so the
     * promise resolves on the first successful connection and rejects only on
     * an unrecoverable error (auth, attempts exhausted) or `disconnect()`.
     *
     * Subscriptions registered before `connect()` are applied as part of it.
     * @returns {Promise<void>}
     */
    connect() {
        this.#assertNotDisposed();
        if (this.#state === ConnectionState.CONNECTED) return Promise.resolve();
        const settled = this.#untilSettled();
        if (this.#state !== ConnectionState.CONNECTING && this.#state !== ConnectionState.RECONNECTING) {
            this.#backoff.reset();
            this.#setState(ConnectionState.CONNECTING);
            this.#attempt();
        }
        return settled;
    }

    /**
     * Close the socket and stop reconnecting. Handlers stay registered, so a
     * later `connect()` resumes exactly where you left off.
     */
    disconnect() {
        this.#halt();
        this.#setState(ConnectionState.DISCONNECTED);
    }

    /**
     * Register a handler for a topic. Multiple handlers per topic share one
     * server-side subscription.
     *
     * When connected, resolves after the server has accepted the topic, and
     * rejects (with the handler removed again) if the server refuses it. When not
     * connected yet, resolves immediately; the topic is applied on connect.
     *
     * @param {string} topic  e.g. Topics.userPresence(userId)
     * @param {import('./SubscriptionRegistry.js').NotificationHandler} handler
     * @returns {Promise<Subscription>}
     */
    async subscribe(topic, handler) {
        this.#assertNotDisposed();
        assertValidTopic(topic);
        const registration = this.#registry.add(topic, handler);
        const subscription = Object.freeze({
            topic,
            unsubscribe: () => this.#release(registration),
        });

        // Without an open socket, the next connect applies the full topic list anyway.
        if (!registration.isNewTopic || !this.#conn) return subscription;

        let result;
        try {
            result = await this.#requestSync();
        } catch (err) {
            registration.remove();
            this.#requestSync().catch(() => {});
            throw new NotificationError(`Could not subscribe to ${topic}: ${err.message}`, { code: 'SUBSCRIBE_FAILED', cause: err });
        }
        if (result.rejected.some((t) => t.toLowerCase() === topic.toLowerCase())) {
            registration.remove();
            throw new NotificationError(
                `Genesys Cloud did not accept topic ${topic}; check that the user has the permissions the topic requires`,
                { code: 'SUBSCRIPTION_REJECTED' },
            );
        }
        return subscription;
    }

    /**
     * Convenience: subscribe to several topics with one handler map, applied in a
     * single API call.
     * @param {Record<string, import('./SubscriptionRegistry.js').NotificationHandler>} handlersByTopic
     * @returns {Promise<Subscription[]>}
     */
    subscribeAll(handlersByTopic) {
        return Promise.all(Object.entries(handlersByTopic).map(([topic, handler]) => this.subscribe(topic, handler)));
    }

    /**
     * List the notification topics available to this user, with descriptions,
     * required permissions and payload schemas.
     * @param {object} [options]
     * @param {string[]} [options.expand=['description','requiresPermissions','schema']]
     * @returns {Promise<Array<{ id: string, description?: string, requiresPermissions?: string[], schema?: object }>>}
     */
    async getAvailableTopics({ expand = ['description', 'requiresPermissions', 'schema'] } = {}) {
        const res = await this.#api.get('/api/v2/notifications/availabletopics', { query: { expand: expand.join(',') } });
        return res?.entities ?? [];
    }

    /**
     * Find the documented definition (template, permissions, schema) matching a
     * concrete topic, e.g. "v2.users.1234.presence" → "v2.users.{id}.presence".
     * @param {string} topic
     */
    async describeTopic(topic) {
        const all = await this.getAvailableTopics();
        return all.find((def) => topicTemplateToRegExp(def.id).test(topic)) ?? null;
    }

    /** Disconnect and release every resource. The instance can't be reused. */
    dispose() {
        if (this.#disposed) return;
        this.disconnect();
        this.#disposed = true;
        this.#offNetwork();
        this.#registry.clear();
        this.removeAllListeners();
    }

    // ------------------------------------------------------------ connection

    async #attempt() {
        this.#clock.clearTimeout(this.#reconnectTimer);
        this.#reconnectTimer = null;
        try {
            await this.#establish({ rollover: false });
        } catch (err) {
            if (this.#state === ConnectionState.DISCONNECTED || this.#state === ConnectionState.FAILED) return;
            if (err instanceof AuthError) {
                this.#fail(err);
                return;
            }
            this.#logger.warn('Connection attempt failed:', err.message);
            this.#scheduleReconnect(err);
        }
    }

    /**
     * Open a socket on a (possibly new) channel, apply subscriptions, and only
     * then retire the previous socket (make-before-break).
     */
    async #establish({ rollover }) {
        const generation = ++this.#generation;
        const superseded = () => generation !== this.#generation;

        let channel = this.#channel;
        if (rollover || !channel || this.#channelFailures >= 2 || this.#isNearExpiry(channel)) {
            channel = await this.#createChannel();
            this.#channelFailures = 0;
        }
        if (superseded()) return;
        this.#channel = channel;

        const conn = new SocketConnection({
            url: channel.connectUri,
            WebSocket: this.#WebSocket,
            clock: this.#clock,
            logger: this.#logger,
            pingIntervalMs: this.#opts.pingIntervalMs,
            pongTimeoutMs: this.#opts.pongTimeoutMs,
            connectTimeoutMs: this.#opts.connectTimeoutMs,
        });
        try {
            await conn.open();
        } catch (err) {
            this.#channelFailures++;
            throw err;
        }
        if (superseded()) {
            conn.close(1000, 'superseded');
            return;
        }

        conn.on('message', (message) => this.#onMessage(message));
        conn.on('close', (info) => this.#onSocketClose(conn, info));

        const previous = this.#conn;
        this.#retiring = previous;
        this.#conn = conn;
        if (previous) this.#overlapUntil = this.#clock.now() + OVERLAP_DEDUPE_MS;

        const backOut = () => {
            this.#conn = previous?.isOpen ? previous : null;
            this.#retiring = null;
            conn.close(1000, 'setup failed');
        };

        try {
            await this.#requestSync();
        } catch (err) {
            if (err instanceof AuthError || (err instanceof ApiError && err.status === 404)) {
                // Channel unusable (or token gone): back out and let the caller decide.
                if (err instanceof ApiError) this.#channel = null;
                backOut();
                throw err;
            }
            // Topic-level problem: keep the connection, surface the error.
            this.#logger.error('Could not apply subscriptions:', err.message);
            this.emit('error', new NotificationError('Failed to apply subscriptions', { code: 'SUBSCRIPTION_SYNC_FAILED', cause: err }));
        }
        if (superseded()) return;
        if (this.#conn !== conn) {
            // The new socket died while we were subscribing.
            backOut();
            throw new NotificationError('Socket closed during setup', { code: 'SOCKET_CLOSED' });
        }

        this.#retiring = null;
        if (previous) {
            previous.close(1000, 'replaced by new channel');
            this.#overlapUntil = this.#clock.now() + OVERLAP_DEDUPE_MS;
        }

        this.#scheduleRollover(channel);
        this.#backoff.reset();
        const reconnected = this.#hasConnected && !rollover;
        this.#hasConnected = true;
        this.#setState(ConnectionState.CONNECTED);
        this.#logger.info(`Connected on channel ${channel.id}${reconnected ? ' (reconnected)' : ''}${rollover ? ' (rollover)' : ''}`);
        this.emit('connected', { channelId: channel.id, reconnected, rollover });
    }

    async #createChannel() {
        const res = await this.#api.post(CHANNELS_PATH);
        if (!res?.id || !res?.connectUri) {
            throw new NotificationError('Unexpected response when creating notification channel', { code: 'CHANNEL_CREATE_FAILED' });
        }
        const parsed = res.expires ? Date.parse(res.expires) : NaN;
        const expiresAt = Number.isNaN(parsed) ? this.#clock.now() + DEFAULT_CHANNEL_LIFETIME_MS : parsed;
        this.#logger.debug(`Created channel ${res.id}, expires ${new Date(expiresAt).toISOString()}`);
        return { id: res.id, connectUri: res.connectUri, expiresAt, hasSubscriptions: false };
    }

    #isNearExpiry(channel) {
        return channel.expiresAt - this.#opts.channelRolloverMarginMs <= this.#clock.now();
    }

    #onSocketClose(conn, info) {
        if (conn === this.#retiring) {
            this.#retiring = null;
            return;
        }
        if (conn !== this.#conn) return; // a retired socket; nothing to do
        this.#conn = null;
        if (this.#retiring?.isOpen) {
            // A rollover's new socket died; the old one is still serving events.
            this.#conn = this.#retiring;
            this.#retiring = null;
            this.#logger.warn('New socket closed during rollover; keeping the previous one');
            return;
        }
        this.#clock.clearTimeout(this.#rolloverTimer);
        if (this.#state !== ConnectionState.CONNECTED) return;
        this.#logger.warn(`Socket closed (${info.cause}, code ${info.code}${info.reason ? `: ${info.reason}` : ''})`);
        this.emit('disconnected', info);
        this.#scheduleReconnect();
    }

    #scheduleReconnect(error) {
        if (this.#disposed || this.#state === ConnectionState.DISCONNECTED || this.#state === ConnectionState.FAILED) return;

        const { maxAttempts } = this.#opts.reconnect;
        if (maxAttempts !== null && this.#backoff.attempt >= maxAttempts) {
            this.#fail(new NotificationError(`Gave up after ${maxAttempts} reconnect attempts`, { code: 'RECONNECT_EXHAUSTED', cause: error }));
            return;
        }

        this.#setState(this.#hasConnected ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING);

        if (!this.#network.isOnline()) {
            this.#waitingForNetwork = true;
            this.#logger.info('Browser is offline; waiting for the network before reconnecting');
            this.emit('reconnecting', { attempt: this.#backoff.attempt + 1, delayMs: null, waitingForNetwork: true, error });
            return;
        }

        const delayMs = this.#backoff.next();
        this.#logger.info(`Reconnecting in ${delayMs}ms (attempt ${this.#backoff.attempt})`);
        this.emit('reconnecting', { attempt: this.#backoff.attempt, delayMs, waitingForNetwork: false, error });
        this.#reconnectTimer = this.#clock.setTimeout(() => this.#attempt(), delayMs);
    }

    #onNetworkOnline() {
        if (this.#state === ConnectionState.CONNECTED) {
            this.#conn?.probe();
            return;
        }
        if (this.#waitingForNetwork || this.#reconnectTimer) {
            this.#waitingForNetwork = false;
            this.#logger.info('Network is back; reconnecting now');
            this.#attempt();
        }
    }

    #scheduleRollover(channel) {
        this.#clock.clearTimeout(this.#rolloverTimer);
        const delay = Math.min(2 ** 31 - 1, Math.max(0, channel.expiresAt - this.#opts.channelRolloverMarginMs - this.#clock.now()));
        this.#rolloverTimer = this.#clock.setTimeout(() => this.#rollover('channel expiring'), delay);
    }

    async #rollover(reason) {
        if (this.#state !== ConnectionState.CONNECTED || this.#rolloverInFlight) return;
        this.#rolloverInFlight = true;
        this.#logger.info(`Rolling over to a new channel: ${reason}`);
        this.emit('rollover', { reason });
        try {
            await this.#establish({ rollover: true });
        } catch (err) {
            if (err instanceof AuthError) {
                this.#fail(err);
                return;
            }
            // The old socket is still serving events; try again shortly.
            if (!this.#conn) {
                this.#scheduleReconnect(err);
                return;
            }
            const delayMs = this.#backoff.next();
            this.#logger.warn(`Channel rollover failed (${err.message}); retrying in ${delayMs}ms`);
            this.#rolloverTimer = this.#clock.setTimeout(() => this.#rollover(reason), delayMs);
        } finally {
            this.#rolloverInFlight = false;
        }
    }

    #halt() {
        this.#generation++;
        this.#clock.clearTimeout(this.#reconnectTimer);
        this.#clock.clearTimeout(this.#rolloverTimer);
        this.#reconnectTimer = this.#rolloverTimer = null;
        this.#waitingForNetwork = false;
        const conn = this.#conn;
        const retiring = this.#retiring;
        this.#conn = this.#retiring = null;
        conn?.close(1000, 'client disconnect');
        retiring?.close(1000, 'client disconnect');
    }

    #fail(error) {
        this.#halt();
        this.#logger.error('Notification client failed:', error.message);
        this.#setState(ConnectionState.FAILED, error);
        this.emit('error', error);
    }

    #setState(state, error) {
        if (state === this.#state) return;
        const previous = this.#state;
        this.#state = state;
        this.emit('stateChange', { state, previous, ...(error ? { error } : {}) });
    }

    #untilSettled() {
        return new Promise((resolve, reject) => {
            const off = this.on('stateChange', ({ state, error }) => {
                if (state === ConnectionState.CONNECTED) {
                    off();
                    resolve();
                } else if (state === ConnectionState.FAILED) {
                    off();
                    reject(error);
                } else if (state === ConnectionState.DISCONNECTED) {
                    off();
                    reject(new NotificationError('disconnect() was called before the connection was established', { code: 'ABORTED' }));
                }
            });
        });
    }

    #assertNotDisposed() {
        if (this.#disposed) throw new NotificationError('NotificationClient has been disposed', { code: 'DISPOSED' });
    }

    // ---------------------------------------------------------- dispatching

    #onMessage(message) {
        const { topicName } = message;

        if (topicName === SYSTEM_TOPICS.METADATA) {
            this.emit('heartbeat', message.eventBody);
            return;
        }
        if (topicName === SYSTEM_TOPICS.SOCKET_CLOSING) {
            this.#logger.warn('Server announced the socket will close (maintenance)');
            this.#rollover('server maintenance (v2.system.socket_closing)');
            return;
        }
        if (this.#isDuplicate(message)) return;

        const handled = this.#registry.dispatch(message, (error, topic) => {
            this.#logger.error(`Handler for ${topic} threw:`, error);
            this.emit('handlerError', { error, topic, message });
        });
        if (handled === 0) this.#logger.debug(`No handler registered for ${topicName}`);
        this.emit('notification', message);
    }

    /** Only active right after a channel swap, when both sockets may deliver the same event. */
    #isDuplicate(message) {
        if (this.#clock.now() > this.#overlapUntil) {
            if (this.#recentDuringOverlap.size) this.#recentDuringOverlap.clear();
            return false;
        }
        const key = JSON.stringify(message);
        if (this.#recentDuringOverlap.has(key)) return true;
        this.#recentDuringOverlap.add(key);
        return false;
    }

    // -------------------------------------------------------- subscriptions

    async #release(registration) {
        const topicNowEmpty = registration.remove();
        if (topicNowEmpty && this.#conn) {
            await this.#requestSync();
        }
    }

    /**
     * Coalesce sync requests: every call made before a sync starts shares that
     * sync; calls made while one is running get exactly one follow-up sync.
     * @returns {Promise<{ applied: string[], rejected: string[] }>}
     */
    #requestSync() {
        if (this.#pendingSync) return this.#pendingSync;
        const run = this.#syncTail.then(() => {
            this.#pendingSync = null;
            return this.#putSubscriptions();
        });
        this.#pendingSync = run;
        this.#syncTail = run.catch(() => {});
        return run;
    }

    async #putSubscriptions() {
        const channel = this.#channel;
        if (!channel) return { applied: [], rejected: [] };
        const path = `${CHANNELS_PATH}/${encodeURIComponent(channel.id)}/subscriptions`;
        const topics = this.#registry.topics();

        if (topics.length === 0) {
            if (channel.hasSubscriptions) await this.#api.delete(path);
            channel.hasSubscriptions = false;
            return { applied: [], rejected: [] };
        }

        const res = await this.#api.put(path, topics.map((id) => ({ id })));
        channel.hasSubscriptions = true;
        if (!Array.isArray(res?.entities)) return { applied: topics, rejected: [] };

        const accepted = new Set(res.entities.map((e) => String(e.id).toLowerCase()));
        const applied = topics.filter((t) => accepted.has(t.toLowerCase()));
        const rejected = topics.filter((t) => !accepted.has(t.toLowerCase()));
        if (rejected.length) {
            this.#logger.warn('Server did not accept topics:', rejected);
            this.emit('subscriptionRejected', { topics: rejected });
        }
        this.#logger.debug(`Subscriptions applied to channel ${channel.id}:`, applied);
        return { applied, rejected };
    }
}

/**
 * "v2.users.{id}.presence" → /^v2\.users\.[^.]+\.presence$/i
 * @param {string} template
 */
export function topicTemplateToRegExp(template) {
    const source = template
        .split(/(\{[^}]+\})/)
        .map((part) => (/^\{[^}]+\}$/.test(part) ? '[^.]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('');
    return new RegExp(`^${source}$`, 'i');
}

/** Browser online/offline detection; a no-op outside the browser. */
export function browserNetwork(target = globalThis) {
    return {
        isOnline: () => target.navigator?.onLine !== false,
        onOnline: (callback) => {
            if (typeof target.addEventListener !== 'function') return () => {};
            target.addEventListener('online', callback);
            return () => target.removeEventListener('online', callback);
        },
    };
}
