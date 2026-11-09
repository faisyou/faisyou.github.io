/**
 * @typedef {object} Clock
 * @property {() => number} now
 * @property {(fn: () => void, ms: number) => any} setTimeout
 * @property {(id: any) => void} clearTimeout
 */

/**
 * Indirection over time so components can be tested deterministically
 * (inject a fake clock instead of waiting on real timers).
 * @type {Clock}
 */
export const systemClock = Object.freeze({
    now: () => Date.now(),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id),
});

/**
 * Promise-based sleep on top of a Clock.
 * @param {Clock} clock
 * @param {number} ms
 */
export function sleep(clock, ms) {
    return new Promise((resolve) => clock.setTimeout(resolve, ms));
}
