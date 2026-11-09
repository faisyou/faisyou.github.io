/**
 * Exponential backoff with "equal jitter".
 *
 * delay(n) = random value in [exp/2, exp], where exp = min(max, initial * multiplier^n)
 *
 * Jitter spreads reconnect storms (e.g. many agent desktops reconnecting after
 * the same network blip) while the lower bound guarantees we never hammer the API.
 *
 * @param {object} [options]
 * @param {number} [options.initialDelayMs=1000]
 * @param {number} [options.maxDelayMs=30000]
 * @param {number} [options.multiplier=2]
 * @param {boolean} [options.jitter=true]
 * @param {() => number} [options.random=Math.random]
 */
export function createBackoff({
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    multiplier = 2,
    jitter = true,
    random = Math.random,
} = {}) {
    let attempt = 0;

    return {
        /** Number of delays handed out since the last reset. */
        get attempt() {
            return attempt;
        },

        /** @returns {number} the delay in ms to wait before the next attempt */
        next() {
            const exp = Math.min(maxDelayMs, initialDelayMs * multiplier ** attempt);
            attempt++;
            if (!jitter) return exp;
            return Math.round(exp / 2 + random() * (exp / 2));
        },

        reset() {
            attempt = 0;
        },
    };
}
