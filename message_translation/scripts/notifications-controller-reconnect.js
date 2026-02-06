/**
 * This file manages the channel that listens to chat events.
 */
const platformClient = require('platformClient');
const notificationsApi = new platformClient.NotificationsApi();

let channel = {};
let ws = null;
let reconnectInterval = 1000; //Initial reconnection interval in ms
const maxReconnectInterval = 60000; //Maximum reconnection interval allowed in ms
const maxReconnectionAttempts = 10; //Maximum number of reconnection attempts 
let reconnectAttempts = 0; //Reconnection attempt counter

// Object that will contain the subscription topic as key and the
// callback function as the value
let subscriptionMap = {
    'channel.metadata': () => {
        console.log('CXClient:Notification:heartbeat.');
    }
};

/**
 * Callback function for notications event-handling.
 * It will reference the subscriptionMap to determine what function to run
 * @param {Object} event 
 */
function onSocketMessage(event){
    let data = JSON.parse(event.data);

    subscriptionMap[data.topicName](data);
}

/**
 * Function to handle WebSocket reconnection with exponential backoff.
 */
function reconnectWebSocket(){
    if(reconnectAttempts >= maxReconnectionAttempts){
        console.log('CXClient:Notification:Max reconnect attempts reached.');
        return;
    }

    console.log(`CXClient:Notification:Attempting to reconnect... Attempt ${reconnectAttempts + 1}`);

    // Exponential backoff logic
    reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
    reconnectAttempts++;
    setTimeout(() => {
        createWebSocket();
    }, reconnectInterval);
}

/**
 * Function to create a new WebSocket connection and set up event handlers.
 */
function createWebSocket() {
    console.log("Creating websocket")
    ws = new WebSocket(channel.connectUri);
    ws.onmessage = onSocketMessage;
    ws.onopen = function(openEvent) {
        console.log(`CXClient:Notification:WebSocket Opened. Channel: ${JSON.stringify(channel)} | OpenEvent: ${JSON.stringify(openEvent)}`);
        reconnectAttempts = 0;
        reconnectInterval = 1000;
    }
    ws.onclose = function(closingEvent) {
        console.log(`CXClient:Notification:WebSocket Closed. Channel: ${JSON.stringify(channel)} | CloseEvent: ${JSON.stringify(closingEvent)}`);
        reconnectWebSocket();
    };
    ws.onerror = function(errorEvent) {
        console.log(`CXClient:Notification:WebSocket Error. Channel: ${JSON.stringify(channel)} | ErrorEvent: ${JSON.stringify(errorEvent)}`);
        reconnectWebSocket();
    };
}

export default {
    /**
     * Creation of the channel. If called multiple times,
     * the last one will be the active one.
     */
    createChannel(){
        return notificationsApi.postNotificationsChannels()
        .then(data => {
            console.log(`CXClient:Notification: Created Notifications ChannelsData:${JSON.stringify(data)}`);
            
            channel = data;
            reconnectAttempts = 0; // Reset reconnect attempts when creating a new channel
            reconnectInterval = 1000; // Reset reconnect interval to initial reconnect interval
            createWebSocket(); // Initialize WebSocket connection
        });
    },

    /**
     * Add a subscription to the channel
     * @param {String} topic PureCloud notification topic string
     * @param {Function} callback callback function to fire when the event occurs
     */
    addSubscription(topic, callback){
        let body = [{'id': topic}]
        console.debug(`CXClient:Notification:Adding Subscription Topic:${topic}`);
        return notificationsApi.postNotificationsChannelSubscriptions(
                channel.id, body)
        .then((data) => {
            subscriptionMap[topic] = callback;
            console.log(`CXClient:Notification:Added subscription to ${topic}`);
        });
    }
}