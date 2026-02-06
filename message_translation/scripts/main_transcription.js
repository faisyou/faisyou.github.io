
import controller from './notifications-controller.js';
import translate from './translate-service.js';
import config from './config_de.js';


// Obtain a reference to the platformClient object
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// API instances
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();


let userId = '';
let agentName = 'AGENT_NAME';
let agentAlias = 'AGENT_ALIAS';
let customerName = 'CUSTOMER_NAME';
let currentConversation = null;
let currentConversationId = '';
let translationData = null;
let genesysCloudLanguage = 'en-us';

/**
 * Callback function receiving transcription events.
 * 
 * @param {Object} data the event data  
 */
let onMessage = (data) => {
    console.log(`[FY:Main]Received Transcript Notification:${JSON.stringify(data)}`)   
    const textPanel = document.getElementById('textPanel');
    const newParagraph = document.createElement('p');
    
    let alternatives=data.eventBody.transcripts.map(t=>t.alternatives)
    let transcripts=alternatives.map(a=>a[0].transcript);

    let t=transcripts.join('.');
      newParagraph.textContent = JSON.stringify(t);
      textPanel.appendChild(newParagraph);

    // Scroll to the bottom of the panel
    textPanel.scrollTop = textPanel.scrollHeight;
};



/**
 * Set-up the channel for chat conversations
 * @param {String} conversationId 
 * @returns {Promise}
 */
function setupChatChannel(conversationId){
    const _prefix=`[FY:Main] [${conversationId} setupChatChannel]`;
    return controller.createChannel()
    .then(data => {
        // Subscribe to all transcription messages v2.conversations.{id}.transcription
        console.info(`${_prefix}setting up subscription for v2.conversations.${conversationId}.transcription`);
        return controller.addSubscription(
            `v2.conversations.${conversationId}.transcription`,
            onMessage);
    });
}



/** --------------------------------------------------------------
 *                       EVENT HANDLERS
 * -------------------------------------------------------------- */


/** --------------------------------------------------------------
 *                       INITIAL SETUP
 * -------------------------------------------------------------- */
const urlParams = new URLSearchParams(window.location.search);
currentConversationId = urlParams.get('conversationId');
genesysCloudLanguage = urlParams.get('language');
console.log(`[FY:Main][${currentConversationId}:InitialSetup] Starting Widget.ConversationId:${currentConversationId}|genesysCloudLanguage:${genesysCloudLanguage}`);
client.setPersistSettings(true, 'transcription-widget');
client.setEnvironment(config.genesysCloud.region);
client.loginImplicitGrant(
    config.clientID,
    config.redirectUri,
    { state: JSON.stringify({
        conversationId: currentConversationId,
        language: genesysCloudLanguage
    }) })
.then(data => {
    

    // Assign conversation id
    let stateData = JSON.parse(data.state);
    currentConversationId = stateData.conversationId;
    genesysCloudLanguage = stateData.language;
    const _prefix=`[FY:Main] [${currentConversationId} AgentLang:${genesysCloudLanguage} ]`;
    console.log(`${_prefix} Authenticated.`);
    // Get Details of current User
    return usersApi.getUsersMe();
}).then(userMe => {
    userId = userMe.id;
    agentName = userMe.name;
    agentAlias = agentName ? agentName : agentAlias;
    const _prefix=`[FY:Main] [${currentConversationId} Agent:${agentAlias} ]`;
    console.log(`${_prefix}`)
    // Get current conversation
    return conversationsApi.getConversation(currentConversationId);
}).then((conv) => { 
    currentConversation = conv;
    let customer = conv.participants.find(p => p.purpose == 'customer')
    const _prefix=`[FY:Main] [${currentConversationId}`;
    console.log(`${_prefix} setting up channels`)
    return setupChatChannel(currentConversationId);
}).then(data => {
    const _prefix=`[RTT:Main] [${currentConversationId} ] `;
    console.log(`${_prefix} Finished Setup`);

// Error Handling
}).catch(e => console.log(`${currentConversationId} Initial setup had following error ${JSON.stringify(e)}`));
