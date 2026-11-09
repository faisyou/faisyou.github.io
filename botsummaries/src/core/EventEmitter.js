/**
 * Minimal, dependency-free event emitter used by every stateful component.
 *
 * Listener errors are isolated: a throwing listener never prevents other
 * listeners from running, and never corrupts the emitter's internal state.
 * The error is re-thrown asynchronously so it still surfaces in the console.
 */
export class EventEmitter {
    /** @type {Map<string, Set<Function>>} */
    #listeners = new Map();

    /**
     * Register a listener.
     * @param {string} event
     * @param {(payload: any) => void} listener
     * @returns {() => void} function that removes the listener
     */
    on(event, listener) {
        if (typeof listener !== 'function') {
            throw new TypeError(`Listener for "${event}" must be a function`);
        }
        if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
        this.#listeners.get(event).add(listener);
        return () => this.off(event, listener);
    }

    /**
     * Register a listener that fires at most once.
     * @param {string} event
     * @param {(payload: any) => void} listener
     * @returns {() => void}
     */
    once(event, listener) {
        const off = this.on(event, (payload) => {
            off();
            listener(payload);
        });
        return off;
    }

    /**
     * @param {string} event
     * @param {Function} listener
     */
    off(event, listener) {
        const set = this.#listeners.get(event);
        if (!set) return;
        set.delete(listener);
        if (set.size === 0) this.#listeners.delete(event);
    }

    /**
     * @param {string} event
     * @param {any} [payload]
     */
    emit(event, payload) {
        const set = this.#listeners.get(event);
        if (!set) return;
        // Copy so listeners may unsubscribe while we iterate.
        for (const listener of [...set]) {
            try {
                listener(payload);
            } catch (err) {
                queueMicrotask(() => { throw err; });
            }
        }
    }

    /** @param {string} event */
    listenerCount(event) {
        return this.#listeners.get(event)?.size ?? 0;
    }

    removeAllListeners() {
        this.#listeners.clear();
    }
}
