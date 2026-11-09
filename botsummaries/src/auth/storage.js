/**
 * @typedef {object} KeyValueStore
 * @property {(key: string) => any} get      returns the parsed value, or null
 * @property {(key: string, value: any) => void} set
 * @property {(key: string) => void} remove
 */

/**
 * JSON key/value store over a Web Storage object, falling back to memory
 * when storage is unavailable (Safari private mode, sandboxed iframes with
 * blocked third-party storage, Node tests, ...).
 *
 * sessionStorage is the default on purpose: the token lives only as long as
 * the browser tab and isn't shared with other tabs, which limits exposure.
 * Same-origin iframes in one tab (e.g. several interaction widgets) do share
 * it, so the agent logs in once per tab, not once per widget.
 *
 * @param {Storage|null|undefined} [backing]
 * @returns {KeyValueStore}
 */
export function createStore(backing = safeSessionStorage()) {
    const memory = new Map();

    return {
        get(key) {
            try {
                const raw = memory.has(key) ? memory.get(key) : backing?.getItem(key);
                return raw == null ? null : JSON.parse(raw);
            } catch {
                return null;
            }
        },
        set(key, value) {
            const raw = JSON.stringify(value);
            try {
                if (backing) {
                    backing.setItem(key, raw);
                    return;
                }
            } catch {
                // Quota exceeded or storage blocked; fall through to memory.
            }
            memory.set(key, raw);
        },
        remove(key) {
            try {
                backing?.removeItem(key);
            } catch {
                // ignore
            }
            memory.delete(key);
        },
    };
}

function safeSessionStorage() {
    try {
        const s = globalThis.sessionStorage;
        if (!s) return null;
        const probe = '__gc_probe__';
        s.setItem(probe, '1');
        s.removeItem(probe);
        return s;
    } catch {
        return null;
    }
}
