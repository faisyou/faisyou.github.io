/**
 * Public API. Import only from this file; everything else is internal and
 * may change without notice.
 */
export { GenesysCloudClient, createGenesysCloudClient } from './GenesysCloudClient.js';
export { validateConfig, loadConfig, normalizeRegion, KNOWN_REGIONS, DEFAULTS } from './config.js';

export { PkceAuthenticator } from './auth/PkceAuthenticator.js';
export { createStore } from './auth/storage.js';
export { ApiClient } from './http/ApiClient.js';

export { NotificationClient, ConnectionState, topicTemplateToRegExp } from './notifications/NotificationClient.js';
export { Topics, buildTopic, assertValidTopic, SYSTEM_TOPICS, MAX_TOPICS_PER_CHANNEL } from './notifications/topics.js';

export { GenesysError, ConfigError, AuthError, ApiError, NotificationError } from './core/errors.js';
export { createLogger, LOG_LEVELS } from './core/logger.js';
export { EventEmitter } from './core/EventEmitter.js';
