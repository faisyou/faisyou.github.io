import { ConfigError } from './core/errors.js';
import { LOG_LEVELS } from './core/logger.js';

/**
 * Known Genesys Cloud regions (the domain part of `api.<domain>`).
 * Unknown domains are still accepted (new regions appear over time), but
 * they produce a warning in `validateConfig().warnings`.
 */
export const KNOWN_REGIONS = Object.freeze({
    'mypurecloud.com': 'Americas (US East)',
    'use2.us-gov-pure.cloud': 'Americas (US East 2, FedRAMP)',
    'usw2.pure.cloud': 'Americas (US West)',
    'cac1.pure.cloud': 'Americas (Canada)',
    'sae1.pure.cloud': 'Americas (São Paulo)',
    'mypurecloud.ie': 'EMEA (Dublin)',
    'euw2.pure.cloud': 'EMEA (London)',
    'mypurecloud.de': 'EMEA (Frankfurt)',
    'euc2.pure.cloud': 'EMEA (Zurich)',
    'mec1.pure.cloud': 'EMEA (UAE)',
    'aps1.pure.cloud': 'Asia Pacific (Mumbai)',
    'apne2.pure.cloud': 'Asia Pacific (Seoul)',
    'apne3.pure.cloud': 'Asia Pacific (Osaka)',
    'mypurecloud.jp': 'Asia Pacific (Tokyo)',
    'mypurecloud.com.au': 'Asia Pacific (Sydney)',
});

/** Defaults applied to every config. Exported so consumers can inspect them. */
export const DEFAULTS = Object.freeze({
    logLevel: 'info',
    storageKey: 'gc-notifications',
    notifications: Object.freeze({
        /** Send a ping when the socket has been silent this long. */
        pingIntervalMs: 30_000,
        /** Treat the socket as dead if nothing arrives this long after a ping. */
        pongTimeoutMs: 10_000,
        /** Give up on a single WebSocket open attempt after this long. */
        connectTimeoutMs: 15_000,
        /** Roll over to a fresh channel this long before the current one expires. */
        channelRolloverMarginMs: 5 * 60_000,
        reconnect: Object.freeze({
            initialDelayMs: 1_000,
            maxDelayMs: 30_000,
            /** null = retry forever (recommended for long-lived agent desktops). */
            maxAttempts: null,
        }),
    }),
});

/**
 * @typedef {object} GenesysConfig
 * @property {string} clientId          OAuth client ID (grant type: "Code Authorization" with PKCE)
 * @property {string} region            e.g. "mypurecloud.ie"; "https://api.mypurecloud.ie" is accepted too
 * @property {string} [redirectUri]     must exactly match one registered on the OAuth client; defaults to the current page (origin + path)
 * @property {keyof typeof LOG_LEVELS} [logLevel]
 * @property {string} [storageKey]      prefix for sessionStorage keys; change it if two apps share an origin
 * @property {Partial<typeof DEFAULTS.notifications>} [notifications]
 */

/**
 * @typedef {object} ResolvedConfig
 * @property {string} clientId
 * @property {string} region
 * @property {string} redirectUri
 * @property {string} loginBaseUrl      e.g. "https://login.mypurecloud.ie"
 * @property {string} apiBaseUrl        e.g. "https://api.mypurecloud.ie"
 * @property {keyof typeof LOG_LEVELS} logLevel
 * @property {string} storageKey
 * @property {typeof DEFAULTS.notifications} notifications
 * @property {string[]} warnings        non-fatal issues found during validation
 */

/**
 * Normalize the many ways a region gets written down:
 * "mypurecloud.ie", "api.mypurecloud.ie", "https://login.mypurecloud.ie/" → "mypurecloud.ie"
 * @param {string} region
 */
export function normalizeRegion(region) {
    return String(region)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^(api|login|apps)\./, '');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPositiveInt(value) {
    return Number.isInteger(value) && value > 0;
}

/**
 * Validate and normalize a config object. Reports *all* problems at once
 * (rather than failing on the first) so a misconfigured deployment can be
 * fixed in a single pass.
 *
 * @param {GenesysConfig} raw
 * @param {object} [env]
 * @param {Pick<Location, 'origin'|'pathname'>} [env.location=globalThis.location]
 * @returns {Readonly<ResolvedConfig>}
 * @throws {ConfigError}
 */
export function validateConfig(raw, { location = globalThis.location } = {}) {
    const problems = [];
    const warnings = [];

    if (!raw || typeof raw !== 'object') {
        throw new ConfigError(['config must be an object']);
    }

    if (typeof raw.clientId !== 'string' || !raw.clientId.trim()) {
        problems.push('clientId is required (the OAuth client ID from Admin > Integrations > OAuth)');
    } else if (!UUID_RE.test(raw.clientId.trim())) {
        warnings.push(`clientId "${raw.clientId}" does not look like a UUID`);
    }

    let region = '';
    if (typeof raw.region !== 'string' || !raw.region.trim()) {
        problems.push(`region is required, e.g. "mypurecloud.ie". Known regions: ${Object.keys(KNOWN_REGIONS).join(', ')}`);
    } else {
        region = normalizeRegion(raw.region);
        if (!KNOWN_REGIONS[region]) warnings.push(`region "${region}" is not in the list of known regions; continuing anyway`);
    }

    let redirectUri = raw.redirectUri;
    if (redirectUri === undefined || redirectUri === null || redirectUri === '') {
        if (location?.origin) {
            redirectUri = `${location.origin}${location.pathname}`;
        } else {
            problems.push('redirectUri is required when not running in a browser page');
        }
    } else {
        try {
            const url = new URL(redirectUri);
            if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                warnings.push('redirectUri is not https; Genesys Cloud only allows http for localhost');
            }
        } catch {
            problems.push(`redirectUri "${redirectUri}" is not a valid absolute URL`);
        }
    }

    const logLevel = raw.logLevel ?? DEFAULTS.logLevel;
    if (!(logLevel in LOG_LEVELS)) {
        problems.push(`logLevel must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`);
    }

    const n = raw.notifications ?? {};
    const notifications = {
        ...DEFAULTS.notifications,
        ...n,
        reconnect: { ...DEFAULTS.notifications.reconnect, ...(n.reconnect ?? {}) },
    };
    for (const key of ['pingIntervalMs', 'pongTimeoutMs', 'connectTimeoutMs', 'channelRolloverMarginMs']) {
        if (!isPositiveInt(notifications[key])) problems.push(`notifications.${key} must be a positive integer (ms)`);
    }
    for (const key of ['initialDelayMs', 'maxDelayMs']) {
        if (!isPositiveInt(notifications.reconnect[key])) problems.push(`notifications.reconnect.${key} must be a positive integer (ms)`);
    }
    const { maxAttempts } = notifications.reconnect;
    if (maxAttempts !== null && !isPositiveInt(maxAttempts)) {
        problems.push('notifications.reconnect.maxAttempts must be a positive integer, or null for unlimited');
    }

    if (problems.length) throw new ConfigError(problems);

    return deepFreeze({
        clientId: raw.clientId.trim(),
        region,
        redirectUri,
        loginBaseUrl: `https://login.${region}`,
        apiBaseUrl: `https://api.${region}`,
        logLevel,
        storageKey: raw.storageKey ?? DEFAULTS.storageKey,
        notifications,
        warnings,
    });
}

/**
 * Fetch a JSON config file (e.g. `./genesys.config.json`) and validate it.
 * Keeping configuration in a separate file lets ops change client IDs or
 * regions per environment without touching code.
 *
 * @param {string|URL} url
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Partial<GenesysConfig>} [options.overrides] merged over the file contents
 * @returns {Promise<Readonly<ResolvedConfig>>}
 */
export async function loadConfig(url, { fetch: fetchFn = globalThis.fetch, overrides = {} } = {}) {
    let response;
    try {
        response = await fetchFn(url, { cache: 'no-store' });
    } catch (cause) {
        throw new ConfigError([`could not fetch config file ${url}: ${cause?.message ?? cause}`]);
    }
    if (!response.ok) throw new ConfigError([`config file ${url} returned HTTP ${response.status}`]);

    let json;
    try {
        json = await response.json();
    } catch {
        throw new ConfigError([`config file ${url} is not valid JSON`]);
    }
    return validateConfig({ ...json, ...overrides });
}

function deepFreeze(obj) {
    for (const value of Object.values(obj)) {
        if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
    }
    return Object.freeze(obj);
}
