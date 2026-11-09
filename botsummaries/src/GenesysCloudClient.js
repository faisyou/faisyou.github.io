import { PkceAuthenticator } from './auth/PkceAuthenticator.js';
import { createStore } from './auth/storage.js';
import { systemClock } from './core/clock.js';
import { createLogger } from './core/logger.js';
import { validateConfig } from './config.js';
import { ApiClient } from './http/ApiClient.js';
import { NotificationClient } from './notifications/NotificationClient.js';

/**
 * @typedef {object} ClientDependencies  overrides for tests or non-standard environments
 * @property {typeof fetch} [fetch]
 * @property {typeof WebSocket} [WebSocket]
 * @property {import('./core/clock.js').Clock} [clock]
 * @property {import('./auth/storage.js').KeyValueStore} [store]
 * @property {Location} [location]
 * @property {History} [history]
 * @property {Crypto} [crypto]
 * @property {Pick<Console, 'debug'|'info'|'warn'|'error'>} [logSink]
 * @property {{ isOnline(): boolean, onOnline(cb: () => void): () => void }} [network]
 */

/**
 * One object that wires authentication, REST access and notifications
 * together from a single config. This is the recommended entry point.
 *
 * @example
 * const gc = createGenesysCloudClient(await loadConfig('./genesys.config.json'));
 * const { appState } = await gc.login({ appState: { conversationId } });
 * await gc.notifications.subscribe(Topics.userPresence(me.id), (body) => render(body));
 * await gc.notifications.connect();
 */
export class GenesysCloudClient {
    /** @type {Readonly<import('./config.js').ResolvedConfig>} */
    config;
    /** @type {PkceAuthenticator} */
    auth;
    /** @type {ApiClient} */
    api;
    /** @type {NotificationClient} */
    notifications;
    /** @type {import('./core/logger.js').Logger} */
    logger;

    /**
     * @param {import('./config.js').GenesysConfig|import('./config.js').ResolvedConfig} config  raw or already validated
     * @param {ClientDependencies} [deps]
     */
    constructor(config, deps = {}) {
        this.config = 'apiBaseUrl' in config ? config : validateConfig(config, { location: deps.location });
        const { config: cfg } = this;
        const clock = deps.clock ?? systemClock;

        this.logger = createLogger({ level: cfg.logLevel, prefix: 'gc', sink: deps.logSink });
        for (const warning of cfg.warnings) this.logger.warn(`Config: ${warning}`);

        this.auth = new PkceAuthenticator({
            clientId: cfg.clientId,
            redirectUri: cfg.redirectUri,
            loginBaseUrl: cfg.loginBaseUrl,
            storageKey: cfg.storageKey,
            store: deps.store ?? createStore(),
            fetch: deps.fetch,
            location: deps.location,
            history: deps.history,
            crypto: deps.crypto,
            clock,
            logger: this.logger.child('auth'),
        });

        this.api = new ApiClient({
            baseUrl: cfg.apiBaseUrl,
            getAccessToken: () => this.auth.getAccessToken(),
            onUnauthorized: () => this.auth.invalidate(),
            fetch: deps.fetch,
            clock,
            logger: this.logger.child('api'),
        });

        this.notifications = new NotificationClient({
            api: this.api,
            options: cfg.notifications,
            WebSocket: deps.WebSocket,
            clock,
            logger: this.logger.child('notifications'),
            ...(deps.network ? { network: deps.network } : {}),
        });

        // A dead token makes every reconnect fail; stop the socket cleanly instead of spinning.
        this.auth.on('tokenExpired', () => {
            if (this.notifications.state !== 'idle') this.notifications.disconnect();
        });
    }

    /**
     * Shorthand for `auth.login()`. See PkceAuthenticator#login.
     * @param {{ appState?: any }} [options]
     */
    login(options) {
        return this.auth.login(options);
    }

    /** Release sockets, timers and listeners. */
    dispose() {
        this.notifications.dispose();
        this.auth.dispose();
    }
}

/**
 * Factory for {@link GenesysCloudClient}.
 * @param {import('./config.js').GenesysConfig|import('./config.js').ResolvedConfig} config
 * @param {ClientDependencies} [deps]
 */
export function createGenesysCloudClient(config, deps) {
    return new GenesysCloudClient(config, deps);
}
