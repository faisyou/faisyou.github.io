/**
 * All errors thrown by the library extend GenesysError, so consumers can
 * branch on `err instanceof GenesysError` or on the stable `err.code` string.
 */
export class GenesysError extends Error {
    /**
     * @param {string} message
     * @param {object} [options]
     * @param {string} [options.code]
     * @param {unknown} [options.cause]
     */
    constructor(message, { code = 'GENESYS_ERROR', cause } = {}) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = new.target.name;
        this.code = code;
    }
}

/** Invalid or missing configuration. `problems` lists every issue found. */
export class ConfigError extends GenesysError {
    /** @param {string[]} problems */
    constructor(problems) {
        super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`, { code: 'CONFIG_INVALID' });
        this.problems = problems;
    }
}

/** Authentication failed, was rejected, or the token expired. */
export class AuthError extends GenesysError {
    constructor(message, { code = 'AUTH_FAILED', cause } = {}) {
        super(message, { code, cause });
    }
}

/** A Genesys Cloud REST call returned a non-success status. */
export class ApiError extends GenesysError {
    /**
     * @param {string} message
     * @param {object} details
     * @param {number} details.status
     * @param {string} details.method
     * @param {string} details.path
     * @param {any} [details.body] parsed error body returned by Genesys Cloud
     * @param {string|null} [details.correlationId] value of the `inin-correlation-id` header; quote it to Genesys support
     */
    constructor(message, { status, method, path, body, correlationId = null }) {
        super(message, { code: `HTTP_${status}` });
        this.status = status;
        this.method = method;
        this.path = path;
        this.body = body;
        this.correlationId = correlationId;
    }
}

/** Problems with the notification channel or WebSocket. */
export class NotificationError extends GenesysError {
    constructor(message, { code = 'NOTIFICATION_ERROR', cause } = {}) {
        super(message, { code, cause });
    }
}
