/**
 * Example: show virtual agent (bot) conversation summaries live in an
 * interaction widget.
 *
 * Open as:  index.html?conversationId={{gcConversationId}}
 * Optional: &topicId=<id>  overrides the {id} used in the topic name if it
 *           differs from the conversation ID in your org (see README).
 */
import { AuthError, ConnectionState, Topics, createGenesysCloudClient, loadConfig } from '../src/index.js';
import { fromNotification, fromRestResponse } from './summary-model.js';
import * as view from './view.js';

async function main() {
    const config = await loadConfig(new URL('./genesys.config.json', import.meta.url));
    if (config.clientId.startsWith('REPLACE')) {
        throw new Error('Set your OAuth client ID in examples/bot-summaries/genesys.config.json (see README).');
    }

    const gc = createGenesysCloudClient(config);
    window.addEventListener('pagehide', () => gc.dispose());

    // 1. Authenticate. URL parameters are lost during the OAuth redirect,
    //    so carry them through as appState.
    const params = new URLSearchParams(location.search);
    const { appState } = await gc.login({
        appState: { conversationId: params.get('conversationId'), topicId: params.get('topicId') },
    });

    const conversationId = appState?.conversationId;
    if (!conversationId) {
        view.showWaiting('');
        view.showConversationPicker((id) => {
            location.search = new URLSearchParams({ conversationId: id }).toString();
        });
        return;
    }
    const topic = Topics.botConversationSummaries(appState.topicId || conversationId);

    // 2. Context for the header.
    const me = await gc.api.get('/api/v2/users/me');
    view.setContext({ agentName: me.name, conversationId, topic });

    // 3. Reflect connection health in the UI.
    const { notifications } = gc;
    view.setStatus(notifications.state);
    notifications.on('stateChange', ({ state }) => view.setStatus(state));
    notifications.on('reconnecting', ({ attempt, delayMs, waitingForNetwork }) => {
        view.setStatusDetail(waitingForNetwork ? 'Offline: waiting for network' : `Attempt ${attempt}, retrying in ${Math.round(delayMs / 1000)}s`);
    });
    notifications.on('error', (err) => view.showError(err));
    notifications.on('subscriptionRejected', ({ topics }) =>
        view.showError(`Genesys Cloud rejected ${topics.join(', ')}. Check the user's permissions.`),
    );
    gc.auth.on('tokenExpired', () =>
        view.showError('Your Genesys Cloud session expired.', {
            action: { label: 'Sign in again', onClick: () => gc.login({ appState }) },
        }),
    );

    // 4. Live summaries.
    await notifications.subscribe(topic, (eventBody) => {
        view.clearError();
        view.upsertSummary(fromNotification(eventBody));
    });

    // 5. Anything published while we were disconnected is not replayed by the
    //    Notification API, so resync from REST after every reconnect.
    const loadExisting = async () => {
        try {
            const response = await gc.api.get(`/api/v2/conversations/${encodeURIComponent(conversationId)}/summaries`);
            const summaries = fromRestResponse(response);
            summaries.forEach(view.upsertSummary);
            if (!summaries.length) view.showWaiting('No summary yet. It appears here as soon as the virtual agent produces one.');
        } catch (err) {
            if (err.status === 404) {
                view.showWaiting('No summary yet. It appears here as soon as the virtual agent produces one.');
            } else {
                view.showError(err);
            }
        }
    };
    notifications.on('connected', ({ reconnected }) => {
        view.setStatusDetail('');
        if (reconnected) loadExisting();
    });

    await notifications.connect();
    await loadExisting();

    // Optional diagnostics: what the topic needs, straight from the API.
    notifications
        .describeTopic(topic)
        .then(view.setTopicInfo)
        .catch(() => {});
}

main().catch((err) => {
    console.error(err);
    view.setStatus(ConnectionState.FAILED);
    view.showError(err, err instanceof AuthError ? { action: { label: 'Retry', onClick: () => location.reload() } } : {});
});
