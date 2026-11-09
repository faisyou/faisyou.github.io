export const LOG_LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });

/**
 * @typedef {object} Logger
 * @property {(...args: any[]) => void} debug
 * @property {(...args: any[]) => void} info
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} error
 * @property {(scope: string) => Logger} child  create a logger with a nested prefix
 */

/**
 * Leveled, prefixed logger. The sink defaults to `console` but can be any
 * object with debug/info/warn/error methods (e.g. a remote log shipper).
 *
 * @param {object} [options]
 * @param {keyof typeof LOG_LEVELS} [options.level='info']
 * @param {string} [options.prefix='gc']
 * @param {Pick<Console, 'debug'|'info'|'warn'|'error'>} [options.sink=console]
 * @returns {Logger}
 */
export function createLogger({ level = 'info', prefix = 'gc', sink = console } = {}) {
    const threshold = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    const tag = `[${prefix}]`;

    const make = (method) => (...args) => {
        if (LOG_LEVELS[method] >= threshold) sink[method](tag, ...args);
    };

    return {
        debug: make('debug'),
        info: make('info'),
        warn: make('warn'),
        error: make('error'),
        child: (scope) => createLogger({ level, prefix: `${prefix}:${scope}`, sink }),
    };
}

/** A logger that discards everything; handy in tests. */
export const silentLogger = createLogger({ level: 'silent' });
