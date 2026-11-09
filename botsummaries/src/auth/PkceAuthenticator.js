import { EventEmitter } from '../core/EventEmitter.js';
import { AuthError } from '../core/errors.js';
import { systemClock } from '../core/clock.js';
import { silentLogger } from '../core/logger.js';
import { createCodeChallenge, generateRandomString } from './pkce.js';
import { createStore } from './storage.js';

/** Pending logins older than this are discarded as abandoned. */
const PENDING_TTL_MS = 15 * 60_000;
const CALLBACK_PARAMS = ['code', 'state', 'error', 'error_description'];

/**
 * @typedef {object} LoginResult
 * @property {string} accessToken
 * @property {any} appState   the value passed to `login({ appState })` before the redirect, restored afterwards
 * @property {boolean} fromRedirect  true when this call completed an OAuth redirect
 */

/**
 * Browser OAuth 2.0 Authorization Code grant with PKCE against Genesys Cloud.
 *
 * Flow:
 *   1. `login()` with no valid token → stores a one-time verifier + state, then redirects to
 *      `https://login.<region>/oauth/authorize`.
 *   2. Genesys Cloud redirects back with `?code=…&state=…`.
 *   3. `login()` on the returned page validates `state` (CSRF protection), exchanges the code
 *      for a token, strips the OAuth params from the address bar, and restores `appState`.
 *
 * `appState` exists because interaction widgets receive context (conversationId, language…)
 * through their URL, and that URL is lost during the OAuth round trip.
 *
 * Events:
 *   - `authenticated` { expiresAt }
 *   - `tokenExpired`  {}  token reached its expiry; call `login()` again
 *   - `loggedOut`     {}
 */
export class PkceAuthenticator extends EventEmitter {
    #clientId;
    #redirectUri;
    #loginBaseUrl;
    #storageKey;
    #store;
    #fetch;
    #location;
    #history;
    #crypto;
    #clock;
    #logger;
    #expirySkewMs;
    #expiryTimer = null;

    /**
     * @param {object} options
     * @param {string} options.clientId
     * @param {string} options.redirectUri
     * @param {string} options.loginBaseUrl  e.g. "https://login.mypurecloud.ie"
     * @param {string} [options.storageKey]
     * @param {import('./storage.js').KeyValueStore} [options.store]
     * @param {typeof fetch} [options.fetch]
     * @param {Location|{href: string, assign(url: string): void}} [options.location]
     * @param {Pick<History, 'replaceState'|'state'>} [options.history]
     * @param {Crypto} [options.crypto]
     * @param {import('../core/clock.js').Clock} [options.clock]
     * @param {import('../core/logger.js').Logger} [options.logger]
     * @param {number} [options.expirySkewMs=60000] treat tokens as expired this long before they actually are
     */
    constructor({
        clientId,
        redirectUri,
        loginBaseUrl,
        storageKey = 'gc-notifications',
        store = createStore(),
        fetch: fetchFn = globalThis.fetch?.bind(globalThis),
        location = globalThis.location,
        history = globalThis.history,
        crypto: cryptoImpl = globalThis.crypto,
        clock = systemClock,
        logger = silentLogger,
        expirySkewMs = 60_000,
    }) {
        super();
        this.#clientId = clientId;
        this.#redirectUri = redirectUri;
        this.#loginBaseUrl = loginBaseUrl;
        this.#storageKey = storageKey;
        this.#store = store;
        this.#fetch = fetchFn;
        this.#location = location;
        this.#history = history;
        this.#crypto = cryptoImpl;
        this.#clock = clock;
        this.#logger = logger;
        this.#expirySkewMs = expirySkewMs;
    }

    /**
     * Ensure the user is authenticated. Resolves immediately with a cached
     * token, completes a redirect that just came back from Genesys Cloud, or
     * starts a new login redirect (in which case the promise never resolves,
     * because the page navigates away).
     *
     * @param {object} [options]
     * @param {any} [options.appState] JSON-serializable state to carry across the redirect
     * @returns {Promise<LoginResult>}
     * @throws {AuthError} if Genesys Cloud returned an error or the code exchange failed
     */
    async login({ appState } = {}) {
        const callback = this.#readCallbackParams();
        if (callback) {
            const result = await this.#completeRedirect(callback);
            if (result) return result;
        }

        const token = this.#readToken();
        if (token) {
            this.#scheduleExpiry(token.expiresAt);
            return { accessToken: token.accessToken, appState, fromRedirect: false };
        }

        await this.#redirectToLogin(appState);
        return new Promise(() => {});
    }

    /** @returns {string|null} a valid access token, or null if missing/expired */
    getAccessToken() {
        return this.#readToken()?.accessToken ?? null;
    }

    /** @returns {number|null} epoch ms at which the current token expires */
    getExpiresAt() {
        return this.#readToken()?.expiresAt ?? null;
    }

    get isAuthenticated() {
        return this.getAccessToken() !== null;
    }

    /**
     * Drop the cached token, e.g. after the API answered 401.
     * Emits `tokenExpired` so the app can decide when to re-login.
     */
    invalidate() {
        const hadToken = this.#store.get(this.#tokenKey) !== null;
        this.#clearToken();
        if (hadToken) this.emit('tokenExpired', {});
    }

    /** Forget the token locally. (It stays valid at Genesys Cloud until it expires.) */
    logout() {
        this.#clearToken();
        this.emit('loggedOut', {});
    }

    dispose() {
        this.#clock.clearTimeout(this.#expiryTimer);
        this.removeAllListeners();
    }

    // ---------------------------------------------------------------- internals

    get #tokenKey() {
        return `${this.#storageKey}:token:${this.#clientId}`;
    }

    #pendingKey(state) {
        return `${this.#storageKey}:pkce:${state}`;
    }

    #readToken() {
        const token = this.#store.get(this.#tokenKey);
        if (!token?.accessToken || typeof token.expiresAt !== 'number') return null;
        if (token.expiresAt - this.#expirySkewMs <= this.#clock.now()) {
            this.#store.remove(this.#tokenKey);
            return null;
        }
        return token;
    }

    #clearToken() {
        this.#clock.clearTimeout(this.#expiryTimer);
        this.#expiryTimer = null;
        this.#store.remove(this.#tokenKey);
    }

    #scheduleExpiry(expiresAt) {
        this.#clock.clearTimeout(this.#expiryTimer);
        // setTimeout overflows above 2^31-1 ms (~24.8 days).
        const delay = Math.min(2 ** 31 - 1, Math.max(0, expiresAt - this.#expirySkewMs - this.#clock.now()));
        this.#expiryTimer = this.#clock.setTimeout(() => {
            this.#logger.warn('Access token expired');
            this.invalidate();
        }, delay);
    }

    #readCallbackParams() {
        const href = this.#location?.href;
        if (!href) return null;
        const params = new URL(href).searchParams;
        if (params.has('error')) {
            return { error: params.get('error'), errorDescription: params.get('error_description'), state: params.get('state') };
        }
        if (params.has('code') && params.has('state')) {
            return { code: params.get('code'), state: params.get('state') };
        }
        return null;
    }

    /** @returns {Promise<LoginResult|null>} null when the callback isn't ours (e.g. stale reload) */
    async #completeRedirect({ code, state, error, errorDescription }) {
        const pendingKey = this.#pendingKey(state);
        const pending = this.#store.get(pendingKey);
        this.#store.remove(pendingKey);
        this.#stripCallbackParams();

        if (error) {
            throw new AuthError(`Genesys Cloud login failed: ${error}${errorDescription ? ` (${errorDescription})` : ''}`, {
                code: `AUTH_${String(error).toUpperCase()}`,
            });
        }

        if (!pending) {
            // Unknown state: a reloaded callback URL or a forged redirect. Never exchange the code.
            this.#logger.warn('Ignoring OAuth callback with unknown state; starting fresh');
            return null;
        }
        if (this.#clock.now() - pending.createdAt > PENDING_TTL_MS) {
            this.#logger.warn('Ignoring OAuth callback for an abandoned login attempt');
            return null;
        }

        const token = await this.#exchangeCode(code, pending.verifier);
        this.#store.set(this.#tokenKey, token);
        this.#scheduleExpiry(token.expiresAt);
        this.#logger.info('Authenticated; token expires at', new Date(token.expiresAt).toISOString());
        this.emit('authenticated', { expiresAt: token.expiresAt });
        return { accessToken: token.accessToken, appState: pending.appState, fromRedirect: true };
    }

    async #exchangeCode(code, verifier) {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.#redirectUri,
            client_id: this.#clientId,
            code_verifier: verifier,
        });

        let response;
        try {
            response = await this.#fetch(`${this.#loginBaseUrl}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
        } catch (cause) {
            throw new AuthError('Network error while exchanging the authorization code', { cause });
        }

        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.access_token) {
            throw new AuthError(
                `Token exchange failed (HTTP ${response.status}): ${json.error_description ?? json.error ?? 'no access_token returned'}`,
                { code: 'AUTH_TOKEN_EXCHANGE_FAILED' },
            );
        }

        return {
            accessToken: json.access_token,
            expiresAt: this.#clock.now() + Number(json.expires_in ?? 0) * 1000,
        };
    }

    async #redirectToLogin(appState) {
        const verifier = generateRandomString(48, this.#crypto);
        const state = generateRandomString(16, this.#crypto);
        const challenge = await createCodeChallenge(verifier, this.#crypto);

        // Keyed by state, so two widgets logging in at once in the same tab don't collide.
        this.#store.set(this.#pendingKey(state), { verifier, appState: appState ?? null, createdAt: this.#clock.now() });

        const url = new URL(`${this.#loginBaseUrl}/oauth/authorize`);
        url.search = new URLSearchParams({
            response_type: 'code',
            client_id: this.#clientId,
            redirect_uri: this.#redirectUri,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state,
        }).toString();

        this.#logger.info('Redirecting to Genesys Cloud login');
        this.#location.assign(url.toString());
    }

    #stripCallbackParams() {
        if (!this.#history?.replaceState || !this.#location?.href) return;
        const url = new URL(this.#location.href);
        for (const p of CALLBACK_PARAMS) url.searchParams.delete(p);
        this.#history.replaceState(this.#history.state ?? null, '', url.toString());
    }
}

