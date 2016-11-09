/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Solace Systems Node.js API
 * PublishSubscribe tutorial - Topic Subscriber
 * Demonstrates subscribing to a topic for direct messages and receiving messages
 */

/*jslint es6 node:true devel:true*/

var TopicSubscriber = function (solaceModule, topicName) {
    'use strict';
    var solace = solaceModule;
    var subscriber = {};
    subscriber.session = null;
    subscriber.topicName = topicName;
    subscriber.subscribed = false;

    // Logger
    subscriber.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2), ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    subscriber.log('\n*** Subscriber to topic "' + subscriber.topicName + '" is ready to connect ***');

    // main function
    subscriber.run = function (hostname) {
        subscriber.connect(hostname);
    };

    // Callback for message events
    subscriber.messageEventCb = function (session, message) {
        subscriber.log('Received message: "' + message.getSdtContainer().getValue() + '"');
    };

    // Callback for session events
    subscriber.sessionEventCb = function (session, event) {
        subscriber.log(event.toString());
        if (event.sessionEventCode === solace.SessionEventCode.UP_NOTICE) {
            subscriber.log('=== Successfully connected and ready to subscribe. ===');
            subscriber.subscribe();
        } else if (event.sessionEventCode === solace.SessionEventCode.CONNECTING) {
            subscriber.log('Connecting...');
            subscriber.subscribed = false;
        } else if (event.sessionEventCode === solace.SessionEventCode.DISCONNECTED) {
            subscriber.log('Disconnected.');
            subscriber.subscribed = false;
            if (subscriber.session !== null) {
                subscriber.session.dispose();
                subscriber.session = null;
            }
        } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_ERROR) {
            subscriber.log('Cannot subscribe to topic: ' + event.correlationKey);
        } else if (event.sessionEventCode === solace.SessionEventCode.SUBSCRIPTION_OK) {
            if (subscriber.subscribed) {
                subscriber.subscribed = false;
                subscriber.log('Successfully unsubscribed from topic: ' + event.correlationKey);
            } else {
                subscriber.subscribed = true;
                subscriber.log('Successfully subscribed to topic: ' + event.correlationKey);
                subscriber.log('=== Ready to receive messages. ===');
            }
        }
    };

    // Establishes connection to Solace message router
    subscriber.connect = function (host) {
        if (subscriber.session !== null) {
            subscriber.log('Already connected and ready to subscribe.');
        } else {
            if (host) {
                subscriber.connectToSolace(host);
            } else {
                subscriber.log('Cannot connect: please specify the Solace message router web transport URL.');
            }
        }
    };

    subscriber.connectToSolace = function (host) {
        subscriber.log('Connecting to Solace message router web transport URL ' + host + '.');
        var sessionProperties = new solace.SessionProperties();
        sessionProperties.url = 'http://' + host;
        // NOTICE: the Solace message router VPN name
        sessionProperties.vpnName = 'default';
        subscriber.log('Solace message router VPN name: ' + sessionProperties.vpnName);
        // NOTICE: the client username
        sessionProperties.userName = 'tutorial';
        subscriber.log('Client username: ' + sessionProperties.userName);
        subscriber.session = solace.SolclientFactory.createSession(
            sessionProperties,
            new solace.MessageRxCBInfo(function (session, message) {
                // calling callback for message events
                subscriber.messageEventCb(session, message);
            }, subscriber),
            new solace.SessionEventCBInfo(function (session, event) {
                // calling callback for session events
                subscriber.sessionEventCb(session, event);
            }, subscriber)
        );
        try {
            subscriber.session.connect();
        } catch (error) {
            subscriber.log(error.toString());
        }
    };

    // Gracefully disconnects from Solace message router
    subscriber.disconnect = function () {
        subscriber.log('Disconnecting from Solace message router...');
        if (subscriber.session !== null) {
            try {
                subscriber.session.disconnect();
                subscriber.session.dispose();
                subscriber.session = null;
            } catch (error) {
                subscriber.log(error.toString());
            }
        } else {
            subscriber.log('Not connected to Solace message router.');
        }
    };

    // Subscribes to topic on Solace message router
    subscriber.subscribe = function () {
        if (subscriber.session !== null) {
            if (subscriber.subscribed) {
                subscriber.log('Already subscribed to "' + subscriber.topicName + '" and ready to receive messages.');
            } else {
                subscriber.log('Subscribing to topic: ' + subscriber.topicName);
                try {
                    subscriber.session.subscribe(
                        solace.SolclientFactory.createTopic(subscriber.topicName),
                        true, // generate confirmation when subscription is added successfully
                        subscriber.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    subscriber.log(error.toString());
                }
            }
        } else {
            subscriber.log('Cannot subscribe because not connected to Solace message router.');
        }
    };

    // Unsubscribes from topic on Solace message router
    subscriber.unsubscribe = function () {
        if (subscriber.session !== null) {
            if (subscriber.subscribed) {
                subscriber.log('Unsubscribing from topic: ' + subscriber.topicName);
                try {
                    subscriber.session.unsubscribe(
                        solace.SolclientFactory.createTopic(subscriber.topicName),
                        true, // generate confirmation when subscription is removed successfully
                        subscriber.topicName, // use topic name as correlation key
                        10000 // 10 seconds timeout for this operation
                    );
                } catch (error) {
                    subscriber.log(error.toString());
                }
            } else {
                subscriber.log('Cannot unsubscribe because not subscribed to the topic "' + subscriber.topicName + '"');
            }
        } else {
            subscriber.log('Cannot unsubscribe because not connected to Solace message router.');
        }
    };

    subscriber.exit = function () {
        subscriber.unsubscribe();
        setTimeout(function () {
            subscriber.disconnect();
        }, 1000); // wait for 1 second to disconnect
        setTimeout(function () {
            process.exit();
        }, 2000); // wait for 2 seconds to finish
    };

    return subscriber;
};

var solace = require('./lib/solclientjs-debug');

// enable logging to JavaScript console at WARN level
// NOTICE: works only with "lib/solclientjs-debug.js"
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.logLevel = solace.LogLevel.WARN;
solace.SolclientFactory.init(factoryProps);

// create the subscriber, specifying the name of the subscription topic
var subscriber = new TopicSubscriber(solace, 'tutorial/topic');

// subscribe to messages on Solace message router
subscriber.run(process.argv.slice(2)[0]);

// wait to be told to exit
subscriber.log("Press Ctrl-C to exit");
process.stdin.resume();

process.on('SIGINT', function () {
    'use strict';
    subscriber.exit();
});
