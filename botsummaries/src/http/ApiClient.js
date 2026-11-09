import { createBackoff } from '../core/backoff.js';
import { sleep, systemClock } from '../core/clock.js';
import { ApiError, AuthError } from '../core/errors.js';
import { silentLogger } from '../core/logger.js';

const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);
const RETRYABLE_STATUS = new Set([502, 503, 504]);

/**
 * @typedef {object} RequestOptions
 * @property {Record<string, string|number|boolean|undefined|null>} [query]
 * @property {any} [body]                    serialized as JSON
 * @property {Record<string, string>} [headers]
 * @property {AbortSignal} [signal]
 */

/**
 * Thin, dependency-free client for the Genesys Cloud Platform API.
 *
 * - Adds the bearer token to every request.
 * - Retries 429 (rate limited) for any method, honouring `Retry-After`.
 * - Retries 502/503/504 and network failures for idempotent methods only,
 *   so a POST is never sent twice.
 * - On 401, invalidates the token via `onUnauthorized` and throws AuthError.
 * - Throws ApiError carrying status, body and the `inin-correlation-id` header.
 *
 * Use it for any endpoint: `api.get('/api/v2/users/me')`.
 */
export class ApiClient {
    #baseUrl;
    #getAccessToken;
    #onUnauthorized;
    #fetch;
    #clock;
    #logger;
    #maxRetries;

    /**
     * @param {object} options
     * @param {string} options.baseUrl              e.g. "https://api.mypurecloud.ie"
     * @param {() => string|null} options.getAccessToken
     * @param {() => void} [options.onUnauthorized]
     * @param {typeof fetch} [options.fetch]
     * @param {import('../core/clock.js').Clock} [options.clock]
     * @param {import('../core/logger.js').Logger} [options.logger]
     * @param {number} [options.maxRetries=3]
     */
    constructor({
        baseUrl,
        getAccessToken,
        onUnauthorized = () => {},
        fetch: fetchFn = globalThis.fetch?.bind(globalThis),
        clock = systemClock,
        logger = silentLogger,
        maxRetries = 3,
    }) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
        this.#getAccessToken = getAccessToken;
        this.#onUnauthorized = onUnauthorized;
        this.#fetch = fetchFn;
        this.#clock = clock;
        this.#logger = logger;
        this.#maxRetries = maxRetries;
    }

    /** @param {string} path @param {RequestOptions} [opts] */
    get(path, opts) {
        return this.request('GET', path, opts);
    }

    /** @param {string} path @param {any} [body] @param {RequestOptions} [opts] */
    post(path, body, opts) {
        return this.request('POST', path, { ...opts, body });
    }

    /** @param {string} path @param {any} [body] @param {RequestOptions} [opts] */
    put(path, body, opts) {
        return this.request('PUT', path, { ...opts, body });
    }

    /** @param {string} path @param {any} [body] @param {RequestOptions} [opts] */
    patch(path, body, opts) {
        return this.request('PATCH', path, { ...opts, body });
    }

    /** @param {string} path @param {RequestOptions} [opts] */
    delete(path, opts) {
        return this.request('DELETE', path, opts);
    }

    /**
     * @param {string} method
     * @param {string} path  absolute path starting with "/api/v2/…"
     * @param {RequestOptions} [options]
     * @returns {Promise<any>} parsed JSON body, or null for empty responses
     */
    async request(method, path, { query, body, headers, signal } = {}) {
        method = method.toUpperCase();
        const url = this.#buildUrl(path, query);
        const backoff = createBackoff({ initialDelayMs: 500, maxDelayMs: 10_000 });

        for (let attempt = 0; ; attempt++) {
            const token = this.#getAccessToken();
            if (!token) throw new AuthError('Not authenticated: call login() first', { code: 'AUTH_REQUIRED' });

            let response;
            try {
                response = await this.#fetch(url, {
                    method,
                    signal,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                        ...headers,
                    },
                    body: body !== undefined ? JSON.stringify(body) : undefined,
                });
            } catch (err) {
                if (err?.name === 'AbortError') throw err;
                if (IDEMPOTENT.has(method) && attempt < this.#maxRetries) {
                    const delay = backoff.next();
                    this.#logger.warn(`${method} ${path} network error, retrying in ${delay}ms`, err);
                    await sleep(this.#clock, delay);
                    continue;
                }
                throw new ApiError(`${method} ${path} failed: network error`, { status: 0, method, path, body: String(err) });
            }

            if (response.ok) return parseBody(response);

            if (response.status === 401) {
                this.#onUnauthorized();
                throw new AuthError(`${method} ${path} returned 401: token invalid or expired`, { code: 'AUTH_EXPIRED' });
            }

            const retryable = response.status === 429 || (RETRYABLE_STATUS.has(response.status) && IDEMPOTENT.has(method));
            if (retryable && attempt < this.#maxRetries) {
                const delay = retryAfterMs(response) ?? backoff.next();
                this.#logger.warn(`${method} ${path} returned ${response.status}, retrying in ${delay}ms`);
                await sleep(this.#clock, delay);
                continue;
            }

            const errorBody = await parseBody(response).catch(() => null);
            throw new ApiError(
                `${method} ${path} failed with HTTP ${response.status}${errorBody?.message ? `: ${errorBody.message}` : ''}`,
                { status: response.status, method, path, body: errorBody, correlationId: response.headers.get('inin-correlation-id') },
            );
        }
    }

    #buildUrl(path, query) {
        const url = new URL(path.startsWith('/') ? path : `/${path}`, this.#baseUrl);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
        }
        return url.toString();
    }
}

async function parseBody(response) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function retryAfterMs(response) {
    const header = response.headers.get('retry-after');
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
