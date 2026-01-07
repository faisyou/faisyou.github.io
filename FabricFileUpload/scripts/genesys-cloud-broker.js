// Config is now passed via initialize()


class GenesysCloudBroker {
    constructor() {
        this.client = null;
        this.usersApi = null;
        this.platformClient = null;
        this.clientConfig = null;
    }

    initialize(config) {
        if (!config || !config.clientId || !config.region) {
            throw new Error('Missing configuration. Please provide clientId and region.');
        }
        this.clientConfig = config;

        // Access the global platformClient. 
        // In a browser environment included via <script>, it is typically available on window.platformClient
        // or potentially via a global 'require' if the SDK polyfills it.

        if (typeof window.platformClient !== 'undefined') {
            this.platformClient = window.platformClient;
        } else if (typeof require === 'function') {
            try {
                this.platformClient = require('platformClient');
            } catch (e) {
                console.warn('require("platformClient") failed', e);
            }
        }

        if (!this.platformClient) {
            console.error('Genesys Cloud Platform Client SDK not found. Ensure the script tag is included.');
            throw new Error('Genesys Cloud SDK not loaded');
        }

        this.client = this.platformClient.ApiClient.instance;
        this.client.setEnvironment(this.clientConfig.region);

        // Optional: Persist settings to localStorage to remember sessions
        this.client.setPersistSettings(true, 'genesys_cloud_app');

        this.usersApi = new this.platformClient.UsersApi();
    }

    authenticate() {
        // Use PKCE Grant
        return this.client.loginPKCEGrant(this.clientConfig.clientId, this.clientConfig.redirectUri, { state: 'random_state_string' })
            .then((data) => {
                console.log('Authenticated successfully', data);
                return data;
            })
            .catch((err) => {
                console.error('Authentication failed', err);
                throw err;
            });
    }

    getUsersMe() {
        return this.usersApi.getUsersMe();
    }

    getKnowledgeSources() {
        // Use generic API call as requested, or fall back to fetch if SDK doesn't support it directly in this version.
        // The user explicitly provided a REST API path, so we will use the generic client method to invoke it.
        // Method: GET /api/v2/knowledge/sources
        const path = '/api/v2/knowledge/sources';

        // Use the Platform Client's ApiClient to make the request, which handles auth headers automatically if possible,
        // or manually construct it using the token if we want raw control as per the "general rest api" instruction.
        // this.client.callApi(path, 'GET', ...) is the SDK way.
        // But to be extremely explicit and match the "invoke this as a general rest api" style:

        const token = this.client.authData.accessToken;
        const region = this.client.environment; // or clientConfig.region
        // Note: region in config is 'mypurecloud.de', so we need to construct the URL.
        // this.client.environment should already be set correctly.

        // If the environment is just 'mypurecloud.de', the API host is 'api.mypurecloud.de'.
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;

        return fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Knowledge Sources API failed: ${response.statusText}`);
                }
                return response.json();
            });
    }

    createKnowledgeSource(name) {
        const path = '/api/v2/knowledge/sources';
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;
        const token = this.client.authData.accessToken;

        const body = {
            name: name,
            type: 'FileUpload',
            triggerType: 'Manual'
        };

        return fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Create Source Failed: ${response.statusText} - ${text}`);
                    });
                }
                return response.json();
            });
    }

    deleteKnowledgeSource(sourceId) {
        const path = `/api/v2/knowledge/sources/${sourceId}`;
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;
        const token = this.client.authData.accessToken;

        return fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Delete Source Failed: ${response.statusText} - ${text}`);
                    });
                }
                // Handle 204 No Content or success without body
                if (response.status === 204) {
                    return {};
                }
                return response.json();
            });
    }

    createSynchronization(sourceId) {
        const path = `/api/v2/knowledge/sources/${sourceId}/synchronizations`;
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;
        const token = this.client.authData.accessToken;

        return fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body typically implies Manual trigger start
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Create Synchronization Failed: ${response.statusText} - ${text}`);
                    });
                }
                return response.json();
            });
    }

    createUpload(sourceId, syncId, fileMetadata) {
        const path = `/api/v2/knowledge/sources/${sourceId}/synchronizations/${syncId}/uploads`;
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;
        const token = this.client.authData.accessToken;

        return fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fileMetadata)
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Create Upload Failed: ${response.statusText} - ${text}`);
                    });
                }
                return response.json();
            });
    }

    completeSynchronization(sourceId, syncId) {
        const path = `/api/v2/knowledge/sources/${sourceId}/synchronizations/${syncId}`;
        const apiHost = `https://api.${this.clientConfig.region}`;
        const url = `${apiHost}${path}`;
        const token = this.client.authData.accessToken;

        return fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'Completed' })
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Complete Synchronization Failed: ${response.statusText} - ${text}`);
                    });
                }
                return response.json();
            });
    }
}

export const genesysCloudBroker = new GenesysCloudBroker();
