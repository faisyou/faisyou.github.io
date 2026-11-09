/**
 * Pure mapping from Genesys Cloud payloads to one view model.
 *
 * Summaries reach us two ways with different shapes:
 *   - live:   notification topic v2.bot.conversation.{id}.conversations.summaries
 *   - resync: GET /api/v2/conversations/{conversationId}/summaries
 * Normalizing both here keeps the view ignorant of where data came from.
 */

/**
 * @typedef {object} SummaryViewModel
 * @property {string} id
 * @property {string|null} conversationId
 * @property {string} text
 * @property {string|null} headline
 * @property {string|null} reason
 * @property {string|null} resolution
 * @property {string[]} followUps
 * @property {string[]} wrapUpCodes
 * @property {{ label: string, value: string }[]} entities
 * @property {string|null} language
 * @property {string|null} createdAt   ISO timestamp
 * @property {number|null} confidence  0..1
 * @property {string|null} error       errorType reported by Genesys Cloud, if generation failed
 * @property {'notification'|'rest'} source
 */

const texts = (items) => (items ?? []).map((item) => item?.text).filter(Boolean);
const names = (items) => (items ?? []).map((item) => item?.name).filter(Boolean);

/**
 * @param {any} body  eventBody of a v2.bot.conversation.{id}.conversations.summaries notification
 * @returns {SummaryViewModel}
 */
export function fromNotification(body) {
    return {
        id: body.summaryId ?? `${body.conversationId ?? 'unknown'}:${body.createdDate ?? Date.now()}`,
        conversationId: body.conversationId ?? null,
        text: body.summary?.text ?? '',
        headline: body.headline?.text ?? null,
        reason: body.reason?.text ?? null,
        resolution: body.resolution?.text ?? body.resolution?.resolutionValue ?? null,
        followUps: texts(body.followupActions),
        wrapUpCodes: names(body.wrapUpCodes),
        entities: (body.extractedEntities ?? [])
            .filter((e) => e?.label)
            .map((e) => ({ label: e.label, value: e.value ?? '' })),
        language: body.language ?? null,
        createdAt: body.createdDate ?? null,
        confidence: body.summary?.score ?? null,
        error: body.errorType ?? null,
        source: 'notification',
    };
}

/**
 * @param {any} response  body of GET /api/v2/conversations/{conversationId}/summaries
 * @returns {SummaryViewModel[]}  de-duplicated by id
 */
export function fromRestResponse(response) {
    const candidates = [response?.summary, ...(response?.sessionSummaries ?? [])].filter((s) => s && (s.text || s.editedSummary?.text));
    const byId = new Map();
    for (const s of candidates) {
        const id = s.id ?? `${response?.conversation?.id ?? 'unknown'}:${s.dateCreated ?? ''}`;
        byId.set(id, {
            id,
            conversationId: response?.conversation?.id ?? null,
            text: s.editedSummary?.text ?? s.text ?? '',
            headline: null,
            reason: s.reason?.text ?? null,
            resolution: s.resolution?.text ?? null,
            followUps: s.followup?.text ? [s.followup.text] : [],
            wrapUpCodes: names(s.predictedWrapupCodes),
            entities: [],
            language: s.language ?? null,
            createdAt: s.dateCreated ?? null,
            confidence: s.confidence ?? null,
            error: null,
            source: 'rest',
        });
    }
    return [...byId.values()];
}
