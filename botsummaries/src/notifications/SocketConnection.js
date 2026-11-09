import { EventEmitter } from '../core/EventEmitter.js';
import { systemClock } from '../core/clock.js';
import { NotificationError } from '../core/errors.js';
import { silentLogger } from '../core/logger.js';

const PING = JSON.stringify({ message: 'ping' });

/**
 * One WebSocket to one notification channel, with a liveness watchdog.
 *
 * Browsers often don't notice a dead TCP connection (sleeping laptop, Wi-Fi
 * switch, proxy timeout) for minutes. To detect it, whenever the socket has been
 * silent for `pingIntervalMs` we send `{"message":"ping"}`. If nothing at all
 * arrives within `pongTimeoutMs`, the socket is declared stale and closed.
 *
 * This class never reconnects; that policy lives in NotificationClient.
 *
 * Events:
 *   - `message` NotificationMessage  every parsed frame, including channel.metadata
 *   - `close`   { code, reason, wasClean, cause }  fired exactly once; cause is 'remote' | 'stale' | 'error' | 'local'
 */
export class SocketConnection extends EventEmitter {
    #url;
    #WebSocket;
    #clock;
    #logger;
    #pingIntervalMs;
    #pongTimeoutMs;
    #connectTimeoutMs;
    /** @type {WebSocket|null} */
    #ws = null;
    #idleTimer = null;
    #pongTimer = null;
    #closed = false;
    #opened = false;

    /**
     * @param {object} options
     * @param {string} options.url
     * @param {typeof WebSocket} [options.WebSocket]
     * @param {import('../core/clock.js').Clock} [options.clock]
     * @param {import('../core/logger.js').Logger} [options.logger]
     * @param {number} [options.pingIntervalMs=30000]
     * @param {number} [options.pongTimeoutMs=10000]
     * @param {number} [options.connectTimeoutMs=15000]
     */
    constructor({
        url,
        WebSocket: WebSocketImpl = globalThis.WebSocket,
        clock = systemClock,
        logger = silentLogger,
        pingIntervalMs = 30_000,
        pongTimeoutMs = 10_000,
        connectTimeoutMs = 15_000,
    }) {
        super();
        this.#url = url;
        this.#WebSocket = WebSocketImpl;
        this.#clock = clock;
        this.#logger = logger;
        this.#pingIntervalMs = pingIntervalMs;
        this.#pongTimeoutMs = pongTimeoutMs;
        this.#connectTimeoutMs = connectTimeoutMs;
    }

    get isOpen() {
        return this.#opened && !this.#closed;
    }

    /**
     * Open the socket.
     * @returns {Promise<void>} resolves once open; rejects on error or timeout
     */
    open() {
        if (this.#ws) return Promise.reject(new NotificationError('SocketConnection.open() called twice'));

        return new Promise((resolve, reject) => {
            let settled = false;
            const fail = (message, cause) => {
                if (settled) return;
                settled = true;
                this.#teardown();
                reject(new NotificationError(message, { code: 'SOCKET_OPEN_FAILED', cause }));
            };

            const timeout = this.#clock.setTimeout(
                () => fail(`WebSocket did not open within ${this.#connectTimeoutMs}ms`),
                this.#connectTimeoutMs,
            );

            let ws;
            try {
                ws = new this.#WebSocket(this.#url);
            } catch (err) {
                this.#clock.clearTimeout(timeout);
                fail('Could not create WebSocket', err);
                return;
            }
            this.#ws = ws;

            ws.onopen = () => {
                this.#clock.clearTimeout(timeout);
                if (settled) return;
                settled = true;
                this.#opened = true;
                this.#armIdleTimer();
                resolve();
            };
            ws.onmessage = (event) => this.#onMessage(event);
            ws.onerror = (event) => {
                // Browsers always follow 'error' with 'close'; the close handler does the cleanup.
                this.#logger.debug('WebSocket error event', event?.message ?? '');
                if (!this.#opened) {
                    this.#clock.clearTimeout(timeout);
                    fail('WebSocket failed to open', event);
                }
            };
            ws.onclose = (event) => {
                this.#clock.clearTimeout(timeout);
                if (!this.#opened) {
                    fail(`WebSocket closed before opening (code ${event?.code})`);
                    return;
                }
                this.#finish({ code: event?.code ?? 1006, reason: event?.reason ?? '', wasClean: !!event?.wasClean, cause: 'remote' });
            };
        });
    }

    /**
     * @param {any} data  JSON-serializable payload
     * @returns {boolean} false if the socket isn't open
     */
    send(data) {
        if (!this.isOpen || this.#ws.readyState !== 1) return false;
        this.#ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
    }

    /**
     * Check liveness now instead of waiting for the idle timer, e.g. when the
     * browser reports it came back online or the laptop woke from sleep.
     */
    probe() {
        if (!this.isOpen || this.#pongTimer) return;
        this.#clock.clearTimeout(this.#idleTimer);
        this.#sendPing();
    }

    /**
     * Close the socket deliberately. The `close` event fires with cause 'local'.
     * @param {number} [code=1000]
     * @param {string} [reason]
     */
    close(code = 1000, reason = 'client closing') {
        this.#finish({ code, reason, wasClean: true, cause: 'local' });
    }

    #onMessage(event) {
        if (this.#closed) return;
        this.#armIdleTimer();

        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            this.#logger.warn('Discarding non-JSON frame', String(event.data).slice(0, 200));
            return;
        }
        if (!message || typeof message.topicName !== 'string') {
            this.#logger.warn('Discarding frame without topicName');
            return;
        }
        this.emit('message', message);
    }

    /** Any inbound traffic proves liveness; restart the idle countdown. */
    #armIdleTimer() {
        this.#clock.clearTimeout(this.#pongTimer);
        this.#pongTimer = null;
        this.#clock.clearTimeout(this.#idleTimer);
        this.#idleTimer = this.#clock.setTimeout(() => this.#sendPing(), this.#pingIntervalMs);
    }

    #sendPing() {
        if (!this.send(PING)) return;
        this.#logger.debug('Socket idle; ping sent');
        this.#pongTimer = this.#clock.setTimeout(() => {
            this.#logger.warn(`No response to ping within ${this.#pongTimeoutMs}ms; treating socket as dead`);
            this.#finish({ code: 4000, reason: 'heartbeat timeout', wasClean: false, cause: 'stale' });
        }, this.#pongTimeoutMs);
    }

    #finish(info) {
        if (this.#closed) return;
        this.#closed = true;
        this.#teardown(info.code, info.reason);
        this.emit('close', info);
        this.removeAllListeners();
    }

    #teardown(code = 1000, reason = '') {
        this.#clock.clearTimeout(this.#idleTimer);
        this.#clock.clearTimeout(this.#pongTimer);
        this.#idleTimer = this.#pongTimer = null;
        const ws = this.#ws;
        if (!ws) return;
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        try {
            // 1000 and 3000-4999 are the only codes a client may send.
            const safeCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
            if (ws.readyState === 0 || ws.readyState === 1) ws.close(safeCode, reason.slice(0, 120));
        } catch {
            // already closing
        }
    }
}
